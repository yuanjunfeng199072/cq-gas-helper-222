/**
 * 重庆加油站省钱助手
 */
let appData = null;
let enrichedStations = [];
let currentSort = 'saving';
let routeInfo = null;

const DOM = {
  locationName: document.getElementById('location-name'),
  locationDistrict: document.getElementById('location-district'),
  locationBadge: document.getElementById('location-badge'),
  benchmark92: document.getElementById('benchmark-92'),
  benchmark95: document.getElementById('benchmark-95'),
  benchmarkMeta: document.getElementById('benchmark-meta'),
  stationList: document.getElementById('station-list'),
  stationCount: document.getElementById('station-count'),
  loading: document.getElementById('loading'),
  sortTabs: document.querySelectorAll('.sort-tab'),
  locateBtn: document.getElementById('locate-btn'),
  destinationInput: document.getElementById('destination-input'),
  routeSearchBtn: document.getElementById('route-search-btn'),
  routeResult: document.getElementById('route-result'),
  routeSortTab: document.getElementById('route-sort-tab'),
};

async function loadData() {
  try {
    const response = await fetch('./data/mock-stations.json');
    if (!response.ok) throw new Error('数据加载失败');
    appData = await response.json();
  } catch (err) {
    appData = FALLBACK_DATA;
  }
}

const FALLBACK_DATA = {
  userLocation: { name: '重庆市渝中区解放碑', district: '渝中区', lat: 29.5567, lng: 106.5745 },
  benchmark: { price92: 7.85, price95: 8.35, source: '重庆主城区域均价', updatedAt: '2025-05-25' },
  fillVolume: 50,
  stations: [
    { id: 's001', name: '中石化解放碑加油站', brand: '中石化', address: '渝中区民权路28号', lat: 29.5572, lng: 106.5773, distance: 0.8, price92: 7.72, price95: 8.22, tags: ['可开发票'] },
    { id: 's002', name: '壳牌较场口加油站', brand: '壳牌', address: '渝中区较场口得意世界B区', lat: 29.5538, lng: 106.5792, distance: 1.2, price92: 7.68, price95: 8.18, tags: ['会员优惠'] },
    { id: 's003', name: '中石油两路口加油站', brand: '中石油', address: '渝中区中山二路114号', lat: 29.5516, lng: 106.5408, distance: 1.5, price92: 7.79, price95: 8.29, tags: ['可开发票'] },
    { id: 's004', name: '民营海梠溪加油站', brand: '民营', address: '南岸区南坪东路88号', lat: 29.5301, lng: 106.5693, distance: 2.3, price92: 7.65, price95: 8.15, tags: ['价格优惠'] },
    { id: 's005', name: '中石化观音桥加油站', brand: '中石化', address: '江北区建新北路16号', lat: 29.5752, lng: 106.5318, distance: 3.8, price92: 7.75, price95: 8.25, tags: ['可开发票'] },
    { id: 's006', name: '中石油沙坪坝加油站', brand: '中石油', address: '沙坪坝区小龙坏正街168号', lat: 29.5412, lng: 106.4547, distance: 5.2, price92: 7.70, price95: 8.20, tags: ['会员日优惠'] },
    { id: 's007', name: '壳牌南滨路加油站', brand: '壳牌', address: '南岸区南滨路珊瑚都会', lat: 29.5476, lng: 106.5891, distance: 4.1, price92: 7.82, price95: 8.32, tags: ['江景站'] },
    { id: 's008', name: '民营大坪加油站', brand: '民营', address: '渝中区大坪正街118号', lat: 29.5353, lng: 106.5169, distance: 2.8, price92: 7.63, price95: 8.13, tags: ['价格优惠'] },
  ],
};

function enrichAllStations() {
  const { benchmark, fillVolume, stations } = appData;
  enrichedStations = stations.map((s) => enrichStation(s, benchmark, fillVolume));
  if (routeInfo?.path) {
    const maxDetour = AMAP_CONFIG.routeDetourKm || 1.5;
    enrichedStations = enrichedStations.map((s) => {
      const detour = Math.round(minDistanceToRouteKm(s, routeInfo.path) * 10) / 10;
      return { ...s, routeDetourKm: detour, isOnRoute: detour <= maxDetour };
    });
  }
}

function recalculateDistances() {
  const { userLocation, stations } = appData;
  appData.stations = stations.map((s) => ({
    ...s,
    distance: Math.round(calcDistanceKm(userLocation.lat, userLocation.lng, s.lat, s.lng) * 10) / 10,
  }));
  enrichAllStations();
}

function updateLocationBadge(isReal) {
  if (!DOM.locationBadge) return;
  DOM.locationBadge.textContent = isReal === null ? '定位中' : isReal ? '实时位置' : '模拟位置';
}

