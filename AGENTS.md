# Repository Guidelines

## 项目结构与模块组织

本项目是基于 Cloudflare Workers 的导航站。核心代码位于 `src/`：`src/index.js` 是 Worker 入口并负责路由分发；`src/api/` 放站点、分类、投稿审核等 API；`src/admin/` 放后台认证与页面路由；`src/frontend/` 放前台渲染逻辑；`src/templates/` 放 HTML、CSS 与后台脚本模板；`src/utils/` 放通用工具。`schema.sql` 维护 D1 表结构，`wrangler.toml.example` 是部署配置模板。

## 构建、测试与开发命令

- `npm install -g wrangler`：安装 Cloudflare CLI。
- `wrangler login`：登录 Cloudflare 账号。
- `wrangler d1 execute book --remote --file=schema.sql`：初始化或更新远端 D1 表结构。
- `wrangler dev`：本地启动 Worker，默认访问 `http://localhost:8787`。
- `wrangler deploy`：部署到 Cloudflare Workers。

仓库目前没有 `package.json` 和统一的 `npm test`/`npm run build` 脚本，不要假设这些命令存在。

## 编码风格与命名约定

使用原生 JavaScript ES Modules，保持 2 空格缩进、分号风格与现有文件一致。模块按职责拆分，优先复用 `src/utils/` 中的工具函数，避免在 API、后台和前台渲染间重复实现相同逻辑。数据库字段沿用现有命名，例如 `catelog`、`desc`、`sort_order`，不要随意重命名以免破坏兼容数据。新增关键流程注释应使用中文，避免无意义注释。

## 测试指南

当前未配置自动化测试框架。修改后至少通过 `wrangler dev` 手动验证首页、`/admin` 登录、站点 CRUD、分类排序、访客投稿开关等受影响路径。涉及 D1 结构变更时同步更新 `schema.sql`，并在 PR 中说明迁移步骤。新增测试时建议按模块放在相邻目录，命名为 `*.test.js`。

## 提交与 Pull Request 规范

Git 历史主要使用 Conventional Commits，例如 `feat: ...`、`fix: ...`、`refactor: ...`、`docs: ...`、`chore: ...`，标题保持简短，可使用中文说明。PR 需要包含变更摘要、验证步骤、关联 issue；涉及 UI 时附首页或后台截图；涉及配置时说明 `wrangler.toml.example`、D1、KV 或 secret 的变化。

## 安全与配置提示

不要提交本地 `wrangler.toml`、`.env`、账号 ID、数据库 ID、KV ID 或管理员密码。代码中读取配置应通过 Worker bindings、KV 或环境变量完成；文档和示例只使用占位值。
