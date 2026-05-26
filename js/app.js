/**
 * 重庆加油优惠情报站
 */
let appData = null;
let enrichedStations = [];
let routeInfo = null;
let rankFuelTab = '92';
let sheetOpen = false;
let selectedDestTip = null;
let destSuggestTimer = null;
let destSuggestSeq = 0;

const DOM = {
  locationName: document.getElementById('location-name'),
  locationBadge: document.getElementById('location-badge'),
  destinationInput: document.getElementById('destination-input'),
  destSuggestions: document.getElementById('dest-suggestions'),
  routeSearchBtn: document.getElementById('route-search-btn'),
  locateBtn: document.getElementById('locate-btn'),
  routeResult: document.getElementById('route-result'),
  rankSheet: document.getElementById('rank-sheet'),
  sheetBackdrop: document.getElementById('sheet-backdrop'),
  sheetClose: document.getElementById('sheet-close'),
  toggleRankBtn: document.getElementById('toggle-rank-btn'),
  feedbackBtn: document.getElementById('feedback-btn'),
  rankList: document.getElementById('rank-list'),
  rankFuelTabs: document.querySelectorAll('.rank-fuel-tab'),
  stationList: document.getElementById('station-list'),
  loading: document.getElementById('loading'),
};

async function loadData() {
  const cacheBust = window.APP_BUILD || Date.now();
  try {
    const res = await fetch(`./data/mock-stations.json?v=${cacheBust}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('fetch failed');
    appData = await res.json();
  } catch {
    appData = window.MOCK_STATIONS_DATA || FALLBACK_DATA;
  }
}

const FALLBACK_DATA = {
  userLocation: { name: '重庆市渝中区解放碑', district: '渝中区', lat: 29.5567, lng: 106.5745 },
  benchmark: { price92: 7.85, price95: 8.35, source: '重庆主城区域均价', updatedAt: '2025-05-25' },
  fillVolume: 50,
  stations: [
    { id: 's001', name: '中石化解放碑加油站', brand: '中石化', address: '渝中区民权路28号', lat: 29.5572, lng: 106.5773, distance: 0.8, price92: 7.72, price95: 8.22, tags: [] },
    { id: 's002', name: '壳牌较场口加油站', brand: '壳牌', address: '渝中区较场口', lat: 29.5538, lng: 106.5792, distance: 1.2, price92: 7.68, price95: 8.18, tags: [] },
    { id: 's004', name: '民营海棠溪加油站', brand: '民营', address: '南岸区南坪东路88号', lat: 29.5301, lng: 106.5693, distance: 2.3, price92: 7.65, price95: 8.15, tags: [] },
    { id: 's008', name: '民营大坪加油站', brand: '民营', address: '渝中区大坪正街118号', lat: 29.5353, lng: 106.5169, distance: 2.8, price92: 7.63, price95: 8.13, tags: [] },
    { id: 's009', name: '中石化江北嘴加油站', brand: '中石化', address: '两江新区江北嘴', lat: 29.5685, lng: 106.5812, distance: 1.6, price92: 7.71, price95: 8.21, tags: [] },
  ],
};

function enrichAllStations() {
  const { benchmark, fillVolume, stations } = appData;
  enrichedStations = stations.map((s) => enrichStation(s, benchmark, fillVolume));
  if (routeInfo?.path) {
    const maxDetour = AMAP_CONFIG.routeDetourKm || 3;
    const recommendedIds = new Set((routeInfo.recommended || routeInfo.onRoute || []).map((s) => s.id));
    enrichedStations = enrichedStations.map((s) => {
      const detour = Math.round(minDistanceToRouteKm(s, routeInfo.path) * 10) / 10;
      const rankIndex = (routeInfo.recommended || []).findIndex((r) => r.id === s.id);
      return {
        ...s,
        routeDetourKm: detour,
        isRouteRecommended: recommendedIds.has(s.id),
        routeRecommendRank: rankIndex >= 0 ? rankIndex + 1 : 0,
        isOnRoute: recommendedIds.has(s.id) && detour <= maxDetour,
      };
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
  DOM.locationBadge.textContent = isReal === null ? '定位中' : isReal ? '实时' : '模拟';
}

function renderLocation() {
  const { userLocation } = appData;
  const short = userLocation.name.length > 18
    ? `${userLocation.name.slice(0, 18)}…`
    : userLocation.name;
  DOM.locationName.textContent = short;
  DOM.locationName.title = userLocation.name;
  updateLocationBadge(userLocation.isRealLocation ?? false);
}

function setLocatingState(on) {
  if (on) {
    DOM.locationName.textContent = '正在定位...';
    updateLocationBadge(null);
    if (DOM.locateBtn) { DOM.locateBtn.disabled = true; DOM.locateBtn.textContent = '…'; }
  } else if (DOM.locateBtn) {
    DOM.locateBtn.disabled = false;
    DOM.locateBtn.textContent = '定位';
  }
}

function applyUserLocation(loc, { isFallback = false } = {}) {
  appData.userLocation = { ...appData.userLocation, ...loc, isRealLocation: !isFallback };
  recalculateDistances();
  renderLocation();
  renderAll();
  if (GasMap.ready) {
    GasMap.setUserMarker(appData.userLocation);
    GasMap.fitView();
  }
}

async function requestRealLocation({ alertOnFail = false } = {}) {
  if (!GasMap.isConfigured()) {
    if (alertOnFail) alert('请先配置高德 Key');
    return false;
  }
  setLocatingState(true);
  try {
    applyUserLocation(await GasMap.locateUser());
    return true;
  } catch (err) {
    if (alertOnFail) alert(`定位失败：${err.message}`);
    else applyUserLocation(appData.userLocation, { isFallback: true });
    return false;
  } finally {
    setLocatingState(false);
  }
}

function renderRankList() {
  const ranked = rankStationsByFuel(enrichedStations, rankFuelTab);
  if (!ranked.length) {
    DOM.rankList.innerHTML = `<li class="rank-empty">附近暂无${rankFuelTab}#优惠站点</li>`;
    return;
  }
  DOM.rankList.innerHTML = ranked.map((s, i) => `
    <li class="rank-item" data-id="${s.id}">
      <span class="rank-no">${i + 1}</span>
      <span class="rank-name">${s.name}</span>
      <span class="rank-save">${formatSavingPerLiter(rankFuelTab === '95' ? s.diff95 : s.diff92)}</span>
      <span class="rank-dist">${formatDistance(s.distance)}</span>
    </li>
  `).join('');
}

function renderStationCard(station) {
  return `
    <article class="station-card" data-id="${station.id}">
      <div class="card-row">
        <h3 class="card-name">${station.name}</h3>
        <span class="card-dist">${formatDistance(station.distance)}</span>
      </div>
      <div class="card-savings">
        <span class="card-save">92# ${formatSavingPerLiter(station.diff92)}</span>
        <span class="card-save">95# ${formatSavingPerLiter(station.diff95)}</span>
      </div>
    </article>
  `;
}

function renderStationList() {
  const list = [...enrichedStations]
    .sort((a, b) => Math.max(b.diff92, b.diff95) - Math.max(a.diff92, a.diff95) || a.distance - b.distance);
  DOM.stationList.innerHTML = list.map((s) => renderStationCard(s)).join('');
}

function renderRouteChip() {
  if (!DOM.routeResult) return;
  if (!routeInfo?.destination) {
    DOM.routeResult.classList.add('hidden');
    return;
  }

  const destName = routeInfo.destination.inputName || routeInfo.destination.name;
  const distText = routeInfo.distanceKm ? `${routeInfo.distanceKm}km · 约${routeInfo.durationMin}分钟` : '';
  DOM.routeResult.classList.remove('hidden');
  DOM.routeResult.innerHTML = `前往「${destName}」${distText ? ` · ${distText}` : ''}`;
  DOM.routeResult.onclick = () => {
    if (GasMap.ready) GasMap.fitRouteView();
  };
}

function renderMapMarkers() {
  if (!GasMap.ready) return;
  const recommended = routeInfo?.recommended || [];
  const recommendedIds = recommended.map((s) => s.id);
  const recommendRanks = Object.fromEntries(recommended.map((s, i) => [s.id, i + 1]));
  const routeMode = Boolean(routeInfo?.path);

  GasMap.setStationMarkers(enrichedStations, {
    routeMode,
    onRouteBestId: routeInfo?.best?.id || null,
    onRouteIds: recommendedIds,
    recommendRanks,
  });
}

function renderAll() {
  renderRankList();
  renderStationList();
  renderRouteChip();
  renderMapMarkers();
}

function openRankSheet() {
  sheetOpen = true;
  DOM.rankSheet?.classList.add('open');
  DOM.rankSheet?.setAttribute('aria-hidden', 'false');
  DOM.sheetBackdrop?.classList.remove('hidden');
}

function closeRankSheet() {
  sheetOpen = false;
  DOM.rankSheet?.classList.remove('open');
  DOM.rankSheet?.setAttribute('aria-hidden', 'true');
  DOM.sheetBackdrop?.classList.add('hidden');
}

function bindRankSheet() {
  DOM.toggleRankBtn?.addEventListener('click', () => {
    if (sheetOpen) closeRankSheet();
    else openRankSheet();
  });
  DOM.sheetClose?.addEventListener('click', closeRankSheet);
  DOM.sheetBackdrop?.addEventListener('click', closeRankSheet);
  DOM.rankFuelTabs?.forEach((tab) => {
    tab.addEventListener('click', () => {
      DOM.rankFuelTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      rankFuelTab = tab.dataset.fuel;
      renderRankList();
    });
  });
  DOM.rankList?.addEventListener('click', (e) => {
    const item = e.target.closest('.rank-item');
    if (!item) return;
    const id = item.dataset.id;
    if (GasMap.ready) {
      GasMap.focusStation(id, enrichedStations);
      closeRankSheet();
    }
  });
  DOM.stationList?.addEventListener('click', (e) => {
    const card = e.target.closest('.station-card');
    if (!card) return;
    const id = card.dataset.id;
    const station = enrichedStations.find((s) => s.id === id);
    if (GasMap.ready && station) {
      GasMap.focusStation(id, enrichedStations);
      closeRankSheet();
    }
  });
}

function hideDestSuggestions() {
  DOM.destSuggestions?.classList.add('hidden');
  DOM.destinationInput?.setAttribute('aria-expanded', 'false');
}

function showDestSuggestions() {
  DOM.destSuggestions?.classList.remove('hidden');
  DOM.destinationInput?.setAttribute('aria-expanded', 'true');
}

function renderDestSuggestions(tips) {
  if (!DOM.destSuggestions) return;
  if (!tips.length) {
    hideDestSuggestions();
    DOM.destSuggestions.innerHTML = '';
    return;
  }

  DOM.destSuggestions.innerHTML = tips.map((tip, index) => {
    const meta = [tip.district, tip.address].filter(Boolean).join(' · ');
    return `
      <li class="dest-suggestion" role="option" data-index="${index}">
        <span class="dest-suggestion-name">${escapeHtml(tip.name)}</span>
        ${meta ? `<span class="dest-suggestion-meta">${escapeHtml(meta)}</span>` : ''}
      </li>
    `;
  }).join('');
  showDestSuggestions();
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function selectDestSuggestion(tip) {
  if (!tip || !DOM.destinationInput) return;
  selectedDestTip = tip;
  DOM.destinationInput.value = tip.name;
  DOM.destinationInput.title = [tip.district, tip.address].filter(Boolean).join(' ') || tip.name;
  hideDestSuggestions();
}

async function fetchDestSuggestions(keyword) {
  if (!GasMap.isConfigured() || keyword.length < 2) {
    hideDestSuggestions();
    return;
  }

  const seq = ++destSuggestSeq;
  try {
    await GasMap.ensureAmapLoaded();
    const tips = await GasRoute.searchSuggestions(keyword);
    if (seq !== destSuggestSeq) return;
    if (keyword !== DOM.destinationInput?.value.trim()) return;
    renderDestSuggestions(tips);
  } catch {
    if (seq === destSuggestSeq) hideDestSuggestions();
  }
}

function bindDestAutocomplete() {
  if (!DOM.destinationInput) return;

  DOM.destinationInput.addEventListener('input', () => {
    selectedDestTip = null;
    const keyword = DOM.destinationInput.value.trim();
    clearTimeout(destSuggestTimer);
    if (keyword.length < 2) {
      hideDestSuggestions();
      return;
    }
    destSuggestTimer = setTimeout(() => fetchDestSuggestions(keyword), 280);
  });

  DOM.destinationInput.addEventListener('focus', () => {
    const keyword = DOM.destinationInput.value.trim();
    if (keyword.length >= 2) fetchDestSuggestions(keyword);
  });

  DOM.destinationInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideDestSuggestions();
      return;
    }
    if (e.key === 'Enter') {
      if (!DOM.destSuggestions?.classList.contains('hidden') && GasRoute.lastSuggestions?.length && !selectedDestTip) {
        selectDestSuggestion(GasRoute.lastSuggestions[0]);
      }
      hideDestSuggestions();
      searchOnRouteBest();
    }
  });

  DOM.destSuggestions?.addEventListener('mousedown', (e) => {
    const item = e.target.closest('.dest-suggestion');
    if (!item) return;
    e.preventDefault();
    const index = Number(item.dataset.index);
    const tips = GasRoute.lastSuggestions || [];
    if (tips[index]) selectDestSuggestion(tips[index]);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dest-bar-wrap')) hideDestSuggestions();
  });
}