function renderLocation() {
  const { userLocation } = appData;
  DOM.locationName.textContent = userLocation.name;
  DOM.locationDistrict.textContent = userLocation.district || userLocation.locateHint || '';
  updateLocationBadge(userLocation.isRealLocation ?? false);
}

function setLocatingState(isLocating) {
  if (isLocating) {
    DOM.locationName.textContent = '正在定位...';
    DOM.locationDistrict.textContent = '请允许浏览器获取位置权限';
    updateLocationBadge(null);
    if (DOM.locateBtn) { DOM.locateBtn.disabled = true; DOM.locateBtn.textContent = '定位中...'; }
  } else if (DOM.locateBtn) {
    DOM.locateBtn.disabled = false;
    DOM.locateBtn.textContent = '重新定位';
  }
}

function applyUserLocation(location, { isFallback = false } = {}) {
  appData.userLocation = { ...appData.userLocation, ...location, isRealLocation: !isFallback, locateHint: isFallback ? '定位失败，显示默认位置' : '' };
  recalculateDistances();
  renderLocation();
  renderStations();
  if (GasMap.ready) { GasMap.setUserMarker(appData.userLocation); GasMap.centerOnUser(appData.userLocation); GasMap.fitView(); }
}

async function requestRealLocation({ alertOnFail = false } = {}) {
  if (!GasMap.isConfigured()) { if (alertOnFail) alert('请先配置高德 Key'); return false; }
  setLocatingState(true);
  try {
    applyUserLocation(await GasMap.locateUser());
    return true;
  } catch (err) {
    if (alertOnFail) alert(`定位失败：${err.message}`);
    else applyUserLocation(appData.userLocation, { isFallback: true });
    return false;
  } finally { setLocatingState(false); }
}

function renderBenchmark() {
  const { benchmark, fillVolume } = appData;
  DOM.benchmark92.textContent = formatPrice(benchmark.price92);
  DOM.benchmark95.textContent = formatPrice(benchmark.price95);
  DOM.benchmarkMeta.textContent = `${benchmark.source} · 更新于 ${benchmark.updatedAt} · 节省按 ${fillVolume}L 估算`;
}

function renderRouteResult() {
  if (!DOM.routeResult) return;
  if (!routeInfo?.best) {
    DOM.routeResult.classList.add('hidden');
    DOM.routeResult.innerHTML = '';
    if (DOM.routeSortTab) DOM.routeSortTab.classList.add('hidden');
    return;
  }
  const s = routeInfo.best;
  DOM.routeResult.classList.remove('hidden');
  DOM.routeResult.innerHTML = `
    <div class="route-result-header">
      <span class="route-result-badge">🏆 顺路最省钱</span>
      <span class="route-result-meta">至 ${routeInfo.destination.name} · 全程 ${routeInfo.distanceKm}km · 约 ${routeInfo.durationMin}分钟</span>
    </div>
    <h3 class="route-result-name">${s.name}</h3>
    <p class="route-result-detail">${s.brand} · 偏离路线 ${formatDistance(s.routeDetourKm)} · 92# ¥${formatPrice(s.price92)} · 95# ¥${formatPrice(s.price95)}</p>
    <p class="route-result-saving">预计节省 <strong>${formatMoney(s.maxSaving)}</strong></p>
    <button type="button" class="route-view-btn" data-id="${s.id}">在地图上查看</button>
  `;
  if (DOM.routeSortTab) DOM.routeSortTab.classList.remove('hidden');
  DOM.routeResult.querySelector('.route-view-btn')?.addEventListener('click', () => {
    if (GasMap.ready) { GasMap.focusStation(s.id, enrichedStations); GasMap.highlightListCard(s.id); }
  });
}

function renderStationCard(station, { isBestDeal = false, isRouteBest = false } = {}) {
  const savingsHtml = station.maxSaving > 0 ? `<div class="savings-amount">${formatMoney(station.maxSaving)}</div>` : `<div class="savings-amount no-savings">暂无优惠</div>`;
  const p92 = station.isCheaper92 ? 'cheaper' : station.diff92 < 0 ? 'expensive' : '';
  const p95 = station.isCheaper95 ? 'cheaper' : station.diff95 < 0 ? 'expensive' : '';
  const tagsHtml = station.tags.map((t) => `<span class="tag">${t}</span>`).join('');
  const routeTag = station.isOnRoute && !isRouteBest ? `<span class="tag tag-route">顺路 ${formatDistance(station.routeDetourKm)}</span>` : '';
  const topTag = isRouteBest ? `<div class="best-deal-tag route-best-tag">🚗 顺路最省</div>` : isBestDeal && !routeInfo ? `<div class="best-deal-tag">🏆 最省钱</div>` : '';
  const cls = ['station-card', isRouteBest ? 'route-best-deal' : isBestDeal && !routeInfo ? 'best-deal' : '', station.isOnRoute ? 'on-route' : ''].filter(Boolean).join(' ');
  return `<article class="${cls}" data-id="${station.id}">${topTag}<div class="station-header"><div class="station-info"><h3 class="station-name">${station.name}</h3><div class="station-meta"><span class="station-brand">${station.brand}</span><span class="station-distance">📍 ${formatDistance(station.distance)}</span>${routeTag}</div><p class="station-address">${station.address}</p></div><div class="savings-badge"><div class="savings-label">预计节省</div>${savingsHtml}</div></div><div class="price-row"><div class="price-item"><span class="price-fuel">92#</span><span class="price-value ${p92}">&yen;${formatPrice(station.price92)}</span></div><div class="price-item"><span class="price-fuel">95#</span><span class="price-value ${p95}">&yen;${formatPrice(station.price95)}</span></div></div><div class="station-tags">${tagsHtml}</div></article>`;
}

