/**
 * 本地适配器 · 对齐 docs/API.md 响应结构（简化版）
 */
const LocalApiAdapter = {
  async getNearbyStations(lat, lng, options = {}) {
    const cacheBust = window.APP_BUILD || Date.now();
    let appData;
    try {
      const res = await fetch(`./data/mock-stations.json?v=${cacheBust}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('fetch failed');
      appData = await res.json();
    } catch {
      appData = window.MOCK_STATIONS_DATA || { stations: [], benchmark: {}, fillVolume: 50 };
    }

    const stations = (appData.stations || []).map((s) => {
      const bm = appData.benchmark || {};
      const diff92 = typeof calcSavingPerLiter === 'function'
        ? calcSavingPerLiter(bm.price92, s.price92)
        : 0;
      const diff95 = typeof calcSavingPerLiter === 'function'
        ? calcSavingPerLiter(bm.price95, s.price95)
        : 0;
      return {
        ...s,
        save_92: diff92 > 0 ? diff92 : 0,
        save_95: diff95 > 0 ? diff95 : 0,
        activity_schedule: typeof getStationActivityTime === 'function'
          ? getStationActivityTime(s)
          : '',
        data_updated_at: bm.updatedAt || '',
      };
    });

    if (lat != null && lng != null && typeof calcDistanceKm === 'function') {
      stations.forEach((s) => {
        s.distance = Math.round(calcDistanceKm(lat, lng, s.lat, s.lng) * 10) / 10;
      });
    }

    return {
      benchmark: appData.benchmark,
      fill_volume: appData.fillVolume || 50,
      user_location: appData.userLocation,
      stations,
    };
  },

  _communityStore() {
    try {
      const raw = localStorage.getItem('cq_gas_community');
      const data = raw ? JSON.parse(raw) : {};
      if (!Array.isArray(data.tips)) data.tips = [];
      if (!data.contributors || typeof data.contributors !== 'object') data.contributors = {};
      return data;
    } catch {
      return { tips: [], contributors: {}, nickname: '' };
    }
  },

  _saveCommunityStore(data) {
    localStorage.setItem('cq_gas_community', JSON.stringify(data));
  },

  async submitIntel(payload) {
    const store = this._communityStore();
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const nickname = payload.nickname || store.nickname || `情报员${Math.floor(1000 + Math.random() * 9000)}`;
    const tip = {
      id,
      stationName: payload.station_name,
      station_id: payload.station_id || '',
      save92: payload.save_92 || '',
      save95: payload.save_95 || '',
      note: payload.activity_note || '',
      updatedAt: payload.reported_at || new Date().toISOString().slice(0, 10),
      nickname,
      photo: payload.photo_url || null,
      confirms: 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    store.nickname = nickname;
    store.tips.unshift(tip);
    store.tips = store.tips.slice(0, 50);
    store.contributors[nickname] = (store.contributors[nickname] || 0) + 10;
    this._saveCommunityStore(store);
    return { submission_id: id, status: 'pending', points_earned: 10 };
  },

  async getIntelFeed(limit = 8) {
    const store = this._communityStore();
    const items = store.tips.slice(0, limit).map((t) => ({
      id: t.id,
      station_name: t.stationName,
      save_92: t.save92,
      save_95: t.save95,
      activity_note: t.note,
      status: t.status === 'adopted' ? 'approved' : t.status,
      confirm_count: t.confirms || 0,
      user_nickname: t.nickname,
      reported_at: t.updatedAt,
      photo_url: t.photo,
    }));
    return { items };
  },

  async confirmIntel(id) {
    const store = this._communityStore();
    const tip = store.tips.find((t) => t.id === id);
    if (!tip) throw new Error('not found');
    const key = `cq_gas_confirmed_${id}`;
    if (sessionStorage.getItem(key)) {
      return { confirm_count: tip.confirms, status: tip.status, already: true };
    }
    sessionStorage.setItem(key, '1');
    tip.confirms = (tip.confirms || 0) + 1;
    if (tip.confirms >= 3 && tip.status === 'pending') {
      tip.status = 'adopted';
      store.contributors[tip.nickname] = (store.contributors[tip.nickname] || 0) + 20;
    }
    this._saveCommunityStore(store);
    return {
      confirm_count: tip.confirms,
      status: tip.status === 'adopted' ? 'community_verified' : tip.status,
    };
  },

  async getLeaderboard(limit = 5) {
    const defaults = [
      { name: '重庆油王', points: 128 },
      { name: '热心车主', points: 96 },
      { name: '江北老司机', points: 72 },
    ];
    const store = this._communityStore();
    const merged = [...defaults];
    Object.entries(store.contributors).forEach(([name, points]) => {
      merged.push({ name, points });
    });
    const best = new Map();
    merged.forEach((item) => {
      const prev = best.get(item.name);
      if (!prev || item.points > prev.points) best.set(item.name, { ...item });
    });
    return {
      items: Array.from(best.values())
        .sort((a, b) => b.points - a.points)
        .slice(0, limit),
    };
  },
};
