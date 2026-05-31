/**
 * 高德地图配置
 * 1. 前往 https://console.amap.com/ 注册并创建应用
 * 2. 添加 Key，服务平台选择「Web端(JS API)」
 * 3. 将 Key 填入下方 key 字段
 * 4. 若控制台启用了「安全密钥」，填入 securityJsCode
 */
const AMAP_CONFIG = {
  key: 'f6c15fef26ccfc172c4a2bc5b75cfc96',
  securityJsCode: '624f58a06409da8057e808f92529bd61',
  version: '2.0',
  plugins: ['AMap.Geolocation', 'AMap.Geocoder', 'AMap.PlaceSearch', 'AMap.AutoComplete', 'AMap.Scale', 'AMap.ToolBar', 'AMap.Driving'],
  routeDetourKm: 3,
  routeRecommendMax: 3,
  markerZoomThreshold: 11,
  fitViewRadiusKm: 12,
};

/** 应用配置（提交表单等） */
const APP_CONFIG = {
  /** 外部问卷链接，留空则仅使用站内临时表单 */
  submitFormUrl: '',
};

/**
 * Google Sheets 数据源（替换 mock-stations.json）
 *
 * 使用步骤见 docs/GOOGLE_SHEETS.md
 *
 * 1. 将 enabled 改为 true
 * 2. 复制示例表格结构，填入 spreadsheetId
 * 3. 或使用 Google Cloud API Key → 填写 apiKey，走 Sheets API v4
 */
const SHEETS_CONFIG = {
  enabled: false,

  /** 表格 ID：从 URL 中获取
   * https://docs.google.com/spreadsheets/d【这一段就是 ID】/edit */
  spreadsheetId: 'YOUR_SPREADSHEET_ID',

  /** 表格完整链接（仅用于展示，可选） */
  spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit',

  /** 工作表 gid（标签页），默认 0；CSV 导出时使用 */
  gid: '0',

  /** API 读取范围（仅 API 模式），默认第一个工作表 A:Z */
  range: 'Sheet1!A:Z',

  /** Google Cloud 控制台申请的 API Key（可选，留空则用 CSV） */
  apiKey: '',

  /** 区域基准价（也可在表格 meta 行扩展，当前用配置） */
  benchmark: {
    price92: 7.85,
    price95: 8.35,
    source: '重庆主城区域均价',
    updatedAt: '2025-05-26',
  },

  /** 展示用的数据更新日期（可选，留空则取表格内 lastUpdated 最新值） */
  dataUpdatedAt: '',

  fillVolume: 50,

  userLocation: {
    name: '重庆市渝中区解放碑',
    district: '渝中区',
    lat: 29.5567,
    lng: 106.5745,
  },
};
