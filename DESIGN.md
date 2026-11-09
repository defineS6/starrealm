# 导航站视觉参考（外部方案）

> 本文描述外部 BMM 导航站，仅供视觉参考，不是本项目的架构或实现规范。下文的 Next.js、NextUI、图标服务和站名均属于参考方案。
> 本项目使用 Cloudflare Workers、D1 数据库、KV 键值存储与原生 JavaScript，具体以 `AGENTS.md`、`README.md` 和 `src/` 为准。
> 本项目保留默认、极客、摇滚三种风格；界面只展示必要的标题、按钮、标签和操作提示。
> 术语：BMM 是参考站名称；Token 指颜色、间距等设计变量；Glassmorphism 指玻璃质感；favicon 指网站图标。

## 外部方案

> 个人导航站 / 书签聚合平台。基于 Next.js + Tailwind CSS + NextUI 构建，玻璃态卡片网格布局，大量导航链接资源聚合。

## 1. 视觉主题与氛围

BMM 是一个**个人导航站/书签聚合平台**，汇集了大量开发工具、AI 服务、影视资源、设计素材等网站的链接。设计风格采用**玻璃态（Glassmorphism）+ 毛玻璃卡片网格**，整体视觉轻盈、通透。

页面背景为纯色底（`bg-background`），所有内容以**圆角卡片网格**呈现。每张卡片包含：favicon 图标、标题、描述文字、标签列表。卡片使用半透明白色背景（`bg-white/16`）加毛玻璃效果（`backdrop-blur-md`），在亮色模式下呈现磨砂玻璃质感，暗色模式转为深色半透明（`dark:bg-content1/28`）。

**核心特征：**
- **卡片网格布局**：大量（200+）导航链接以卡片形式排列在网格中，支持按标签筛选
- **玻璃态设计语言**：`backdrop-blur-md` 毛玻璃 + 半透明背景 + 细边框
- **自动 Favicon 获取**：通过 `api.lcll.cc/favicon?host=` 代理自动获取目标网站图标
- **亮/暗双模式**：完整支持 light/dark 模式切换，使用 Tailwind `dark:` 变体
- **标签分类系统**：每个链接有多个标签，支持按标签浏览过滤
- **懒加载图片**：favicon 图片使用 `loading="lazy"`，无图标时显示 `mdi--web` Iconify 占位

## 2. 色彩体系与角色

### 亮色模式色板
| 角色 | 值 | 用途 |
|------|------|------|
| 页面背景 | `bg-background`（Tailwind 主题色） | 页面画布 |
| 卡片背景 | `bg-white/16`（16% 白色半透明） | 导航卡片主体 |
| 卡片边框 | `border-slate-200/65` | 卡片轮廓 |
| 卡片标题 | `text-foreground-700` | 链接名称 |
| 卡片描述 | `text-foreground-500` | 描述文字 |
| 标签背景 | `bg-slate-200/42` | 分类标签 |
| 标签文字 | `text-foreground-500` | 标签名称 |
| 图标容器 | `bg-white` 纯白 | favicon 容器背景 |

### 暗色模式色板
| 角色 | 值 | 用途 |
|------|------|------|
| 卡片背景 | `dark:bg-content1/28` | 深色半透明 |
| 卡片边框 | `dark:border-white/10` | 白色半透明边框 |
| 标签背景 | `dark:bg-content2/36` | 深色标签背景 |

### 交互态色值
| 状态 | 亮色 | 暗色 |
|------|------|------|
| 卡片 hover | `xs:hover:bg-white/26` `xs:hover:border-slate-200/70` + `-translate-y-0.5` | `dark:xs:hover:bg-content1/34` `dark:xs:hover:border-white/12` |
| 标签 hover 文字 | `xs:hover:text-foreground-700` | 同亮色 |
| 标签 active | `opacity-50` | 同亮色 |

### NextUI 语义 Token 说明
- `--background`: 页面背景色
- `--foreground`: 前景文字基础色
- `text-foreground-500`: 次级文字（描述、标签）
- `text-foreground-700`: 主文字（标题）
- `bg-content1/28`: 内容层表面 1，28% 不透明度
- `bg-content2/36`: 内容层表面 2，36% 不透明度（用于标签）

