# 技术方案 - 优化页 UI 改版

## 1. 涉及模块

### 1.1 修改文件

| 文件路径 | 改动类型 | 改动内容 |
|---------|---------|---------|
| `templates/base.html` | 修改 | 导航栏末尾新增主题切换按钮 `<button id="theme-toggle">`；`<head>` 中内联一段主题初始化 JS（防 FOUC）；引入 `theme-toggle.js` |
| `templates/optimize.html` | 修改 | HTML 结构重组：input-section 和 output-section 包裹进 `split-layout` 容器；output-section 内部新增 `intent-coverage-bar` 组件（替代原 `intent-bar`）；引入 marked.js CDN script |
| `static/css/main.css` | 修改 | 顶部新增 CSS 变量体系（`:root` 亮色 + `[data-theme="dark"]` 暗色）；现有硬编码颜色替换为 CSS 变量引用；新增 split-layout grid 样式、intent-coverage-bar 进度条样式、Markdown 渲染样式、主题切换按钮样式、暗色过渡动画样式；移动端 media query 适配 |
| `static/js/optimize.js` | 修改 | SSE intents 事件处理改为渲染到新 intent-coverage-bar（含进度条）；SSE verify 事件处理改为更新进度条宽度+颜色+文字；SSE content 事件输出改为 `marked.parse()` 渲染（降级 textContent）；移除意图头文本拼入输出区的逻辑；复制按钮改为取 `innerText` |

### 1.2 新增文件

| 文件路径 | 内容 |
|---------|------|
| `static/js/theme-toggle.js` | 主题切换逻辑：读取 localStorage -> 设置 data-theme -> 监听按钮点击切换 -> 写入 localStorage -> 监听系统 prefers-color-scheme 变化 |

### 1.3 不变文件

| 文件路径 | 原因 |
|---------|------|
| `backend/routers/optimize.py` | SSE 事件格式（intents/verify/content/done）不变，后端无需改动 |
| `backend/routers/pages.py` | 路由不变 |
| `backend/models.py` | 数据模型不变 |
| `backend/schemas.py` | 请求/响应结构不变 |
| `backend/llm.py` | LLM 调用逻辑不变 |
| `backend/intent.py` | 意图提取/验证逻辑不变 |
| `templates/templates.html` | 模板管理页不变 |
| `templates/settings.html` | 设置页不变 |
| `static/js/templates.js` | 模板管理页 JS 不变 |
| `static/js/settings.js` | 设置页 JS 不变 |
| `pyproject.toml` | 无新增 Python 依赖 |

---

## 2. 技术选型

### 2.1 CSS 变量实现暗色模式

**方案**：`:root` 定义亮色变量，`[data-theme="dark"]` 覆盖暗色值，通过 `document.documentElement.setAttribute('data-theme', ...)` 切换。

**理由**：
- 零依赖，浏览器原生支持，性能最优（无重排）
- 主题切换只需改一个属性，所有使用变量的元素自动更新
- 与现有 CSS 兼容性好，渐进替换硬编码颜色即可

**不选方案**：
- CSS `@media (prefers-color-scheme)` alone -- 无法支持手动覆盖，不符合 PRD 要求
- CSS-in-JS / CSS Modules -- 项目不使用构建工具，引入成本过高
- 多份 CSS 文件 -- 维护成本高，切换时需加载/卸载样式表

### 2.2 CSS Grid 实现左右分栏

**方案**：`display: grid; grid-template-columns: 1fr 1fr; gap: 16px;`，`@media (max-width: 767px)` 回退 `grid-template-columns: 1fr`。

**理由**：
- Grid 天然支持等宽分栏 + gap，代码最简洁
- media query 即时响应，无需 JS 监听视口
- 无浏览器兼容问题（目标为现代浏览器最新 2 版本）

### 2.3 marked.js CDN 引入

**方案**：通过 `<script src="https://cdn.jsdelivr.net/npm/marked@15.0.7/marked.min.js">` 引入，版本锁定。

**理由**：
- PRD 明确要求 CDN 引入，不打包
- marked.js 是最成熟的 Markdown 解析库，~40KB，无其他依赖
- CDN 容错：`typeof marked === 'undefined'` 时降级为 textContent

**不选方案**：
- markdown-it / remark -- 功能更重，本次只需基础 Markdown 渲染
- 服务端渲染 Markdown -- SSE 流式场景下不适合，需要前端增量渲染
- highlight.js -- PRD 明确不引入代码高亮

### 2.4 CSS transition 实现进度条动画

**方案**：`progress-bar-fill` 设置 `transition: width 800ms ease-out`，JS 只设置目标 width 值。

**理由**：
- 纯 CSS 动画，性能最优（GPU 加速）
- JS 逻辑极简，只管设置数值
- 多次 verify 事件自然产生连续过渡效果

### 2.5 主题初始化防 FOUC

