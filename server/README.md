# 服务端 / 云函数（阶段 2 起实现）

## 推荐方案

**微信云开发**（与小程序同生态）：

- 数据库：文档型集合，见 `docs/DATABASE.md`
- 云函数：`server/functions/` 各目录一个函数
- 云存储：情报图片

## 目录规划

```
server/functions/
  stationNearby/     # GET 附近油站
  intelSubmit/       # POST 提交情报
  intelFeed/         # GET 情报流
  intelConfirm/      # POST 确认有用
  intelApprove/      # POST 管理审核（需鉴权）
  authLogin/         # 登录 / openid
```

## 共享逻辑

将业务逻辑抽到 `server/shared/services/`，云函数仅做：

1. 解析 event / HTTP body  
2. 鉴权  
3. 调用 service  
4. 返回 `{ code, data }`  

H5 通过 HTTP 访问同一套 service（CloudBase HTTP 访问服务）。

## 种子数据

```bash
node scripts/migrate-seed.js --env cq-gas-prod
```

从 `data/mock-stations.json` 导入 `stations` + `station_snapshots` + `benchmarks`。