## 3. 排版规则

### 字体栈
系统字体栈（Tailwind 默认 sans 字体）：
```css
font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
```

### 字号阶梯
| 元素 | 尺寸 | 字重 | 行高 |
|------|------|------|------|
| 导航标题（桌面） | `text-lg`（1.125rem） | 700（默认） | truncate |
| 导航标题（移动） | `text-base`（1rem） | 700 | truncate |
| 描述文字 | `text-xs`（0.75rem） | 400 | `leading-5.5`（1.375rem） |
| 标签文字 | `text-xs`（0.75rem） | 400 | normal |

### 排版约束
- 标题单行截断（`truncate` / `text-ellipsis`）
- 描述最多 3 行（`line-clamp-3`）
- 所有文字支持断词换行（`break-all`）

## 4. 组件样式

### 导航卡片（核心组件）
```
容器:    rounded-3xl border border-slate-200/65 bg-white/16 p-4 backdrop-blur-md
hover:   xs:hover:-translate-y-0.5 xs:hover:border-slate-200/70 xs:hover:bg-white/26
过渡:    transition-[background-color,border-color,transform] duration-150
暗色:    dark:border-white/10 dark:bg-content1/28
暗悬停:  dark:xs:hover:border-white/12 dark:xs:hover:bg-content1/34
```
卡片内部结构：
- **链接区域**（`flex min-w-0 items-start gap-2`）：favicon + 标题
- **描述区域**（`min-h-10`）：固定最小高度存放描述
- **标签区域**（`flex gap-1.5 overflow-auto pt-0.5`）：横向滚动标签列表

### Favicon 图标
```
容器:    flex-center shrink-0 rounded-lg bg-white p-[3px] w-[28px] h-[28px]
图片:    rounded-sm size-full（带 loading="lazy"）
占位:    icon-[mdi--web] text-zinc-700（当 favicon 获取失败时）
```

### 标签 Chip
```
容器:    rounded-full bg-slate-200/42 h-6 px-2 text-xs
文字:    text-foreground-500
hover:   xs:hover:text-foreground-700
active:  opacity-50
暗色:    dark:bg-content2/36
```

### 页面基础布局
```
html:    class="bg-background text-foreground min-w-xs"
```
- 响应式最小宽度 `min-w-xs`（20rem / 320px）
- 网格容器：响应式卡片列数

### 滚动容器
- 标签区域：`scrollbar-hide` 隐藏滚动条，`overflow-auto` 支持横向滚动
- 自定义滚动条样式（`.custom-scrollbar` 相关）

## 5. 布局原则

### 网格布局
- **卡片网格**：响应式列数，自适应容器宽度
- **卡片间距**：`gap-2`（0.5rem/8px）水平垂直间距
- **卡片内部**：`p-4`（1rem/16px）内边距
- **组件间距**：`gap-1.5`（标签之间）

### 响应式断点
| 断点 | 宽度 | 变化 |
|------|------|------|
| 超小屏 | <480px（`max-xs:`） | 卡片增加底部 padding 和暗色分割线 |
| 小屏 | 480-640px | 基础布局 |
| 中屏 | 640-768px（`sm:`） | 按需调整 |
| 桌面 | >768px | 启用 hover translateY 效果 |

### 弹性布局
- 卡片链接使用 `flex` + `min-w-0` 防止溢出
- 标签区域 `flex-wrap` 支持换行 + `overflow-auto` 支持横向滚动

## 6. 深度与层级

### 毛玻璃效果
```css
backdrop-filter: blur(var(--blur-md, 12px))
-webkit-backdrop-filter: blur(var(--blur-md, 12px))
```

### 阴影系统
- **卡片默认态**：无显式阴影，依赖毛玻璃和边框制造层次
- **卡片 hover**：`-translate-y-0.5` 轻微上浮 + 背景加深 + 边框增亮
- **标签 hover**：文字颜色加深

