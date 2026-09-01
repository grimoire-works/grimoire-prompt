# UI 设计方案 - 优化页布局与分栏

## 页面整体结构

```
桌面端 (>=768px)
┌──────────────────────────────────────────────────────────────────┐
│  Navbar: [Logo]  [优化] [模板管理] [设置]            [🌙/☀️]    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ config-bar ─────────────────────────────────────────────┐    │
│  │ [优化模板 ▾]    [LLM 配置 ▾]                  [ 优化 ]   │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─ split-layout (grid 1fr 1fr, gap 16px) ─────────────────┐    │
│  │                                                          │    │
│  │  ┌─ input-section ──────┐  ┌─ output-section ─────────┐ │    │
│  │  │ 输入提示词    0 字    │  │ 优化结果         [复制]  │ │    │
│  │  │ ┌──────────────────┐ │  │ ┌──────────────────────┐ │ │    │
│  │  │ │                  │ │  │ │ intent-coverage-bar  │ │ │    │
│  │  │ │   textarea       │ │  │ │ ████████░░░░  75%    │ │ │    │
│  │  │ │                  │ │  │ │ 已覆盖3/4意图        │ │ │    │
│  │  │ │                  │ │  │ ├──────────────────────┤ │ │    │
│  │  │ │                  │ │  │ │                      │ │ │    │
│  │  │ │                  │ │  │ │  output-content      │ │ │    │
│  │  │ │                  │ │  │ │  (Markdown 渲染)     │ │ │    │
│  │  │ │                  │ │  │ │                      │ │ │    │
│  │  │ └──────────────────┘ │  │ └──────────────────────┘ │ │    │
│  │  └─────────────────────┘  └─────────────────────────┘ │    │
│  │                                                          │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

移动端 (<768px)
┌──────────────────────┐
│ Navbar               │
├──────────────────────┤
│ config-bar (堆叠)     │
├──────────────────────┤
│ input-section        │
│ (全宽)                │
├──────────────────────┤
│ output-section       │
│ (全宽)                │
└──────────────────────┘
```

## HTML 结构变更

### optimize.html 结构调整

当前结构是纵向堆叠的三个平级 div：config-bar、input-section、output-section。

改版后结构：

```
div.optimize-page
├── div.config-bar
│   ├── div.form-group > label + select#template-select
│   ├── div.form-group > label + select#llm-select
│   └── button#optimize-btn
└── div.split-layout                    ← 新增容器
    ├── div.input-section               ← 保持不变
    │   ├── div.section-header
    │   └── textarea#prompt-input
    └── div.output-section              ← 内部结构重组
        ├── div.section-header
        ├── div#intent-coverage-bar     ← 新增：进度条区域
        │   ├── div.intent-tags-row     ← 意图标签行
        │   └── div.progress-bar-wrap   ← 进度条
        │       ├── div.progress-fill
        │       └── span.progress-text
        └── div#output-area.output-content
```

### base.html 变更

导航栏末尾增加主题切换按钮：

```
nav.navbar
├── div.nav-brand
├── div.nav-links
│   ├── a 优化
│   ├── a 模板管理
│   └── a 设置
└── button#theme-toggle                ← 新增
    └── SVG (太阳/月亮图标)
```

## 组件说明

| 组件 | 类型 | 说明 |
|------|------|------|
| config-bar | 已有，微调 | 配置栏，桌面端保持横排，移动端 flex-wrap 换行 |
| split-layout | 新增 | grid 容器，包裹 input-section 和 output-section |
| input-section | 已有，不变 | 输入区域，含 textarea 和字数统计 |
| output-section | 已有，内部重组 | 输出区域，新增 intent-coverage-bar 在顶部 |
| intent-coverage-bar | 新增 | 替代原 intent-bar，包含意图标签 + 进度条 |
| progress-bar-wrap | 新增 | 进度条容器，内含填充条和百分比文字 |
| theme-toggle | 新增 | 导航栏主题切换按钮 |

## 交互行为

| 触发条件 | 动作 | 动画/过渡 |
|----------|------|-----------|
| 视口宽度 < 768px | split-layout 回退单列 | 无动画，CSS media query 即时响应 |
| 视口宽度 >= 768px | split-layout 恢复双列 | 无动画，CSS media query 即时响应 |
| config-bar 在移动端宽度不足 | 选择器堆叠、按钮占满宽 | flex-wrap 自然换行 |
| textarea 内容变化 | 更新字数统计 | 无 |
| 点击"优化"按钮 | 禁用按钮，显示"优化中..."，清空输出区 | 无 |
| SSE 返回 intents 事件 | 显示意图标签，显示进度条占位 | 进度条从 width:0 渐变 |
| SSE 返回 verify 事件 | 更新进度条宽度和百分比 | CSS transition: width 800ms ease-out |
| SSE 返回 content 事件 | 追加内容到输出区，用 marked.js 渲染 | 无 |
| 优化完成 | 恢复按钮状态，启用复制 | 无 |
| 点击复制 | 复制到剪贴板，显示 toast | toast fadeIn 300ms |

## 给开发的备注

- split-layout 使用 CSS Grid 实现，不要用 float 或 flexbox（Grid 天然支持等宽分栏 + gap）
- container max-width 从 960px 调整为 1280px，使双栏内容有足够宽度
- 移动端 config-bar 的三个子元素需要 flex-wrap: wrap，确保小屏下自动换行
- intent-coverage-bar 是原 intent-bar 的替代，从 output-section 底部移到顶部（section-header 下方）
- 进度条的结构保持语义化：外层容器 role="progressbar"，内层填充 div 控制宽度