**方案**：在 `base.html` 的 `<head>` 中内联一小段 JS，在 DOM 渲染前就读取 localStorage 并设置 `data-theme`。

**理由**：
- 避免 body 先以亮色渲染再闪变为暗色的 FOUC 问题
- 放在 `<head>` 中可以保证在任何 CSS 渲染前执行
- 代码量极小（~10 行），内联无性能损失

---

## 3. 数据流

### 3.1 主题切换数据流

```
页面加载
  → <head> 内联 JS 读取 localStorage("theme")
  → 有值：设置 data-theme 为该值
  → 无值：读取 matchMedia('prefers-color-scheme: dark')
    → 匹配：设置 data-theme="dark"
    → 不匹配：不设置（使用 :root 亮色默认值）
  → 渲染对应图标（太阳/月亮）

用户点击切换按钮
  → theme-toggle.js 取反当前主题
  → 设置 document.documentElement data-theme
  → 写入 localStorage("theme", 新值)
  → 更新按钮图标 + aria-label

系统主题变化（matchMedia change 事件）
  → 仅当 localStorage 无 theme 值时响应
  → 跟随系统设置 data-theme
```

### 3.2 SSE 流式输出数据流（改动部分）

```
SSE type=intents 到达:
  旧流程：拼意图头文本到 outputArea.textContent + 显示 intent-bar（底部）
  新流程：
    → 显示 intent-coverage-bar（output-section 顶部）
    → 渲染意图标签到 intent-tags-row
    → 进度条初始化 width: 0%，文字 "验证中..."
    → 不再将意图头文本拼入 outputArea

SSE type=content 到达:
  旧流程：outputArea.textContent = intentHeaderText + fullText
  新流程：
    → fullText += data.content
    → typeof marked !== 'undefined'
      ? outputArea.innerHTML = marked.parse(fullText)  // Markdown 渲染
      : outputArea.textContent = fullText               // 降级纯文本

SSE type=verify 到达:
  旧流程：更新 intentVerify.innerHTML 显示覆盖率文字
  新流程：
    → 计算 rate = Math.round(coverage_rate * 100)
    → progress-bar-fill.style.width = rate + '%'  (CSS transition 自动动画)
    → progress-text = rate + '%'
    → 根据 rate 区间设置填充条颜色（100% 绿色 / 50-99% 橙色 / 0-49% 红色）
    → 更新状态文案
    → 更新 aria-valuenow

复制按钮:
  旧流程：navigator.clipboard.writeText(outputArea.textContent)
  新流程：navigator.clipboard.writeText(outputArea.innerText)
    → innerText 取纯文本（不含 HTML 标签），保证复制内容干净
```

### 3.3 API 接口变化

**无后端接口变化**。SSE 事件格式保持不变：
- `{ type: "intents", intents: [...], summary: "..." }`
- `{ content: "..." }`
- `{ type: "verify", covered: [...], missing: [...], coverage_rate: float }`
- `{ done: true, history_id: "..." }`

所有改动集中在前端消费端。

---

## 4. 影响范围

### 4.1 对模板管理页和设置页的影响

base.html 的改动（导航栏新增按钮、引入 theme-toggle.js、head 内联 JS）会影响所有继承 base.html 的页面。具体影响：

| 影响 | 评估 | 应对 |
|------|------|------|
| 导航栏新增主题切换按钮 | 按钮在 nav-links 之后，不改变现有元素位置 | 确保 nav-links 的 flex 布局兼容 |
| head 内联主题 JS | 不影响页面功能，仅设置 data-theme | 无需额外处理 |
| 引入 theme-toggle.js | 脚本只操作主题切换按钮，不触碰其他 DOM | 无影响 |
| main.css 变量替换 | 管理页和设置页的硬编码颜色需同步替换为 CSS 变量 | 必须覆盖所有页面样式（详见 4.2） |

### 4.2 main.css 变量替换范围

main.css 中的样式分为两大区域，需同步替换硬编码颜色为 CSS 变量：

**优化页专用样式**（本次改版核心）：
- `.navbar` 背景/文字 → CSS 变量
- `.config-bar` 背景/阴影 → CSS 变量
- `.input-section / .output-section` 背景/阴影/边框 → CSS 变量
- `.output-content` 背景/边框/字号 → CSS 变量
- `.intent-*` 系列 → CSS 变量（并重构为进度条组件）
- `.btn-*` 系列 → CSS 变量
- `.form-group label` 颜色 → CSS 变量

**管理页/设置页共享样式**（需同步适配暗色模式）：
- `.manage-sidebar` 背景/阴影/边框 → CSS 变量
- `.manage-detail` 背景/阴影 → CSS 变量
- `.item-list li` 背景/边框/选中态 → CSS 变量
- `.edit-form .field label` 颜色 → CSS 变量
- `.detail-placeholder` 颜色 → CSS 变量
- `.sidebar-header` 边框 → CSS 变量
- `select, input, textarea` 背景/边框 → CSS 变量

