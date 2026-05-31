/**
 * 数据源配置 · 渐进迁移开关
 * local = mock-stations.json + localStorage（当前默认）
 * cloud = 云函数 / REST API（阶段 2+ 启用）
 */
const API_CONFIG = {
  DATA_SOURCE: 'local',
  API_BASE: '',
  CLOUD_ENV_ID: '',
  /** 云端失败时是否回退本地 */
  FALLBACK_LOCAL: true,
  /** 提交频控（毫秒），云端由服务端二次校验 */
  SUBMIT_COOLDOWN_MS: 60000,
};
