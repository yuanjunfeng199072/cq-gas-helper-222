# 数据库设计（云开发 / 关系型通用）

> 目标：Web H5 与微信小程序共用同一套数据模型。  
> 推荐落地：**微信云开发（CloudBase）** 或 **腾讯云 MySQL + 云函数**，集合名与表名一一对应。

## 设计原则

1. **对外展示「每升优惠」**（如 `-0.28`），库内可同时存 `save_per_liter` 与内部 `price`（仅服务端/审核可见）。
2. **主数据与情报分离**：油站主数据相对稳定；用户提交走 `intel_submissions` 审核后合并到 `station_snapshots`。
3. **软删除 + 审计**：所有审核、积分变更写日志表。
4. **ID 规范**：`station_id` 字符串（兼容现有 `s001`）；新站用 `st_` + ULID；用户用 `openid` / `uid`。

---

## 1. stations（油站主数据）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| _id | string | ✓ | 主键，如 `s001` |
| name | string | ✓ | 站名 |
| brand | string | | 中石化/中石油/壳牌/民营 |
| address | string | | 地址 |
| district | string | | 区县，如「两江新区」 |
| area | string | | 片区 |
| lat | number | ✓ | 纬度 |
| lng | number | ✓ | 经度 |
| open_hours | string | | 营业时间 |
| tags | array\<string\> | | 标签 |
| status | enum | ✓ | `active` / `hidden` / `pending` |
| source | enum | | `seed` / `admin` / `user_report` |
| created_at | datetime | ✓ | |
| updated_at | datetime | ✓ | |

**索引**：`(lat, lng)` 地理索引或 GeoJSON；`district`；`status`。

---

## 2. region_benchmarks（区域基准）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| _id | string | ✓ | 如 `chongqing_main` |
| region_name | string | ✓ | 重庆主城区域均价 |
| price_92 | number | ✓ | 基准 92#（内部计算用） |
| price_95 | number | ✓ | 基准 95# |
| fill_volume_default | number | | 默认加满升数，50 |
| effective_from | date | ✓ | 生效日 |
| effective_to | date | | 失效日，空=当前有效 |
| updated_at | datetime | ✓ | |

**索引**：`effective_from` + `region_name`。

---

## 3. station_snapshots（油站当前生效情报）

> 地图/排行读取此表（或视图），由审核通过的情报合并生成。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| _id | string | ✓ | |
| station_id | string | ✓ | 关联 stations |
| save_92 | number | | 每升优惠，如 0.13（展示为 ↓0.13） |
| save_95 | number | | |
| price_92 | number | | 可选，内部价，不对外 API 暴露 |
| price_95 | number | | |
| activity_schedule | string | | 如「每周一、三、五」 |
| activity_note | string | | 活动说明 |
| photo_url | string | | 云存储 fileID / HTTPS |
| data_updated_at | date | ✓ | 情报更新日期 |
| intel_id | string | | 来源 submission _id |
| version | int | ✓ | 递增版本 |
| created_at | datetime | ✓ | |

**索引**：`station_id` + `version`（唯一当前：`is_current=true` 或取 max version）。

---

## 4. intel_submissions（用户情报提交 · 核心）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| _id | string | ✓ | |
| station_id | string | | 匹配到的站；空表示仅站名 |
| station_name | string | ✓ | 用户填写站名 |
| submit_type | enum | ✓ | `price` / `activity` / `mixed` |
| save_92 | string | | 用户输入，如 `-0.28` |
| save_95 | string | | |
| price_92 | number | | 可选，审核员可见 |
| price_95 | number | | |
| activity_schedule | string | | 活动时间 |
| activity_note | string | | 优惠说明 |
| photo_url | string | | |
| reported_at | date | ✓ | 用户填的更新日期 |
| status | enum | ✓ | 见下方状态机 |
| confirm_count | int | ✓ | 车友「确认有用」次数，默认 0 |
| auto_review_threshold | int | | 默认 3，达到可进入机审/待人工 |
| reviewer_id | string | | 审核员 uid |
| reviewed_at | datetime | | |
| reject_reason | string | | |
| points_awarded | int | | 已发放积分 |
| user_id | string | ✓ | openid / 匿名 device_id |
| user_nickname | string | | |
| platform | enum | ✓ | `web` / `mp-weixin` |
| created_at | datetime | ✓ | |
| updated_at | datetime | ✓ | |

### 状态机 status

```
pending → community_verified → approved → merged
         ↘ rejected
         ↘ expired（超 N 天未处理）
```

| 状态 | 含义 |
|------|------|
| `pending` | 待确认/待审核 |
| `community_verified` | 确认数 ≥ 阈值，待管理员或规则审核 |
| `approved` | 审核通过，待写入 snapshot |
| `merged` | 已合并到 station_snapshots |
| `rejected` | 驳回 |

---

## 5. intel_confirmations（确认有用）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| _id | string | ✓ | |
| intel_id | string | ✓ | |
| user_id | string | ✓ | |
| created_at | datetime | ✓ | |

**唯一索引**：`(intel_id, user_id)` 防止重复确认。

---

## 6. users（用户）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| _id | string | ✓ | openid 或 web 匿名 id |
| nickname | string | | |
| avatar_url | string | | |
| role | enum | ✓ | `user` / `reviewer` / `admin` |
| points_total | int | ✓ | 当前积分 |
| platform_first | enum | | 首次来源 |
| created_at | datetime | ✓ | |
| updated_at | datetime | ✓ | |

---

## 7. point_logs（积分流水）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| _id | string | ✓ | |
| user_id | string | ✓ | |
| delta | int | ✓ | +10 / +20 / -5 |
| reason | enum | ✓ | `submit_intel` / `intel_adopted` / `confirm_intel` / `weekly_bonus` / `admin_adjust` |
| ref_type | string | | `intel_submission` |
| ref_id | string | | |
| balance_after | int | ✓ | |
| created_at | datetime | ✓ | |

**索引**：`user_id` + `created_at`。

---

## 8. audit_logs（审核日志）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| _id | string | ✓ | |
| intel_id | string | ✓ | |
| action | enum | ✓ | `approve` / `reject` / `merge` / `rollback` |
| operator_id | string | ✓ | |
| remark | string | | |
| payload | object | | 变更前后快照 |
| created_at | datetime | ✓ | |

---

## 9. system_config（系统配置）

| key | value | 说明 |
|-----|-------|------|
| confirm_threshold | 3 | 自动进入 community_verified |
| points_submit | 10 | 提交情报 |
| points_adopted | 20 | 采纳后额外 |
| intel_expire_days | 14 | 过期天数 |

---

## 与现有 mock-stations.json 映射

| mock 字段 | 目标表/字段 |
|-----------|-------------|
| stations[] | stations + station_snapshots |
| benchmark | region_benchmarks |
| fillVolume | region_benchmarks.fill_volume_default |
| price92/95 | station_snapshots.price_*（内部） |
| diff92/95 | 前端 enrichStation 计算，或 snapshot.save_* |
| community tips | intel_submissions |
| contributors | users.points_total + point_logs |

---

## 微信小程序云开发集合名建议

| 表名 | 云开发 collection |
|------|-------------------|
| stations | `stations` |
| region_benchmarks | `benchmarks` |
| station_snapshots | `station_snapshots` |
| intel_submissions | `intel_submissions` |
| intel_confirmations | `intel_confirmations` |
| users | `users` |
| point_logs | `point_logs` |
| audit_logs | `audit_logs` |

云存储目录：`intel-photos/{yyyy}/{intel_id}.jpg`
