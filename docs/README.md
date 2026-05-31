# 文档索引

| 文档 | 内容 |
|------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 总览、目录结构、模块职责 |
| [DATABASE.md](./DATABASE.md) | 9 张表/集合、字段、状态机 |
| [API.md](./API.md) | REST + 云函数接口契约 |
| [ROADMAP.md](./ROADMAP.md) | 6 阶段渐进迁移计划 |

## 快速开始（阶段 1）

1. 阅读 `ROADMAP.md` 阶段 1  
2. 在 `index.html` 中于 `app.js` 之前引入：

```html
<script src="js/api/config.js?v=BUILD"></script>
<script src="shared/constants/intel-status.js?v=BUILD"></script>
<script src="js/api/adapters/local.js?v=BUILD"></script>
<script src="js/api/adapters/cloud.js?v=BUILD"></script>
<script src="js/api/index.js?v=BUILD"></script>
```

（`intel-status.js` 路径为 `shared/constants/intel-status.js`）

3. 将 `loadData()` / `GasCommunity` 逐步改为调用 `GasApi.*`  
4. 保持 `API_CONFIG.DATA_SOURCE = 'local'` 直至云环境就绪  

## 种子数据导出

```bash
node scripts/migrate-seed.js --out ./seed-output
```
