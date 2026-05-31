/**
 * 云端适配器 · 阶段 2+ 实现
 * 参见 docs/API.md
 */
const CloudApiAdapter = {
  async _request(path, options = {}) {
    const base = API_CONFIG.API_BASE || '';
    if (!base) throw new Error('API_BASE not configured');
    const url = `${base.replace(/\/$/, '')}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Platform': 'web',
        'X-Client-Version': window.APP_BUILD || '',
        ...(options.headers || {}),
      },
    });
    const json = await res.json();
    if (json.code !== 0) throw new Error(json.message || 'api error');
    return json.data;
  },

  async getNearbyStations(lat, lng, options = {}) {
    const q = new URLSearchParams({ lat, lng, radius_km: options.radius_km || 50 });
    if (options.district) q.set('district', options.district);
    return this._request(`/stations/nearby?${q}`);
  },

  async submitIntel(payload) {
    return this._request('/intel/submissions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getIntelFeed(limit = 8) {
    return this._request(`/intel/feed?limit=${limit}`);
  },

  async confirmIntel(id) {
    return this._request(`/intel/submissions/${id}/confirm`, { method: 'POST' });
  },

  async getLeaderboard(limit = 5) {
    return this._request(`/leaderboard/weekly?limit=${limit}`);
  },
};