function bindFeedback() {
  DOM.feedbackBtn?.addEventListener('click', () => {
    const msg = prompt('请输入您的意见或建议（模拟反馈）：');
    if (msg?.trim()) alert('感谢您的反馈，我们已记录！');
  });
}

async function searchOnRouteBest() {
  const destText = DOM.destinationInput?.value.trim();
  if (!destText) { alert('请输入目的地'); return; }
  if (!GasMap.isConfigured()) { alert('请先配置高德 Key'); return; }

  DOM.routeSearchBtn.disabled = true;
  DOM.routeSearchBtn.textContent = '…';
  try {
    const destination = await GasRoute.resolveDestination(destText, selectedDestTip);
    selectedDestTip = null;
    hideDestSuggestions();
    const route = await GasRoute.planRoute(appData.userLocation, destination);
    routeInfo = {
      path: route.path,
      destination,
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      ...GasRoute.analyze(enrichedStations, route.path),
    };
    routeInfo.onRouteCount = routeInfo.onRoute.length;
    GasRoute.destination = destination;

    if (DOM.destinationInput) {
      DOM.destinationInput.value = destination.inputName;
      DOM.destinationInput.title = destination.formattedAddress || destination.inputName;
    }

    if (!routeInfo.recommended?.length) {
      alert(`前往「${destination.inputName}」的路线已规划，3km绕路范围内暂无顺路优惠加油站`);
    }
    enrichAllStations();
    if (GasMap.ready) GasMap.drawRoute(route.path, destination, routeInfo.recommended || []);
    renderAll();
    if (GasMap.ready && routeInfo.path) GasMap.fitRouteView();
  } catch (err) {
    alert(`顺路分析失败：${err.message}`);
  } finally {
    DOM.routeSearchBtn.disabled = false;
    DOM.routeSearchBtn.textContent = '顺路';
  }
}

function bindEvents() {
  DOM.locateBtn?.addEventListener('click', () => requestRealLocation({ alertOnFail: true }));
  document.getElementById('fit-liangjiang-btn')?.addEventListener('click', () => {
    if (GasMap.ready) GasMap.fitDistrict('两江新区');
  });
  DOM.routeSearchBtn?.addEventListener('click', searchOnRouteBest);
  bindDestAutocomplete();
  bindRankSheet();
  bindFeedback();
}

async function init() {
  await loadData();
  enrichAllStations();
  setLocatingState(true);
  bindEvents();
  const ok = await GasMap.init(appData.userLocation, enrichedStations);
  if (!ok && DOM.locateBtn) DOM.locateBtn.disabled = true;
  const located = await requestRealLocation({ alertOnFail: false });
  if (!located) {
    renderLocation();
    renderAll();
  }
  DOM.loading?.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', init);
