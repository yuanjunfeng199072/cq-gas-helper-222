# 国内网络访问说明

GitHub Pages（`*.github.io`）在中国大陆可能出现 **页面长期缓存、更新延迟** 的情况，外网已更新但国内仍显示旧版。

## 已做的优化

1. **版本号缓存破除**：所有 JS/CSS 带 `?v=版本号`，数据请求 `cache: no-store`
2. **大陆自动 CDN**：检测到国内时区/语言时，静态资源改从 [jsDelivr](https://www.jsdelivr.com/) 拉取（国内节点更新更快）
3. **备用入口**：若 GitHub 仍显示旧版，请直接访问：
   - https://cdn.jsdelivr.net/gh/yuanjunfeng199072/cq-gas-helper-222@main/index.html?v=2025052602
   - 或仓库里的 `cn.html` 跳转页

## 推荐：同步到 Gitee Pages（国内最稳）

1. 在 [Gitee](https://gitee.com/) 导入仓库 `cq-gas-helper-222`（与 GitHub 同名即可）
2. 仓库 → **服务** → **Gitee Pages** → 分支选 `main` → 部署
3. 获得地址形如：`https://你的用户名.gitee.io/cq-gas-helper-222/`
4. 之后每次 `git push` 到 Gitee 的 `main` 后，在 Pages 里点「更新」

## 高德地图 Key

无论 GitHub 还是 Gitee，都需在[高德控制台](https://console.amap.com/)白名单中加入实际访问域名，例如：

- `yuanjunfeng199072.github.io`
- `你的用户名.gitee.io`
- `cdn.jsdelivr.net`（若使用 jsDelivr 入口）

## 发布新版本时

修改 `index.html` 与 `js/version.js` 中的 `APP_BUILD`（如 `2025052603`），并同步所有 `?v=` 参数后推送。
