# 微信小程序（阶段 5）

## 与 Web 共用

| 资源 | 路径 |
|------|------|
| 数据契约 | `docs/API.md` |
| 状态常量 | `shared/constants/intel-status.js` |
| JSON Schema | `shared/schemas/` |
| 业务云函数 | `server/functions/` |

## 建议技术栈

- 原生小程序 + 腾讯地图插件，或 uni-app 编译到微信
- `wx.cloud.init({ env: API_CONFIG.CLOUD_ENV_ID })`
- 页面：地图首页、情报共建、排行、我的积分

## Api 调用示例

```javascript
// miniapp/services/api.js
async function getNearbyStations(lat, lng) {
  const { result } = await wx.cloud.callFunction({
    name: 'stationNearby',
    data: { lat, lng },
  });
  return result.data;
}
```

与 Web 的 `GasApi.getNearbyStations` 返回结构保持一致。
