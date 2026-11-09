# 星境书签 (StarRealm) - 精品网址导航站

<p align="center">
  极具视觉张力与交互体验的现代云端书签收藏与分享平台，完全基于 Cloudflare Workers 全家桶构建。
</p>

<p align="center">
  <a href="#-核心特性">核心特性</a> •
  <a href="#-快速开始">快速开始</a> •
  <a href="#-配置项">配置说明</a> •
  <a href="#-数据库与备份">数据库与备份</a> •
  <a href="#-常见问题">常见问题</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Runtime-Cloudflare%20Workers-f38020?logo=cloudflare" alt="Cloudflare Workers">
  <img src="https://img.shields.io/badge/Database-Cloudflare%20D1-18453B?logo=sqlite" alt="Cloudflare D1">
  <img src="https://img.shields.io/badge/Storage-Cloudflare%20KV-F6821F" alt="Cloudflare KV">
  <img src="https://img.shields.io/github/license/defineS6/starrealm" alt="License">
</p>

---

## ✨ 核心特性

- 🌠 **真 3D 空间流星与曲率跃迁开场动画**
  - 原生 Canvas 2D 纯数学打造的三维透视引擎，模拟流星在真实空间三维引力轨道（$Z=1750 \to 62 \to 360$）的加速飞掠与镜头追踪。
  - 三维双螺旋等离子尾焰、动态镜头摇移视差与奇点撞击立体激波环；支持点击/Esc秒跳过，适配 `prefers-reduced-motion`。
- 🎨 **三套独立风格 × 明暗双维度**
  - **默认态**：流体玻璃与 Bento Grid 布局，搭配柔和弥散极光与毛玻璃景深。
  - **极客态 (Oh My CPA)**：复古终端控制台、CRT 扫描纹理与经典极客绿荧光。
  - **摇滚态 (Cyberpunk)**：赛博朋克像素霓虹、高对比红蓝双色切片与 8-Bit 实时跳动音浪柱。
  - 每一套风格均深度适配**浅色 / 深色**双维度切换，自动持久化记忆。
- ⚙️ **后台动态系统设置**
  - 支持在后台可视化配置「我的博客」跳转地址与前台展示开关，自动同步存储于 D1 与 KV，无需改动代码或重新构建部署。
- 📂 **全能分类与多维度排序**
  - 支持创建独立空分类；支持分类数字排序与前台书签独立拖拽/数字优先级排序。
- 📝 **访客投稿与审核流程**
  - 提供前台访客投稿入口与后台待审核流水线；可通过系统配置一键开启或彻底关闭投稿通道。
- 🔍 **毫秒级模糊检索**
  - 全局支持随时按下键盘 `/` 键秒级聚焦搜索框，实时匹配书签名称、URL 域名与所属分类。
- 🔒 **无死角的轻量级安全认证**
  - 管理员凭据由 Cloudflare KV 安全托管；基于 HttpOnly + Secure + SameSite=Strict 的 12 小时自动续期会话，彻底告别 URL 明文传参风险。
- ⚡ **零构建、全边缘、极速冷启**
  - 原生 ES Modules 纯单体架构，没有多余的构建打包黑盒（无需 `npm run build`），直接运行于 Cloudflare 边缘计算节点。

---

## 🛠️ 技术栈与架构

