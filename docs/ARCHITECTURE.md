# 重庆加油优惠情报站 · 云数据库架构总览

## 1. 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        客户端（不变 UI）                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  Web H5      │    │ 微信小程序    │    │ 管理审核（后期）  │  │
│  │ index.html   │    │ miniapp/     │    │ admin/           │  │
│  └──────┬───────┘    └──────┬───────┘    └────────┬─────────┘  │
│         │                   │                      │            │
│         └───────────────────┼──────────────────────┘            │
│                             ▼                                   │
│                    js/api  ·  miniapp/services                  │
│                    （统一 Api 门面，DATA_SOURCE 切换）           │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
     ┌─────────────────┐            ┌─────────────────┐
     │  local 适配器    │            │  cloud 适配器    │
     │ mock-stations   │            │ HTTP / 云函数    │
     │ localStorage    │            │                 │
     └─────────────────┘            └────────┬────────┘
                                             ▼
                              ┌──────────────────────────┐
                              │  云函数 / 后端 API        │
                              │  shared/services/        │
                              └────────────┬─────────────┘
                                           ▼
                              ┌──────────────────────────┐
                              │  云数据库                 │
                              │  stations · snapshots    │
                              │  intel_* · users · logs  │
                              └──────────────────────────┘
```

## 2. 目标能力对照

| 需求 | 数据表 | 接口 | 现有实现 |
|------|--------|------|----------|
| 用户提交油价/优惠 | intel_submissions | POST /intel/submissions | community.js localStorage |
| 用户提交活动 | intel_submissions (activity_*) | 同上 | note 字段 |
| 情报审核 | status + audit_logs | POST /admin/.../approve | 3 人确认 → adopted（本地） |
| 用户积分 | users + point_logs | GET /users/me, leaderboard | contributors 对象 |
| 小程序迁移 | 同上集合 + 云函数 | wx.cloud.callFunction | 未开始 |

## 3. 推荐目录结构

```
cq-gas-helper/
├── index.html              # 现有 Web UI（不重构）
├── css/
├── js/
│   ├── app.js              # 逐步改为调用 Api.*
│   ├── map.js
│   ├── community.js
│   ├── utils.js
│   ├── config.js           # 高德 Key；可增加 API_BASE
│   └── api/                # 【新增】数据访问层
│       ├── config.js       # DATA_SOURCE, API_BASE
│       ├── index.js        # 统一门面 GasApi
│       └── adapters/
│           ├── local.js    # mock + localStorage
│           └── cloud.js    # fetch 云函数
├── data/                   # 阶段 1 保留；阶段 2 仅种子/回退
│   ├── mock-stations.json
│   └── stations-data.js
├── shared/                 # 【新增】H5 + 小程序共用
│   ├── schemas/
│   │   ├── station.json
│   │   └── intel-submission.json
│   └── constants/
│       └── intel-status.js
├── docs/
│   ├── ARCHITECTURE.md     # 本文件
│   ├── DATABASE.md
│   ├── API.md
│   └── ROADMAP.md
├── scripts/
│   ├── append-liangjiang.js
│   └── migrate-seed.js     # 【待写】导入云库
├── server/                 # 【新增】云函数/Node 后端（可选）
│   ├── README.md
│   └── functions/
│       ├── stationNearby/
│       ├── intelSubmit/
│       ├── intelFeed/
│       ├── intelConfirm/
│       └── intelApprove/
└── miniapp/                # 【新增】微信小程序（后期）
    └── README.md
```

## 4. 核心模块职责

| 模块 | 职责 |
|------|------|
| `GasApi` | 唯一数据入口；UI 只调此层 |
| `local adapter` | 兼容现网，零后端 |
| `cloud adapter` | 请求云函数，失败可 fallback local |
| `shared/schemas` | 校验提交 payload，小程序复制同目录 |
| `server/functions` | 业务逻辑：审核、积分、合并 snapshot |

## 5. 情报审核流程（目标）

```
用户提交 → pending (+10 分)
    ↓
车友确认 × N → community_verified
    ↓
管理员审核 → approved (+20 分) / rejected
    ↓
合并 snapshot → merged → 地图展示更新
```

与现网差异：现网 3 确认即 `adopted` 且无管理员；上云后 `adopted` 改为审核通过态，确认仅推进到 `community_verified`。

## 6. 配置示例

```javascript
// js/api/config.js
export const API_CONFIG = {
  DATA_SOURCE: 'local', // 'local' | 'cloud'
  API_BASE: 'https://your-env.service.tcloudbase.com/api/v1',
  CLOUD_ENV_ID: 'cq-gas-xxxx',
  FALLBACK_LOCAL: true,
};
```

## 7. 相关文档

- [DATABASE.md](./DATABASE.md) — 表结构、字段、索引
- [API.md](./API.md) — REST / 云函数接口
- [ROADMAP.md](./ROADMAP.md) — 分阶段实施计划

## 8. 合规提示

- 对外文案使用「每升优惠」「活动时间」，接口 Public 层不返回敏感标价字段。
- 用户上传图片需云存储权限控制与内容安全检测（阶段 6）。
