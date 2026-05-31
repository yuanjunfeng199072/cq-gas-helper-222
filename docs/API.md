# API 接口设计（v1）

> 基础路径：`/api/v1`  
> Web 与小程序共用；小程序通过 `wx.cloud.callFunction` 转发到同一云函数路由。

## 通用约定

### 请求头

| Header | 说明 |
|--------|------|
| `Authorization` | `Bearer <token>`，小程序为云开发自动鉴权 |
| `X-Platform` | `web` \| `mp-weixin` |
| `X-Client-Version` | 对应 `APP_BUILD` |

### 响应格式

```json
{
  "code": 0,
  "message": "ok",
  "data": { }
}
```

| code | 含义 |
|------|------|
| 0 | 成功 |
| 40001 | 参数错误 |
| 40100 | 未登录 |
| 40300 | 无权限 |
| 40400 | 资源不存在 |
| 42900 | 提交过于频繁 |
| 50000 | 服务器错误 |

### 敏感字段策略

- **公开接口**不返回 `price_92` / `price_95`，只返回 `save_92`、`save_95`、`activity_schedule`、`activity_note`。
- 管理端 `/admin/*` 可返回完整价格。

---

## 1. 油站与地图数据

### GET `/stations/nearby`

附近油站（替代 mock-stations 主列表）。

**Query**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| lat | number | ✓ | |
| lng | number | ✓ | |
| radius_km | number | | 默认 50 |
| district | string | | 筛选区县 |
| limit | number | | 默认 200 |

**Response.data**

```json
{
  "benchmark": {
    "region_id": "chongqing_main",
    "save_display_mode": "per_liter",
    "price_92": 7.85,
    "price_95": 8.35,
    "updated_at": "2025-05-26"
  },
  "fill_volume": 50,
  "stations": [
    {
      "id": "s001",
      "name": "中石化解放碑加油站",
      "brand": "中石化",
      "address": "渝中区民权路28号",
      "district": "渝中区",
      "lat": 29.5572,
      "lng": 106.5773,
      "distance": 0.8,
      "save_92": 0.13,
      "save_95": 0.13,
      "activity_schedule": "每周一、三、五",
      "activity_note": "",
      "data_updated_at": "2025-05-26",
      "open_hours": "24小时",
      "tags": ["可开发票"]
    }
  ]
}
```

> 前端 `enrichStation` 可继续用 benchmark 算 diff/saving，或直接使用 `save_*`。

---

### GET `/stations/:id`

单个油站详情 + 最新 snapshot。

---

### GET `/benchmarks/current`

**Query**：`region_id`（默认重庆主城）

---

## 2. 情报提交（用户共建）

### POST `/intel/submissions`

提交油价优惠 / 活动（对应现有情报共建表单）。

**Body**

```json
{
  "station_id": "s001",
  "station_name": "中石化解放碑加油站",
  "submit_type": "mixed",
  "save_92": "-0.28",
  "save_95": "-0.30",
  "activity_schedule": "每周一、三、五",
  "activity_note": "夜间满200减20",
  "reported_at": "2025-05-26",
  "photo_file_id": "cloud://xxx.jpg"
}
```

**规则**

- `station_name` 必填；`station_id` 可选（未匹配时仅记站名，审核时关联）。
- `submit_type=price` 时至少 `save_92` 或 `save_95` 之一。
- `submit_type=activity` 时至少 `activity_schedule` 或 `activity_note`。
- 频率限制：同一用户 5 分钟内最多 3 条。

**Response**

```json
{
  "submission_id": "intel_xxx",
  "status": "pending",
  "points_earned": 10
}
```

---

### POST `/intel/submissions/:id/photo`

上传图片（multipart 或云存储直传后传 file_id）。

---

### GET `/intel/feed`

最新情报流（共建抽屉列表）。

**Query**：`limit=8`, `status=pending,community_verified`（公开仅展示待确认/已采纳摘要）

**Response**

```json
{
  "items": [
    {
      "id": "intel_xxx",
      "station_name": "中石化礼嘉",
      "save_92": "-0.28",
      "save_95": "",
      "activity_note": "满减",
      "status": "pending",
      "confirm_count": 2,
      "user_nickname": "情报员1234",
      "reported_at": "2025-05-26",
      "photo_url": "https://..."
    }
  ]
}
```

---

### POST `/intel/submissions/:id/confirm`

「确认有用」（对应现有 confirmTip）。

**Response**：`{ "confirm_count": 3, "status": "community_verified" }`

---

## 3. 审核（管理端 / 云函数后台）

### GET `/admin/intel/submissions`

**Query**：`status=pending`, `page`, `page_size`

**权限**：`role=reviewer|admin`

---

### POST `/admin/intel/submissions/:id/approve`

合并到 `station_snapshots`，写 `audit_logs`，发放 `points_adopted`。

**Body**：`{ "remark": "" }`

---

### POST `/admin/intel/submissions/:id/reject`

**Body**：`{ "reject_reason": "信息不完整" }`

---

## 4. 用户与积分

### POST `/auth/login`

| 平台 | 方式 |
|------|------|
| 小程序 | `code` 换 `openid`，云开发自动 |
| Web | 匿名 `device_id` 或微信扫码登录（后期） |

**Response**：`{ "token", "user": { "id", "nickname", "points_total" } }`

---

### GET `/users/me`

当前用户信息与积分。

---

### GET `/leaderboard/weekly`

情报员排行榜（替代 defaultLeaderboard + contributors）。

**Query**：`limit=5`

---

### GET `/users/me/point-logs`

积分流水，分页。

---

## 5. 云函数路由映射（微信小程序）

| HTTP 路径 | 云函数名 |
|-----------|----------|
| GET stations/nearby | `stationNearby` |
| POST intel/submissions | `intelSubmit` |
| POST intel/.../confirm | `intelConfirm` |
| GET intel/feed | `intelFeed` |
| POST admin/.../approve | `intelApprove` |

云函数内统一调用 `shared/services/*.js`，避免 H5 与小程序各写一套逻辑。

---

## 6. Web 渐进适配（当前项目）

在 `js/api/` 增加适配层，不改 UI：

| 方法 | 本地模式 | 云端模式 |
|------|----------|----------|
| `getNearbyStations(lat,lng)` | fetch mock-stations.json | GET /stations/nearby |
| `submitIntel(payload)` | localStorage | POST /intel/submissions |
| `getIntelFeed()` | localStorage | GET /intel/feed |
| `confirmIntel(id)` | localStorage | POST .../confirm |
| `getLeaderboard()` | 默认+local | GET /leaderboard/weekly |

配置开关见 `js/api/config.js`：`DATA_SOURCE=local|cloud`。