### 圆角系统
| 级别 | 值 | 用途 |
|------|------|------|
| 卡片 | `rounded-3xl`（1.5rem/24px） | 导航卡片主体 |
| 图标容器 | `rounded-lg`（0.5rem/8px） | favicon 背景 |
| favicon 图片 | `rounded-sm`（0.125rem/2px） | 图标自身 |
| 标签 | `rounded-full`（9999px） | 分类标签 |

### 层级结构
```
页面背景（bg-background）
└── 卡片网格容器
    └── 导航卡片（backdrop-blur-md，相对定位）
        ├── favicon 层（bg-white）
        ├── 标题文字（text-foreground-700）
        ├── 描述文字（text-foreground-500）
        └── 标签行（横向滚动）
```

## 7. Motion 动效

### 过渡原则
```css
transition-duration: 150ms（卡片过渡）
transition-property: background-color, border-color, transform（卡片属性）
```

### 卡片交互动效
| 触发 | 属性 | 值 | 时长 |
|------|------|------|------|
| hover | transform | `translateY(-0.125rem)` | 150ms |
| hover | background-color | `bg-white/16` → `bg-white/26` | 150ms |
| hover | border-color | `border-slate-200/65` → `border-slate-200/70` | 150ms |
| active | opacity | `opacity-50`（标签） | 150ms |

### 动效约束
- 仅使用 transform 和 background-color/border-color 过渡（GPU 加速友好）
- hover 上移不超过 0.5rem（-0.5 单位）
- 无弹性缓动，无关键帧动画
- 无入场级联动画（区别于 Mizuki 主题）
- 无页面切换过渡动画

## 8. 品牌身份

### 品牌标识
- **站名**：BMM
- **站长**：令川
- **类型**：个人导航站 / 书签收藏
- **技术栈标识**：Next.js（App Router + Turbopack）

### 内容分类
导航链接涵盖 20+ 分类标签（从 CSS 提取）：
| 分类 | 示例 |
|------|------|
| AI | OpenAI、Claude、通义千问、MiniMax |
| 开源项目 | React、n8n、Bruno |
| API | OpenRouter、New API |
| App | Cursor、Raycast、Ghostty |
| 开发工具 | Whistle、Docker Playground |
| 影视 | 低端影视、AGE动漫、小蜜蜂影院 |
| 设计 | Atmos、Color Designer |
| 资源 | WeLib、Z-Library |
| 小工具 | iLovePDF、Xnapper |
| 资讯 | Kite、36氪 |

### 页面底部信息
- 无显式 footer（全页面均为导航卡片）
- 提供 `/tags/[tag]` 路由支持按标签过滤浏览

## 9. 反模式清单

### ❌ 禁止
1. **卡片使用纯色不透明背景** — 必须使用半透明 + 毛玻璃效果（`bg-white/16` + `backdrop-blur-md`）
2. **favicon 阻塞渲染** — 必须使用 `loading="lazy"`，失败时显示 `icon-[mdi--web]` 占位
3. **超出 3 行的描述文字** — 必须使用 `line-clamp-3` 截断
4. **标题换行** — 必须使用 `truncate` 单行省略
5. **硬编码图标 URL** — 必须通过 `api.lcll.cc/favicon?host=` 代理获取
6. **hover 使用 scale 变换** — 禁止缩放，仅使用 `translateY(-0.5)` 上浮
7. **卡片使用阴影而非毛玻璃** — 使用 `backdrop-blur` 而非 `box-shadow` 制造深度
8. **标签区域出现滚动条** — 必须使用 `scrollbar-hide` 隐藏滚动条
9. **亮暗模式颜色不一致** — 每个颜色角色必须提供亮色和 `dark:` 暗色变体
10. **缺少 `min-w-0` 导致内容溢出** — flex 子项必须设置 `min-width: 0` 防止溢出

### ✅ 应该做
- 利用毛玻璃效果保持页面视觉轻盈通透
- 卡片 hover 时轻微上浮 + 背景加深，提供清晰的交互反馈
- favicon 统一容器为 `rounded-lg bg-white p-[3px]` 保持视觉一致性
- 标签全部使用 `rounded-full` 药丸形状
- 导航链接在新标签页打开（`target="_blank" rel="noopener noreferrer"`）
- 所有 URL 通过 `api.lcll.cc/favicon?host=` 统一处理 favicon
