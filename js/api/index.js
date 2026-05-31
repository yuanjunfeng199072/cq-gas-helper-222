/**
 * 统一数据门面 · Web / 小程序共用契约（docs/API.md）
 */
const GasApi = {
  _adapter() {
    return API_CONFIG.DATA_SOURCE === 'cloud' ? CloudApiAdapter : LocalApiAdapter;
  },

  async _withFallback(method, args) {
    const adapter = this._adapter();
    try {
      return await adapter[method](...args);
    } catch (err) {
      console.warn(`GasApi.${method} failed:`, err);
      if (API_CONFIG.DATA_SOURCE === 'cloud' && API_CONFIG.FALLBACK_LOCAL) {
        return LocalApiAdapter[method](...args);
      }
      throw err;
    }
  },

  getNearbyStations(lat, lng, options) {
    return this._withFallback('getNearbyStations', [lat, lng, options]);
  },

  submitIntel(payload) {
    return this._withFallback('submitIntel', [payload]);
  },

  getIntelFeed(limit) {
    return this._withFallback('getIntelFeed', [limit]);
  },

  confirmIntel(id) {
    return this._withFallback('confirmIntel', [id]);
  },

  getLeaderboard(limit) {
    return this._withFallback('getLeaderboard', [limit]);
  },
};
