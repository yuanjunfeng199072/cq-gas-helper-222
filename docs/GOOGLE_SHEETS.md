# Google Sheets 数据源配置

## 为什么浏览器提示「无法打开该文件」？

常见原因：

1. **配置里仍是占位符**  
   `spreadsheetId` 或链接里含有 `YOUR_SPREADSHEET_ID` —— 这不是真实表格，Google 会提示无法打开。  
   **处理**：在 `js/config.js` 填入你自己新建的表格 ID（见下文第 2 节）。

2. **表格未共享给你**  
   用别人的链接打开，但没有查看权限。  
   **处理**：表格所有者 → **共享** → 添加你的邮箱，或设为「知道链接的任何人可查看」。

3. **国内网络访问 Google 不稳定**  
   浏览器打不开 `docs.google.com` 时，网页也无法用 CSV 拉取。  
   **处理**：使用下文 **第 5 节 Apps Script 网页应用**，或暂时 `enabled: false` 用本地 `mock-stations.json`。

---

## 1. 表格列结构（第一行表头）

| id | name | lat | lng | 92号油价 | 95号油价 | discounts | lastUpdated | isFilled |
|----|------|-----|-----|---------|---------|-----------|-------------|----------|

- **discounts**：优惠活动 / 活动时间  
- **isFilled**：`是` / `否`；不填则根据 92/95 油价自动判断  

---

## 2. 创建你自己的表格（必做）

1. 登录 [Google 表格](https://sheets.google.com)（需能访问 Google）
2. **空白表格** → 粘贴表头与数据  
   - 可从 `data/stations-for-google-sheets.csv` 导入（Excel / 表格菜单 文件→导入）
3. 点击 **共享** → **知道链接的任何人** → 角色 **查看者** → 完成  
4. 复制浏览器地址栏中的 **表格 ID**：

```
https://docs.google.com/spreadsheets/d/1a2b3c4d5e6f7g8h9i0j/edit
                                    ↑↑↑ 这一段 ↑↑↑
```

5. 编辑 `js/config.js`：

```javascript
const SHEETS_CONFIG = {
  enabled: true,
  spreadsheetId: '1a2b3c4d5e6f7g8h9i0j',  // 换成你的 ID
  spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1a2b3c4d5e6f7g8h9i0j/edit',
  publishUrl: '',   // 可选，见第 5 节
  gid: '0',
  apiKey: '',
  // ...
};
```

**不要**使用文档或代码里的 `YOUR_SPREADSHEET_ID` 示例链接去打开，一定会报错。

---

## 3. 读取方式优先级

| 顺序 | 方式 | 配置 |
|------|------|------|
| 1 | Apps Script 网页应用 JSON | `publishUrl`（国内相对友好） |
| 2 | Sheets API v4 | `apiKey` + `spreadsheetId` |
| 3 | CSV 导出 | 仅 `spreadsheetId`，表格须公开 |

---

## 4. CSV / API 模式

### CSV（无需 API Key）

- `apiKey` 留空，`publishUrl` 留空  
- 表格必须 **任何人可查看**  
- 大陆若 `docs.google.com` 打不开，CSV 模式也会失败  

### API Key

1. Google Cloud 启用 Sheets API  
2. 创建 API 密钥 → 填入 `apiKey`  
3. `range` 改为你的工作表名，如 `Sheet1!A:Z`  

---

## 5. Apps Script 网页应用（推荐国内）

不依赖在浏览器里打开表格链接，只要 **部署后的 URL** 能访问即可。

1. 打开你的 Google 表格  
2. **扩展程序** → **Apps Script**  
3. 粘贴 `docs/google-apps-script.gs` 中的代码  
4. **部署** → **新建部署** → 类型 **网页应用**  
   - 执行身份：我  
   - 访问权限：**任何人**  
5. 复制 **网页应用 URL**（形如 `https://script.google.com/macros/s/...../exec`）  
6. 填入 `js/config.js`：

```javascript
publishUrl: 'https://script.google.com/macros/s/你的部署ID/exec',
enabled: true,
```

`spreadsheetId` 仍可填写，用于顶栏「编辑表格」链接（需你能打开该表格）。

---

## 6. 页面表现

- 成功：顶栏绿色 **「数据 MM-DD」**，来源为 Google 表格  
- 失败：自动用 `mock-stations.json`，并弹窗说明原因  

## 7. 暂时不用 Google 表格

```javascript
SHEETS_CONFIG.enabled = false;
```

保存后刷新，即使用本地 mock 数据。
