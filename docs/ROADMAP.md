# 渐进式迁移路线图

> 原则：**保留现有 UI**，只替换数据来源；每阶段可独立上线、可回滚。

## 阶段 0：当前状态（已完成）

- [x] 静态 `mock-stations.json` + `stations-data.js`
- [x] 情报共建 `localStorage`（`cq_gas_community`）
- [x] 地图、顺路、排行、共建抽屉
- [x] 展示「每升优惠」而非对外标价

---

## 阶段 1：数据层抽象（1–2 天）

**目标**：网页行为不变，代码结构支持双数据源。

| 任务 | 说明 |
|------|------|
| 引入 `js/api/` 适配层 | `local` / `cloud` 两套实现 |
| `app.js` 的 `loadData()` 改为 `Api.getNearbyStations()` | 仍读 mock |
| `community.js` 改为调用 `Api.submitIntel` 等 | 仍写 localStorage |
| 增加 `shared/schemas/` JSON Schema | 与小程序共用类型 |

**验收**：`DATA_SOURCE=local` 时与现网完全一致。

**本仓库已 scaffold**：`js/api/`、`shared/schemas/`。

---

## 阶段 2：云数据库种子数据（2–3 天）

**目标**：云端有与 mock 等价的只读数据。

| 任务 | 说明 |
|------|------|
| 开通微信云开发或 CloudBase | 创建环境 `cq-gas-prod` |
| 编写 `scripts/migrate-seed.js` | mock-stations → stations + snapshots + benchmarks |
| 实现云函数 `stationNearby` | 返回与 GET `/stations/nearby` 一致结构 |
| Web 配置 `DATA_SOURCE=cloud` 仅读站点 | 共建仍 local |

**验收**：地图站点、优惠标签与 mock 一致；关闭网络回退 local。

---

## 阶段 3：情报上云（3–5 天）

**目标**：用户提交、feed、确认有用进云库。

| 任务 | 说明 |
|------|------|
| 云函数 `intelSubmit` / `intelFeed` / `intelConfirm` | |
| 图片走云存储 | 替换 base64 localStorage |
| 用户标识 | Web 匿名 `device_id`；小程序 `openid` |
| 积分写 `point_logs` | 提交 +10、采纳 +20 |

**验收**：多设备看到同一情报流；确认数同步。

---

## 阶段 4：审核后台（3–5 天）

**目标**：管理员审核后才更新站点 snapshot。

| 任务 | 说明 |
|------|------|
| 简单管理页或云开发控制台扩展 | 列表 pending / community_verified |
| `intelApprove` / `intelReject` | 写 audit_logs |
| 审核通过 → 更新 `station_snapshots` | 地图自动读新优惠 |
| 状态机 | pending → community_verified（≥3 确认）→ approved → merged |

**验收**：驳回情报不上地图；通过情报 5 分钟内可见。

---

## 阶段 5：微信小程序（1–2 周）

**目标**：复用 API 与 shared，最小 MVP。

| 任务 | 说明 |
|------|------|
| 新建 `miniapp/` 目录 | 原生或 uni-app |
| 地图页 | 腾讯地图 SDK + `stationNearby` |
| 共建页 | 同 Web 表单字段 |
| 登录 | 微信授权 + 云开发 |
| 积分/排行页 | `leaderboard/weekly` |

**验收**：小程序与 H5 提交同一条 intel，审核互通。

---

## 阶段 6：优化与合规（持续）

- 敏感词过滤（油价 → 优惠表述）
- 提交频控、图片鉴黄
- 站点 POI 与高德/腾讯 ID 对齐
- 缓存 CDN、Geo 索引优化
- 可选：打赏接入微信支付

---

## 风险与回滚

| 风险 | 对策 |
|------|------|
| 云函数超时 | 站点列表分页 + 缓存 |
| 审核滞后 | 保留 mock 基准展示，snapshot 过期标注 |
| 迁移中断 | `DATA_SOURCE=local` 一键回退 |

---

## 建议优先级（若时间紧）

1. **阶段 1**（必做）— 适配层  
2. **阶段 2**（高）— 站点只读上云  
3. **阶段 3**（高）— 情报提交上云  
4. **阶段 4**（中）— 审核  
5. **阶段 5**（按产品节奏）— 小程序  