function renderStations() {
  const sorted = sortStations(enrichedStations, currentSort);
  const bestSaving = Math.max(...sorted.map((s) => s.maxSaving));
  const routeBestId = routeInfo?.best?.id;
  DOM.stationCount.textContent = routeInfo ? `共 ${sorted.length} 站 · 顺路 ${routeInfo.onRouteCount} 站` : `共 ${sorted.length} 站`;
  DOM.stationList.innerHTML = sorted.map((s) => renderStationCard(s, { isBestDeal: s.maxSaving === bestSaving && bestSaving > 0, isRouteBest: s.id === routeBestId })).join('');
  if (GasMap.ready) {
    const onRouteIds = enrichedStations.filter((s) => s.isOnRoute).map((s) => s.id);
    GasMap.setStationMarkers(sorted, { onRouteBestId: routeBestId, onRouteIds });
  }
  renderRouteResult();
}

function bindSortTabs() {
  DOM.sortTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      DOM.sortTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentSort = tab.dataset.sort;
      renderStations();
    });
  });
}

function bindStationList() {
  DOM.stationList.addEventListener('click', (e) => {
    const card = e.target.closest('.station-card');
    if (!card || !GasMap.ready) return;
    GasMap.focusStation(card.dataset.id, enrichedStations);
    GasMap.highlightListCard(card.dataset.id);
  });
}

function bindLocateBtn() {
  DOM.locateBtn?.addEventListener('click', () => requestRealLocation({ alertOnFail: true }));
}

async function searchOnRouteBest() {
  const destText = DOM.destinationInput?.value.trim();
  if (!destText) { alert('请输入目的地'); return; }
  if (!GasMap.isConfigured()) { alert('请先配置高德 Key'); return; }

  DOM.routeSearchBtn.disabled = true;
  DOM.routeSearchBtn.textContent = '规划路线中...';

  try {
    const destination = await GasRoute.geocodeAddress(destText);
    const origin = appData.userLocation;
    const route = await GasRoute.planRoute(origin, destination);
    GasRoute.path = route.path;
    GasRoute.destination = destination;
    routeInfo = { path: route.path, destination, distanceKm: route.distanceKm, durationMin: route.durationMin, ...GasRoute.analyze(enrichedStations, route.path) };
    routeInfo.onRouteCount = routeInfo.onRoute.length;

  if (!routeInfo.best) {
      alert(`路线周边（偏离 ≤ ${routeInfo.maxDetourKm}km）未找到加油站，可尝试换个目的地`);
    }

    enrichAllStations();
    if (GasMap.ready) GasMap.drawRoute(route.path, destination);
    currentSort = 'route';
    DOM.sortTabs.forEach((t) => t.classList.toggle('active', t.dataset.sort === 'route'));
    renderStations();
    if (routeInfo.best && GasMap.ready) { GasMap.focusStation(routeInfo.best.id, enrichedStations); }
  } catch (err) {
    alert(`顺路分析失败：${err.message}`);
  } finally {
    DOM.routeSearchBtn.disabled = false;
    DOM.routeSearchBtn.textContent = '查找顺路最省钱';
  }
}

function bindRouteForm() {
  DOM.routeSearchBtn?.addEventListener('click', searchOnRouteBest);
  DOM.destinationInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchOnRouteBest(); });
}

async function initMap() {
  const ok = await GasMap.init(appData.userLocation, enrichedStations);
  if (!ok && DOM.locateBtn) DOM.locateBtn.disabled = true;
}

async function init() {
  await loadData();
  enrichAllStations();
  setLocatingState(true);
  renderBenchmark();
  bindSortTabs();
  bindStationList();
  bindLocateBtn();
  bindRouteForm();
  await initMap();
  const located = await requestRealLocation({ alertOnFail: false });
  if (!located) { renderLocation(); renderStations(); }
  DOM.loading.style.display = 'none';
  DOM.stationList.style.display = 'flex';
}

document.addEventListener('DOMContentLoaded', init);