| 层次 | 技术选型 | 说明 |
|------|---------|------|
| **计算平台** | [Cloudflare Workers](https://workers.cloudflare.com/) | 边缘 Serverless 无冷启秒级响应 |
| **关系数据库** | [Cloudflare D1](https://developers.cloudflare.com/d1/) | 边缘 SQLite 托管实例，存取站点与分类数据 |
| **高速键值存储**| [Cloudflare KV](https://developers.cloudflare.com/workers/runtime-apis/kv/) | 托管管理员凭据、登录会话与全局快速配置 |
| **前端呈现** | 原生 HTML5 + TailwindCSS + Canvas 2D | 纯原生无编译依赖，极低内存占用与丝滑渲染 |

### 模块结构

```text
starrealm/
├── src/
│   ├── index.js          # Worker 入口与顶级路由分发
│   ├── api/              # API 接口层（站点 CRUD、分类、投稿、设置）
│   ├── admin/            # 后台控制台（认证会话、页面注入）
│   ├── frontend/         # 前台视图渲染与动态模板装配
│   ├── templates/        # 页面模板、CSS 与脚本资源
│   └── utils/            # 通用响应、安全转义、分类与排序工具
├── schema.sql            # D1 数据库初始化表结构
└── wrangler.toml.example # Cloudflare 资源配置与环境变量模板
```

---

## 🚀 快速开始

### 准备环境

- [Node.js](https://nodejs.org) (推荐 18+ 或 22+)
- [Cloudflare 账号](https://dash.cloudflare.com/)（免费版即可满足个人使用）

安装 Cloudflare 官方 CLI 工具：

```powershell
npm install -g wrangler
wrangler login
```

*(在自动化 CI 环境中，可通过配置 `$env:CLOUDFLARE_API_TOKEN` 环境变量免交互登录)*

### 1. 创建 D1 数据库与初始化表

```powershell
# 创建 D1 数据库实例
wrangler d1 create book

# 执行 schema.sql 初始化数据库表结构（创建 sites, pending_sites, category_orders, settings 表）
wrangler d1 execute book --remote --file=schema.sql
```

### 2. 创建 KV 命名空间并设置管理员

```powershell
# 创建 KV 命名空间
wrangler kv namespace create NAV_AUTH
```

设置你的后台管理员用户名与登录密码：

```powershell
# 将 <你的KV_ID> 替换为上述命令输出的 id
wrangler kv key put --namespace-id="你的KV_ID" admin_username "admin"
wrangler kv key put --namespace-id="你的KV_ID" admin_password "你的登录密码"
```

### 3. 配置 `wrangler.toml`

复制配置模板：

```powershell
Copy-Item wrangler.toml.example wrangler.toml
```

在 `wrangler.toml` 中填入你的实际 ID：

```toml
name = "starrealm"
account_id = "你的Cloudflare账户ID"
main = "src/index.js"
compatibility_date = "2024-01-01"

[[rules]]
type = "Text"
globs = ["**/*.css"]
fallthrough = true

[[d1_databases]]
binding = "NAV_DB"
database_name = "book"
database_id = "你的D1数据库ID"

[[kv_namespaces]]
binding = "NAV_AUTH"
id = "你的KV命名空间ID"
```

### 4. 部署上线

```powershell
wrangler deploy
```

部署完成后，控制台将输出分配的 Worker 访问域名：
- **前台首页**：`https://<你的子域>.workers.dev`
- **后台管理**：`https://<你的子域>.workers.dev/admin`

---

## 💻 本地开发与回归测试

启动本地边缘模拟开发服务：

```powershell
wrangler dev
# 默认服务于 http://localhost:8787
```

运行内置自动化合规测试（无需安装额外依赖，纯 Node.js 内置 Test Runner）：

```powershell
node --test src/utils/compliance.test.js
```

---

## ⚙️ 配置项与数据库

### 环境变量配置

| 变量名 | 说明 | 默认值 | 配置方式 |
|--------|------|--------|----------|
| `ENABLE_PUBLIC_SUBMISSION` | 是否允许前台访客投稿 | `"true"` | 可在 `wrangler.toml` 的 `[vars]` 中显式设置为 `"false"` 关闭 |

### 数据库保留字说明 (Cloudflare D1)

| 字段名 | 表 | 说明与规范 |
|--------|----|------------|
| `desc` | `sites`, `pending_sites` | SQLite 关键字；代码已严格保留字段名兼容性，外部迁移需留意引号包裹 |
| `catelog`| 全部表 | 分类名称（沿用历史命名字段），全局代码已对齐复用 |
| `sort_order` | `sites`, `category_orders` | 排序优先级，数值越小越靠前 |

### 数据备份与导出

```powershell
# 导出全量远端数据库备份
wrangler d1 export book --output "backup_$(Get-Date -Format yyyyMMdd).sql"

# 从备份文件恢复数据库
wrangler d1 execute book --remote --file=backup_xxxx.sql
```

---

## ❓ 常见问题

| 问题 | 排查与解决办法 |
|------|----------------|
| **访问后台提示 `no such table: settings`** | 重新执行 `wrangler d1 execute book --remote --file=schema.sql`；或直接在后台「系统设置」点击一次保存，系统会自动检测并补建配置表。 |
| **部署后登录后台提示用户名或密码错误** | 检查 `NAV_AUTH` KV 命名空间是否绑定正确，重新执行 `wrangler kv key put --namespace-id="<ID>" admin_password "新密码"` 覆盖。 |
| **本地启动报 npm 权限错误** | 在管理员 PowerShell 终端执行：`Set-ExecutionPolicy RemoteSigned`。 |
| **忘记或需要重置密码** | 直接通过 Wrangler KV 覆盖对应键值，12 小时内的旧会话将在登出后失效。 |

---

## 📄 许可证与鸣谢

本项目采用 [MIT](LICENSE) 协议开源。

- **项目主页**：[https://github.com/defineS6/starrealm](https://github.com/defineS6/starrealm)
- **原型灵感**：感谢 [@一只会飞的旺旺](https://github.com/wangwangit) 的原版 `nav` 基础实现。

---

<p align="center">
  如果「星境书签」对你有帮助，欢迎在 GitHub 上点亮一颗 ⭐️！
</p>
