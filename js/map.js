/**
 * 高德地图模块
 */
const GasMap = {
  map: null,
  userMarker: null,
  stationMarkers: {},
  infoWindow: null,
  routePolyline: null,
  destMarker: null,
  ready: false,
  amapReady: false,

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

  setStationMarkers(stations, { onRouteBestId = null, onRouteIds = [] } = {}) {
    if (!this.map || !window.AMap) return;

    Object.values(this.stationMarkers).forEach((marker) => this.map.remove(marker));
    this.stationMarkers = {};

    const onRouteSet = new Set(onRouteIds);

    stations.forEach((station) => {
      if (station.lat == null || station.lng == null) return;

      const isRouteBest = station.id === onRouteBestId;
      const isOnRoute = onRouteSet.has(station.id);
      let markerClass = 'map-marker-station';
      if (isRouteBest) markerClass += ' route-best';
      else if (isOnRoute) markerClass += ' on-route';

      const marker = new AMap.Marker({
        position: [station.lng, station.lat],
        title: station.name,
        extData: { id: station.id },
        content: `<div class="map-marker ${markerClass}">${isRouteBest ? '🏆' : '⛽'}</div>`,
        offset: new AMap.Pixel(-14, -14),
        zIndex: isRouteBest ? 150 : isOnRoute ? 120 : 100,
      });

      marker.on('click', () => {
        this.focusStation(station.id, stations);
        this.highlightListCard(station.id);
      });

      this.stationMarkers[station.id] = marker;
      this.map.add(marker);
    });
  },

  buildInfoContent(station) {
    const savingText = station.maxSaving > 0
      ? `<p class="map-info-saving">预计节省 ${formatMoney(station.maxSaving)}</p>`
      : '<p class="map-info-saving muted">暂无优惠</p>';

    return `
      <div class="map-info">
        <h4>${station.name}</h4>
        <p class="map-info-meta">${station.brand} · ${formatDistance(station.distance)}</p>
        <p class="map-info-prices">92# ¥${formatPrice(station.price92)} · 95# ¥${formatPrice(station.price95)}</p>
        ${savingText}
      </div>
    `;
  },

  focusStation(stationId, stations) {
    const station = stations.find((s) => s.id === stationId);
    const marker = this.stationMarkers[stationId];
    if (!station || !marker || !this.map) return;

    this.map.setCenter([station.lng, station.lat]);
    this.map.setZoom(15);
    this.infoWindow.setContent(this.buildInfoContent(station));
    this.infoWindow.open(this.map, marker.getPosition());
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

  fitView() {
    if (!this.map) return;
    const overlays = [
      ...(this.userMarker ? [this.userMarker] : []),
      ...(this.destMarker ? [this.destMarker] : []),
      ...(this.routePolyline ? [this.routePolyline] : []),
      ...Object.values(this.stationMarkers),
    ];
    if (overlays.length) {
      this.map.setFitView(overlays, false, [60, 60, 60, 60]);
    }
  },

  drawRoute(path, destination) {
    if (!this.map || !window.AMap) return;

    this.clearRoute();

    this.routePolyline = new AMap.Polyline({
      path: path.map((p) => [p.lng, p.lat]),
      strokeColor: '#2563eb',
      strokeWeight: 6,
      strokeOpacity: 0.85,
      lineJoin: 'round',
      zIndex: 50,
    });
    this.map.add(this.routePolyline);

    this.destMarker = new AMap.Marker({
      position: [destination.lng, destination.lat],
      title: destination.name,
      content: '<div class="map-marker map-marker-dest">🎯</div>',
      offset: new AMap.Pixel(-14, -14),
      zIndex: 180,
    });
    this.map.add(this.destMarker);
    this.fitView();
  },

  clearRoute() {
    if (!this.map) return;
    if (this.routePolyline) {
      this.map.remove(this.routePolyline);
      this.routePolyline = null;
    }
    if (this.destMarker) {
      this.map.remove(this.destMarker);
      this.destMarker = null;
    }
  },
};
