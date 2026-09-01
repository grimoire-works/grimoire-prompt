# PRD - 优化页 UI 改版（暗色模式 + 分栏布局 + Markdown 渲染 + 意图覆盖率可视化）

## 背景

当前优化页采用纵向堆叠布局（配置栏 -> 输入区 -> 输出区），存在以下问题：
- 输入和输出距离过远，用户需要来回滚动对比
- 输出内容为纯文本（textContent），无法渲染 Markdown 格式
- 意图覆盖率仅用文字标签展示，缺少直观的进度可视化
- 不支持暗色模式，无法满足偏好深色界面的用户
- 整体配色和间距层次感不足，与 Linear/Tailwind 等现代工具存在差距

本次改版仅涉及优化页（optimize.html + main.css 中优化页相关部分 + optimize.js），不改动模板管理页和设置页。

## 用户故事

- 作为提示词优化工具用户，我希望输入区和输出区左右并排展示，以便同时查看原始提示词和优化结果，减少滚动
- 作为提示词优化工具用户，我希望优化结果以 Markdown 格式渲染，以便更清晰地阅读结构化内容（标题、列表、代码块等）
- 作为提示词优化工具用户，我希望看到意图覆盖率的进度条动画，以便直观了解优化质量
- 作为提示词优化工具用户，我希望在暗色模式下使用工具，以便在夜间或深色桌面环境下减少视觉疲劳
- 作为移动端用户，我希望在小屏设备上自动切换为上下堆叠布局，以便正常使用

## 功能需求

1. **左右分栏布局**：输入区（左）和输出区（右）横向并排，宽度比约 1:1，间距 16px；视口宽度 < 768px 时自动回退为上下堆叠
2. **Markdown 渲染**：输出区内容使用 marked.js 渲染 Markdown；marked.js 通过 CDN 加载（jsdelivr/unpkg，~40KB），版本锁定；不引入 highlight.js
3. **意图覆盖率进度条**：移至输出区顶部（优化结果上方），包含进度条 + 百分比文字；进度条带从 0% 渐进到目标值的 CSS transition 动画（约 800ms ease-out）
4. **暗色模式**：默认跟随系统 prefers-color-scheme；可在导航栏通过太阳/月亮图标按钮手动覆盖；偏好存储在 localStorage，优先级高于系统设置；通过 CSS 变量实现主题切换，变量定义在 html 或 body 的 data-theme 属性上
5. **配色优化**：保持蓝色调，采用冷灰 + 靛蓝风格（参考 Linear/Tailwind）；优化层次感（背景、卡片、悬浮层级分明）；优化间距（统一 8px 基准栅格）

## 任务拆解

| # | 任务 | 预估代码量 | 涉及文件 |
|---|------|-----------|----------|
| 1 | CSS 变量体系 + 暗色模式基础 | ~120 行 | static/css/main.css, templates/base.html |
| 2 | 导航栏暗色模式切换按钮 | ~30 行 | templates/base.html, static/js/theme-toggle.js（新建） |
| 3 | 优化页左右分栏布局 | ~80 行 | templates/optimize.html, static/css/main.css |
| 4 | 配色方案升级（冷灰+靛蓝） | ~100 行 | static/css/main.css |
| 5 | marked.js 集成 + Markdown 渲染 | ~60 行 | templates/optimize.html, static/js/optimize.js |
| 6 | 意图覆盖率进度条（位置迁移 + 动画） | ~100 行 | templates/optimize.html, static/css/main.css, static/js/optimize.js |

### 任务详细说明

**任务 1：CSS 变量体系 + 暗色模式基础**
- 在 main.css 顶部定义 CSS 变量集合，覆盖颜色、背景、边框等
- 通过 `[data-theme="dark"]` 选择器定义暗色变量值
- 基础变量包括：--bg-page, --bg-card, --bg-input, --text-primary, --text-secondary, --border-color, --accent, --accent-hover 等
- body 默认使用 light 变量，暗色模式通过 data-theme 切换