管理页/设置页的样式替换是被动适配：不改变布局和功能，只将硬编码颜色替换为 CSS 变量，使其在暗色模式下正确显示。

### 4.3 container max-width 变化

当前 `.container` max-width 为 960px，改为 1280px。这会影响所有页面。但管理页（模板管理/设置）使用的是 `.manage-page` 布局（`height: calc(100vh - 100px)`），container 宽度增大不会破坏布局，反而让侧边栏+详情区有更多空间。

---

## 5. 风险点与应对

### 5.1 FOUC（Flash of Unstyled Content）闪烁

**风险**：页面先以亮色渲染，JS 加载后切换为暗色，用户看到闪变。

**应对**：在 `<head>` 中内联主题初始化 JS（~10 行），在 CSS 渲染前就设置 `data-theme`。这段代码必须在 `<link rel="stylesheet">` 之前执行。

**验证方式**：清空浏览器缓存，暗色模式下刷新页面，观察是否还有闪白。

### 5.2 marked.js CDN 加载失败

**风险**：用户网络环境无法访问 CDN（防火墙、离线环境等）。

**应对**：
- 运行时检测 `typeof marked !== 'undefined'`
- 降级为 `textContent` 纯文本显示
- 降级时 output-content 保持 `white-space: pre-wrap`
- 正常渲染时通过添加 CSS class `md-rendered` 覆盖为 `white-space: normal`
- 静默降级，不弹 toast

**验证方式**：DevTools Network 面板阻止 CDN 域名，验证降级表现。

### 5.3 意图头文本从输出区移除后的兼容性

**风险**：当前 optimize.js 将 `[意图识别] N 个意图: ...` 拼入 outputArea.textContent。改版后这部分信息仅显示在 intent-coverage-bar 中。如果后端有逻辑依赖输出区包含意图头文本，会出问题。

**应对**：经代码审查，后端 `optimize.py` 的 SSE 事件中 intents 和 content 是独立事件，后端不依赖前端如何渲染。意图头文本的拼接完全是前端行为，移除不影响后端。历史记录保存的 `optimized_prompt` 也只含优化正文（`full_text`），不含意图头。

**验证方式**：优化后检查历史记录，确认 optimized_prompt 字段不含意图头。

### 5.4 CSS 变量替换遗漏

**风险**：main.css 中存在大量硬编码颜色值，替换时遗漏会导致暗色模式下部分元素显示异常（如白字白底）。

**应对**：
- 列出所有需要替换的选择器，逐条检查
- 重点关注管理页/设置页的样式（不是本次改版重点，但受 base.html 改动影响）
- 完成后在暗色模式下逐页检查

### 5.5 复制按钮行为变化

**风险**：从 `textContent` 改为 `innerText`，两者有语义差异。`innerText` 会受 CSS 影响（如 `display:none` 的元素不会计入），且触发重排。

**应对**：
- outputArea 内无隐藏元素，innerText 与用户看到的文字一致
- 复制操作不在高频循环中，重排性能可忽略
- 确保复制的是纯文本（HTML 标签被正确剥离）

### 5.6 output-content white-space 切换

**风险**：Markdown 渲染需要 `white-space: normal`，但降级纯文本需要 `white-space: pre-wrap`。如果处理不当会导致换行混乱。

**应对**：
- 默认样式保持 `white-space: pre-wrap`（兼容纯文本降级）
- Markdown 渲染成功时，给 outputArea 添加 class `md-rendered`，通过该 class 覆盖为 `white-space: normal`
- 每次 SSE content 事件时根据是否使用 marked 决定是否添加该 class

---

## 6. 实现顺序建议

按依赖关系排序，每个步骤可独立验证：

| 步骤 | 任务 | 前置依赖 | 可独立验证 |
|------|------|---------|-----------|
| 1 | CSS 变量体系 + 亮色值替换（`main.css`） | 无 | 切换 data-theme 验证变量生效 |
| 2 | `base.html` 新增主题切换按钮 + 内联初始化 JS + 引入 `theme-toggle.js` | 步骤 1 | 点击切换按钮验证主题切换 |
| 3 | 新建 `theme-toggle.js` | 步骤 2 | 验证 localStorage 持久化、系统跟随 |
| 4 | 暗色变量值 + 暗色过渡动画（`main.css`） | 步骤 1 | 切换暗色模式验证所有元素 |
| 5 | `optimize.html` 结构重组（split-layout + intent-coverage-bar） | 步骤 1 | 验证左右分栏布局 + 移动端回退 |
| 6 | 意图覆盖率进度条样式（`main.css`） | 步骤 5 | CSS 层面验证进度条外观 |
| 7 | `optimize.js` SSE 处理改造（进度条 + Markdown 渲染 + 移除意图头拼接） | 步骤 5, 6 | 端到端验证优化流程 |
| 8 | 管理页/设置页暗色适配（`main.css` 变量替换） | 步骤 4 | 逐页验证暗色模式 |
