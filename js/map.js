/**
 * 高德地图模块
 */
const GasMap = {
  map: null,
  userMarker: null,
  stationMarkers: {},
  infoWindow: null,
  routePolyline: null,
  routePolylineBg: null,
  routeConnectorPolylines: [],
  destMarker: null,
  routePath: null,
  routeRecommended: [],
  ready: false,
  amapReady: false,
  markerZoomThreshold: AMAP_CONFIG.markerZoomThreshold || 14,
  lastMarkerOptions: {},
  lastStations: [],
  lastDestination: null,

  isConfigured() {
    return AMAP_CONFIG.key && AMAP_CONFIG.key !== 'YOUR_AMAP_KEY';
  },

  loadScript() {
    if (window.AMap) {
      return Promise.resolve(window.AMap);
    }

    if (AMAP_CONFIG.securityJsCode) {
      window._AMapSecurityConfig = { securityJsCode: AMAP_CONFIG.securityJsCode };
    }

    const plugins = AMAP_CONFIG.plugins.join(',');
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://webapi.amap.com/maps?v=${AMAP_CONFIG.version}&key=${AMAP_CONFIG.key}&plugin=${plugins}`;
      script.async = true;
      script.onload = () => resolve(window.AMap);
      script.onerror = () => reject(new Error('高德地图脚本加载失败'));
      document.head.appendChild(script);
    });
  },

  loadPlugins(AMap) {
    return new Promise((resolve) => {
      AMap.plugin(AMAP_CONFIG.plugins, () => resolve());
    });
  },

  async ensureAmapLoaded() {
    if (this.amapReady && window.AMap) return window.AMap;
    if (!this.isConfigured()) {
      throw new Error('未配置高德 Key');
    }
    const AMap = await this.loadScript();
    await this.loadPlugins(AMap);
    this.amapReady = true;
    return AMap;
  },

  getBrowserPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('浏览器不支持定位'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lng: pos.coords.longitude, lat: pos.coords.latitude }),
        (err) => reject(new Error(err.message || '浏览器定位失败')),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });
  },

  getAmapPosition() {
    return new Promise((resolve, reject) => {
      const geolocation = new AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: 10000,
        zoomToAccuracy: false,
        convert: true,
      });
      geolocation.getCurrentPosition((status, result) => {
        if (status === 'complete') {
          resolve({ lng: result.position.lng, lat: result.position.lat });
        } else {
          reject(new Error(result.message || '高德定位失败'));
        }
      });
    });
  },

  reverseGeocode(lng, lat) {
    return new Promise((resolve) => {
      const location = { lng, lat, name: '当前位置', district: '' };
      const geocoder = new AMap.Geocoder();
      geocoder.getAddress([lng, lat], (status, result) => {
        if (status === 'complete' && result.regeocode) {
          location.name = result.regeocode.formattedAddress;
          location.district = result.regeocode.addressComponent?.district || '';
        }
        resolve(location);
      });
    });
  },

  async locateUser() {
    await this.ensureAmapLoaded();

    let position;
    try {
      position = await this.getAmapPosition();
    } catch (amapErr) {
      console.warn('高德定位失败，尝试浏览器定位:', amapErr.message);
      position = await this.getBrowserPosition();
    }

    return this.reverseGeocode(position.lng, position.lat);
  },

  async init(userLocation, stations) {
    const placeholder = document.getElementById('map-placeholder');

    if (!this.isConfigured()) {
      if (placeholder) {
        placeholder.innerHTML = '请在 <code>js/config.js</code> 中配置高德 Key 后刷新页面';
      }
      return false;
    }

    try {
      const AMap = await this.ensureAmapLoaded();

      if (placeholder) placeholder.style.display = 'none';

      const center = [userLocation.lng, userLocation.lat];
      this.map = new AMap.Map('map-container', {
        zoom: 14,
        center,
        viewMode: '2D',
        mapStyle: 'amap://styles/normal',
      });

      this.map.addControl(new AMap.Scale());
      this.map.addControl(new AMap.ToolBar({ position: 'RB' }));

      this.infoWindow = new AMap.InfoWindow({
        offset: new AMap.Pixel(0, -28),
        closeWhenClickMap: true,
      });

      this.setUserMarker(userLocation);
      this.setStationMarkers(stations);
      this.bindZoomListener();
      this.fitView();
      this.ready = true;
      return true;
    } catch (err) {
      console.error('地图初始化失败:', err);
      if (placeholder) {
        placeholder.style.display = 'flex';
        placeholder.textContent = '地图加载失败，请检查 Key 配置与网络';
      }
      return false;
    }
  },

  setUserMarker(userLocation) {
    if (!this.map || !window.AMap) return;

    const position = [userLocation.lng, userLocation.lat];

    if (this.userMarker) {
      this.userMarker.setPosition(position);
      return;
    }

    this.userMarker = new AMap.Marker({
      position,
      title: '我的位置',
      zIndex: 200,
      content: '<div class="map-marker map-marker-user"><span></span></div>',
      offset: new AMap.Pixel(-14, -14),
    });
    this.map.add(this.userMarker);
  },

  buildMarkerContent(station, zoom, { isRouteBest = false, isOnRoute = false, routeRank = 0 } = {}) {
    const showDetail = zoom >= this.markerZoomThreshold;
    let cls = 'map-marker-station';
    if (isRouteBest) cls += ' route-best';
    else if (isOnRoute) cls += ' on-route';

    const rankLabel = routeRank || (isRouteBest ? '1' : '');
    const icon = rankLabel || '⛽';

    if (!showDetail) {
      return `
        <div class="map-marker ${cls} map-marker-icon ${routeRank ? 'has-rank' : ''}">
          ${routeRank ? `<span class="map-marker-rank">${routeRank}</span>` : icon}
        </div>
      `;
    }

    const label92 = formatMapSavingLabel(station.diff92);
    const label95 = formatMapSavingLabel(station.diff95);
    const cls92 = station.diff92 > 0 ? 'save-pos' : 'save-none';
    const cls95 = station.diff95 > 0 ? 'save-pos' : 'save-none';
    const updated = formatPriceUpdated(station.priceUpdatedAt);
    const updatedHtml = updated !== '--'
      ? `<span class="map-marker-updated">更${updated}</span>`
      : '';
    const activityHtml = buildMapActivityHtml(station, { compact: zoom < 13 });
    const compact = zoom < 13;

    if (compact) {
      return `
        <div class="map-marker map-marker-detail map-marker-compact ${isRouteBest ? 'is-best' : ''} ${routeRank ? 'has-rank' : ''}">
          ${routeRank ? `<span class="map-marker-rank">${routeRank}</span>` : ''}
          <span class="map-marker-compact-label ${cls92}">92${label92}</span>
          <span class="map-marker-compact-label ${cls95}">95${label95}</span>
          ${updatedHtml}
          ${activityHtml}
          <div class="map-marker-dot ${cls}">${routeRank || (isRouteBest ? '🏆' : '⛽')}</div>
        </div>
      `;
    }

    return `
      <div class="map-marker map-marker-detail ${isRouteBest ? 'is-best' : ''} ${routeRank ? 'has-rank' : ''}">
        ${routeRank ? `<span class="map-marker-rank map-marker-rank-lg">${routeRank}</span>` : ''}
        <div class="map-marker-label">
          <span class="map-marker-fuel ${cls92}">92${label92}</span>
          <span class="map-marker-fuel ${cls95}">95${label95}</span>
          ${updatedHtml}
          ${activityHtml}
        </div>
        <div class="map-marker-dot ${cls}">${routeRank || (isRouteBest ? '🏆' : '⛽')}</div>
      </div>
    `;
  },

  markerDetailOffset(zoom, station) {
    if (zoom < this.markerZoomThreshold) return -14;
    const hasActivity = !!getStationActivityRule(station);
    if (zoom < 13) return hasActivity ? -40 : -32;
    return hasActivity ? -52 : -40;
  },

  bindZoomListener() {
    if (!this.map) return;
    this.map.on('zoomend', () => this.refreshMarkerLabels());
  },

  refreshMarkerLabels() {
    if (!this.map || !this.lastStations.length) return;
    const zoom = this.map.getZoom();
    this.lastStations.forEach((station) => {
      const marker = this.stationMarkers[station.id];
      if (!marker) return;
      const isRouteBest = station.id === this.lastMarkerOptions.onRouteBestId;
      const isOnRoute = this.lastMarkerOptions.onRouteIds?.includes(station.id);
      const routeRank = this.lastMarkerOptions.recommendRanks?.[station.id] || 0;
      marker.setContent(this.buildMarkerContent(station, zoom, { isRouteBest, isOnRoute, routeRank }));
      marker.setOffset(new AMap.Pixel(0, this.markerDetailOffset(zoom, station)));
    });
  },

  setStationMarkers(stations, { routeMode = false, onRouteBestId = null, onRouteIds = [], recommendRanks = {} } = {}) {
    if (!this.map || !window.AMap) return;

    this.lastStations = stations;
    this.lastMarkerOptions = { routeMode, onRouteBestId, onRouteIds, recommendRanks };

    Object.values(this.stationMarkers).forEach((marker) => this.map.remove(marker));
    this.stationMarkers = {};

    const zoom = this.map.getZoom();
    const onRouteSet = new Set(onRouteIds);
    const visibleStations = routeMode
      ? stations.filter((s) => onRouteSet.has(s.id))
      : stations;

    visibleStations.forEach((station) => {
      if (station.lat == null || station.lng == null) return;

      const isRouteBest = station.id === onRouteBestId;
      const isOnRoute = onRouteSet.has(station.id);
      const routeRank = recommendRanks[station.id] || 0;
      const showDetail = zoom >= this.markerZoomThreshold;

      const marker = new AMap.Marker({
        position: [station.lng, station.lat],
        title: routeRank ? `推荐${routeRank}：${station.name}` : station.name,
        extData: { id: station.id },
        content: this.buildMarkerContent(station, zoom, { isRouteBest, isOnRoute, routeRank }),
        offset: new AMap.Pixel(0, this.markerDetailOffset(zoom, station)),
        zIndex: isRouteBest ? 150 : isOnRoute ? 130 : 100,
      });

      marker.on('click', () => {
        if (routeMode) {
          this.showStationOnRoute(station.id, stations);
        } else {
          this.focusStation(station.id, stations);
        }
        this.highlightListCard(station.id);
      });

      this.stationMarkers[station.id] = marker;
      this.map.add(marker);
    });
  },

  buildDestInfoContent(destination) {
    const title = destination.inputName || destination.name || '目的地';
    const sub = destination.formattedAddress && destination.formattedAddress !== title
      ? `<p class="map-info-meta">${destination.formattedAddress}</p>`
      : '';

    return `
      <div class="map-info">
        <h4>${title}</h4>
        ${sub}
        <button type="button" class="map-info-nav-btn" data-nav-dest>导航到目的地</button>
      </div>
    `;
  },

  showDestinationInfo(destination) {
    if (!this.map || !this.infoWindow || !this.destMarker) return;

    this.infoWindow.setContent(this.buildDestInfoContent(destination));
    this.infoWindow.open(this.map, this.destMarker.getPosition());

    const btn = document.querySelector('[data-nav-dest]');
    btn?.addEventListener('click', () => this.openNavigation(destination));
  },

  buildInfoContent(station) {
    const label92 = formatMapSavingLabel(station.diff92);
    const label95 = formatMapSavingLabel(station.diff95);
    const savingText = `<p class="map-info-saving">92${label92} · 95${label95}</p>`;
    const updated = formatPriceUpdated(station.priceUpdatedAt);
    const updateText = updated !== '--'
      ? `<p class="map-info-updated">更新 ${updated}</p>`
      : '';
    const routeMeta = station.routeDetourKm != null
      ? `<p class="map-info-meta">距路线 ${station.routeDetourKm}km${station.routeRecommendRank ? ` · 顺路第${station.routeRecommendRank}` : ''}</p>`
      : `<p class="map-info-meta">${formatDistance(station.distance)}</p>`;

    return `
      <div class="map-info">
        <h4>${station.name}</h4>
        ${routeMeta}
        ${savingText}
        ${updateText}
        <button type="button" class="map-info-nav-btn" data-nav-station="${station.id}">导航到加油站</button>
      </div>
    `;
  },

  bindInfoNavButton(station) {
    const btn = document.querySelector(`[data-nav-station="${station.id}"]`);
    btn?.addEventListener('click', () => this.openNavigation(station));
  },

  showStationOnRoute(stationId, stations) {
    const station = stations.find((s) => s.id === stationId);
    const marker = this.stationMarkers[stationId];
    if (!station || !marker || !this.map) return;

    this.infoWindow.setContent(this.buildInfoContent(station));
    this.infoWindow.open(this.map, marker.getPosition());
    this.bindInfoNavButton(station);
  },

  focusStation(stationId, stations) {
    const station = stations.find((s) => s.id === stationId);
    const marker = this.stationMarkers[stationId];
    if (!station || !marker || !this.map) return;

    this.map.setCenter([station.lng, station.lat]);
    this.map.setZoom(15);
    this.infoWindow.setContent(this.buildInfoContent(station));
    this.infoWindow.open(this.map, marker.getPosition());
    this.bindInfoNavButton(station);
  },

  highlightListCard(stationId) {
    document.querySelectorAll('.station-card').forEach((card) => {
      card.classList.toggle('active', card.dataset.id === stationId);
    });
    const card = document.querySelector(`.station-card[data-id="${stationId}"]`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  centerOnUser(userLocation) {
    if (!this.map) return;
    this.map.setCenter([userLocation.lng, userLocation.lat]);
    this.map.setZoom(14);
  },

  fitView(options = {}) {
    if (!this.map) return;

    const radiusKm = options.radiusKm ?? AMAP_CONFIG.fitViewRadiusKm ?? 12;
    const includeDistrict = options.includeDistrict ?? '两江新区';
    const useAll = options.all === true;

    let markers = Object.values(this.stationMarkers);
    if (!useAll && this.lastStations.length) {
      const ids = new Set();
      this.lastStations.forEach((s) => {
        if (s.distance <= radiusKm) ids.add(s.id);
        if (includeDistrict && s.district === includeDistrict) ids.add(s.id);
      });
      if (ids.size) {
        const filtered = markers.filter((m) => ids.has(m.getExtData()?.id));
        if (filtered.length) markers = filtered;
      }
    }

    const overlays = [
      ...(this.userMarker ? [this.userMarker] : []),
      ...(this.destMarker ? [this.destMarker] : []),
      ...(this.routePolyline ? [this.routePolyline] : []),
      ...markers,
    ];
    if (overlays.length) {
      this.map.setFitView(overlays, false, [50, 50, 72, 50], 13);
    }
  },

  fitDistrict(district) {
    if (!this.map || !this.lastStations.length) return;

    const ids = new Set(this.lastStations.filter((s) => s.district === district).map((s) => s.id));
    const markers = Object.values(this.stationMarkers).filter((m) => ids.has(m.getExtData()?.id));
    if (!markers.length) return;

    const overlays = [...markers];
    if (this.userMarker) overlays.unshift(this.userMarker);
    this.map.setFitView(overlays, false, [50, 50, 72, 50], 14);
  },

  fitRouteView() {
    if (!this.map || !this.routePath?.length) return;

    const overlays = [
      ...(this.userMarker ? [this.userMarker] : []),
      ...(this.destMarker ? [this.destMarker] : []),
      ...(this.routePolylineBg ? [this.routePolylineBg] : []),
      ...(this.routePolyline ? [this.routePolyline] : []),
      ...this.routeConnectorPolylines,
      ...Object.values(this.stationMarkers),
    ];

    if (overlays.length) {
      this.map.setFitView(overlays, false, [56, 56, 56, 56]);
    }
  },

  drawRouteConnectors(path, recommendedStations) {
    this.clearRouteConnectors();
    if (!this.map || !window.AMap || !recommendedStations?.length) return;

    recommendedStations.forEach((station) => {
      const snap = findNearestRouteSnapPoint(station, path);
      if (!snap) return;

      const connector = new AMap.Polyline({
        path: [
          [station.lng, station.lat],
          [snap.lng, snap.lat],
        ],
        strokeColor: '#f97316',
        strokeWeight: 3,
        strokeOpacity: 0.85,
        strokeStyle: 'dashed',
        lineJoin: 'round',
        zIndex: 55,
      });
      this.map.add(connector);
      this.routeConnectorPolylines.push(connector);
    });
  },

  clearRouteConnectors() {
    if (!this.map) return;
    this.routeConnectorPolylines.forEach((line) => this.map.remove(line));
    this.routeConnectorPolylines = [];
  },

  drawRoute(path, destination, recommendedStations = []) {
    if (!this.map || !window.AMap) return;

    this.clearRoute();
    this.lastDestination = destination;
    this.routePath = path;
    this.routeRecommended = recommendedStations;

    const routeCoords = path.map((p) => [p.lng, p.lat]);

    this.routePolylineBg = new AMap.Polyline({
      path: routeCoords,
      strokeColor: '#93c5fd',
      strokeWeight: 14,
      strokeOpacity: 0.35,
      lineJoin: 'round',
      zIndex: 40,
    });
    this.map.add(this.routePolylineBg);

    this.routePolyline = new AMap.Polyline({
      path: routeCoords,
      strokeColor: '#2563eb',
      strokeWeight: 6,
      strokeOpacity: 0.9,
      lineJoin: 'round',
      zIndex: 50,
    });
    this.map.add(this.routePolyline);

    const destLabel = destination.inputName || destination.name || '目的地';
    this.destMarker = new AMap.Marker({
      position: [destination.lng, destination.lat],
      title: destLabel,
      content: '<div class="map-marker map-marker-dest">🎯</div>',
      offset: new AMap.Pixel(-14, -14),
      zIndex: 180,
    });
    this.destMarker.on('click', () => this.showDestinationInfo(destination));
    this.map.add(this.destMarker);

    this.drawRouteConnectors(path, recommendedStations);
  },

  clearRoute() {
    if (!this.map) return;
    this.clearRouteConnectors();
    if (this.routePolylineBg) {
      this.map.remove(this.routePolylineBg);
      this.routePolylineBg = null;
    }
    if (this.routePolyline) {
      this.map.remove(this.routePolyline);
      this.routePolyline = null;
    }
    if (this.destMarker) {
      this.map.remove(this.destMarker);
      this.destMarker = null;
    }
    this.lastDestination = null;
    this.routePath = null;
    this.routeRecommended = [];
  },

  openNavigation(point) {
    const navName = point.inputName || point.name || '目的地';
    const name = encodeURIComponent(navName);
    const from = this.userMarker?.getPosition?.();
    let url = `https://uri.amap.com/navigation?to=${point.lng},${point.lat},${name}&mode=car&coordinate=gaode`;
    if (from) {
      url += `&from=${from.lng},${from.lat},${encodeURIComponent('我的位置')}`;
    }
    window.open(url, '_blank');
  },
};