**任务 2：导航栏暗色模式切换按钮**
- 在 base.html 导航栏 nav-links 后添加主题切换按钮（太阳/月亮 SVG 图标）
- 新建 static/js/theme-toggle.js 处理：读取 localStorage 偏好 -> 设置 data-theme -> 监听按钮点击切换 -> 写入 localStorage
- 逻辑：localStorage 有值用 localStorage，无值跟随系统 prefers-color-scheme

**任务 3：优化页左右分栏布局**
- optimize.html 中将 input-section 和 output-section 包裹在一个 `split-layout` 容器内
- CSS 使用 `display: grid; grid-template-columns: 1fr 1fr; gap: 16px;`
- 媒体查询 `@media (max-width: 767px)` 回退为 `grid-template-columns: 1fr;`
- container max-width 从 960px 调整为 1280px 以容纳双栏

**任务 4：配色方案升级（冷灰+靛蓝）**
- 亮色：页面背景 #f8f9fb，卡片 #ffffff，边框 #e5e7eb，主文字 #1f2937，次要文字 #6b7280，强调色 #4f46e5
- 暗色：页面背景 #0f1117，卡片 #1a1d27，边框 #2d3140，主文字 #e5e7eb，次要文字 #9ca3af，强调色 #6366f1
- 导航栏在暗色模式下适配深色背景
- 统一使用 8px 基准间距

**任务 5：marked.js 集成 + Markdown 渲染**
- optimize.html 的 scripts block 中通过 CDN script 标签加载 marked.js
- optimize.js 中将 outputArea.textContent = ... 替换为 outputArea.innerHTML = marked.parse(...)
- 处理空状态 placeholder：未输出时显示灰色提示文字
- 为 Markdown 渲染后的内容添加基础样式（标题、列表、代码块、引用块等）到 main.css

**任务 6：意图覆盖率进度条（位置迁移 + 动画）**
- optimize.html：将 intent-bar 从 output-section 底部移到输出区顶部（section-header 下方、output-content 上方）
- 新增进度条 HTML：一个进度条容器 div + 内部填充 div + 百分比文字
- CSS：进度条背景使用 var(--border-color)，填充使用 var(--accent)，高度 6px，圆角 3px
- JS：收到 verify 事件时，计算覆盖率百分比，设置进度条宽度 + CSS transition 实现从 0% 渐进动画

## 验收标准

- [ ] 输入区和输出区在桌面端横向并排展示（1:1 宽度比）
- [ ] 视口宽度 < 768px 时，自动切换为上下堆叠布局
- [ ] 输出区内容以 Markdown 渲染展示（标题、列表、代码块等正确渲染）
- [ ] 意图覆盖率进度条位于输出区顶部，带渐进动画
- [ ] 暗色模式默认跟随系统 prefers-color-scheme
- [ ] 导航栏太阳/月亮按钮可手动切换暗色/亮色模式
- [ ] 暗色模式偏好持久化到 localStorage，刷新后保持
- [ ] 配色采用冷灰 + 靛蓝风格，层次分明（页面背景、卡片、输入框三级区分）
- [ ] 模板管理页和设置页未受影响，功能正常
- [ ] 现代浏览器（Chrome/Firefox/Safari/Edge 最新 2 个版本）显示一致

## 非功能性要求

- **浏览器兼容**：仅支持现代浏览器最新 2 个版本，可自由使用 CSS 变量、CSS Grid、gap、CSS transition 等现代特性
- **性能**：marked.js 通过 CDN 加载，不打包到项目；CSS 变量切换无重排开销
- **无障碍**：主题切换按钮需有 aria-label；进度条需有 role="progressbar" + aria-valuenow
- **CDN 容错**：marked.js CDN 加载失败时，输出区降级为纯文本展示（textContent）
