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
  plugins: ['AMap.Geolocation', 'AMap.Geocoder', 'AMap.Scale', 'AMap.ToolBar', 'AMap.Driving'],
  routeDetourKm: 1.5,
};
