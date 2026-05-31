# Google Sheets 数据源配置

网页已从 `mock-stations.json` 切换为 **Google 表格** 拉取油站数据（配置在 `js/config.js` 的 `SHEETS_CONFIG`）。

## 1. 表格列结构（第一行表头）

| 列名（推荐） | 说明 | 必填 |
|-------------|------|------|
| id | 站点唯一编号，如 s001 | 建议填 |
| name | 加油站名称 | ✓ |
| lat | 纬度 | ✓ |
| lng | 经度 | ✓ |
| 92号油价 | 92# 价格（元/升） | 录入后填 |
| 95号油价 | 95# 价格（元/升） | 录入后填 |
| discounts | 优惠活动/活动时间，如「每周一、三、五」 | 选填 |
| lastUpdated | 更新日期，如 2025-05-26 | 选填 |
| isFilled | 是否已录入：是/否 或 true/false | 选填 |

未填 `isFilled` 时：若 92、95 油价均为有效数字，则视为已录入（正常彩色卡片），否则为灰色「待更新」。

表头也支持英文：`price92`、`price95` 等（见 `js/sheets-data.js` 的 `HEADER_MAP`）。

## 2. 创建并公开表格

1. 新建 [Google 表格](https://sheets.google.com)
2. 按上表填写表头和数据行
3. **共享** → **知道链接的任何人** → **查看者**（使用 CSV 模式时必须）

## 3. 填写 `js/config.js`

```javascript
const SHEETS_CONFIG = {
  enabled: true,
  spreadsheetId: '1abc...你的表格ID...xyz',
  spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1abc.../edit',
  gid: '0',           // 工作表标签页 gid，见下方说明
  apiKey: '',         // 可选，见第 4 节
  range: 'Sheet1!A:Z',
  benchmark: { price92: 7.85, price95: 8.35, updatedAt: '2025-05-26' },
  // ...
};
```

**表格 ID**：浏览器地址栏  
`https://docs.google.com/spreadsheets/d/【spreadsheetId】/edit`

**gid**：多工作表时，打开对应标签，URL 中 `gid=123456789` 即为该页的 gid。

## 4. 两种读取方式

### 方式 A：CSV 导出（推荐入门，无需 API Key）

- `apiKey` 留空 `''`
- 表格必须 **公开可查看**
- 修改表格后刷新网页即可（建议强刷 Ctrl+Shift+R）

### 方式 B：Google Sheets API v4

1. [Google Cloud Console](https://console.cloud.google.com/) 创建项目  
2. 启用 **Google Sheets API**  
3. 创建 **API 密钥**，限制 HTTP 引荐来源（你的 GitHub Pages 域名）  
4. 填入 `SHEETS_CONFIG.apiKey`  
5. 表格需对 API 可读（公开或共享服务账号）

```javascript
apiKey: 'AIza...你的密钥',
range: 'Sheet1!A:Z',  // 工作表名与范围
```

## 5. 页面上的更新时间

- 顶栏 **「数据 更MM-DD」**：来自表格 `lastUpdated` 最新值或 `benchmark.updatedAt`
- 加载失败时会回退到内置 `FALLBACK_DATA`，并提示检查配置

## 6. 从 mock 迁移

可运行（可选）：

```bash
node scripts/export-mock-to-csv.js
```

将 `mock-stations.json` 导出为 CSV，粘贴到 Google 表格。

## 7. 回退 mock

```javascript
SHEETS_CONFIG.enabled = false;
```

将重新尝试加载 `data/mock-stations.json`。
