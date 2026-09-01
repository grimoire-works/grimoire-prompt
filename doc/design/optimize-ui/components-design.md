# UI 设计方案 - 意图覆盖率进度条与 Markdown 渲染

## 意图覆盖率进度条

### 组件结构

```
div#intent-coverage-bar.intent-coverage-bar (style="display:none")
├── div.intent-tags-row
│   ├── span.intent-label → "识别到 4 个意图："
│   ├── span.intent-tag × N → 意图名称
│   └── (可选) span.intent-missing-tag × M → 未覆盖的意图
└── div.progress-bar-wrap
    ├── div.progress-bar-track
    │   └── div.progress-bar-fill  (宽度由 JS 控制)
    └── span.progress-text → "75%"
```

### 视觉规范

| 属性 | 值 |
|------|----|
| 整体容器背景 | transparent（无背景，融入 output-section） |
| 整体容器内边距 | 0 0 12px 0（底部间距与下方内容分隔） |
| tags-row 间距 | gap: 6px, flex-wrap: wrap |
| intent-tag 背景 | var(--accent-subtle) |
| intent-tag 文字 | var(--accent-text) |
| intent-tag 内边距 | 2px 10px |
| intent-tag 圆角 | 4px |
| intent-tag 字号 | 12px |
| intent-missing-tag 背景 | var(--warning-bg) |
| intent-missing-tag 文字 | var(--warning) |
| progress-bar-track 高度 | 6px |
| progress-bar-track 背景 | var(--border-color) |
| progress-bar-track 圆角 | 3px |
| progress-bar-fill 背景 | 线性渐变，根据覆盖率变色（见下方） |
| progress-bar-fill 圆角 | 3px |
| progress-bar-fill 初始宽度 | 0% |
| progress-text 字号 | 12px |
| progress-text 颜色 | var(--text-secondary) |
| progress-text 位置 | 进度条右侧，垂直居中 |
| progress-text 与 track 间距 | 8px |

### 进度条颜色规则

覆盖率不同，填充条颜色变化：

| 覆盖率 | 填充条颜色 | 文字颜色 |
|--------|-----------|----------|
| 100% | var(--success) | var(--success) |
| 50% ~ 99% | var(--warning) | var(--warning) |
| 0% ~ 49% | var(--danger) | var(--danger) |

进度条文字旁显示状态文案：
- 100%："所有意图已覆盖"
- 50%-99%："覆盖率 {rate}%，可能未覆盖：{missing tags}"
- 0%-49%："覆盖率 {rate}%，大量意图未覆盖"

### 线框图

```
桌面端输出区内部：
┌──────────────────────────────────────────┐
│ 优化结果                       [复制]    │  ← section-header
├──────────────────────────────────────────┤
│ 识别到 4 个意图：                         │
│ [角色定义] [输出格式] [约束条件] [示例]   │  ← intent-tags-row
│                                          │
│ ████████████████░░░░░░  75%              │  ← progress-bar-wrap
│ 覆盖率 75%，可能未覆盖：[示例]            │
├──────────────────────────────────────────┤
│                                          │
│  (Markdown 渲染的优化结果内容)            │  ← output-content
│                                          │
└──────────────────────────────────────────┘
```

### 状态流转

```
初始状态 → intent-coverage-bar display:none

SSE type=intents 到达:
  → 显示 intent-coverage-bar (display:block)
  → 渲染意图标签到 intent-tags-row
  → 进度条显示 0%，填充条 width: 0%
  → progress-text 显示 "验证中..."

SSE type=verify 到达:
  → 计算覆盖率 rate
  → 设置 progress-bar-fill.style.width = rate + '%'
    (CSS transition: width 800ms ease-out 自动产生动画)
  → 更新 progress-text 为 "{rate}%"
  → 如果 rate < 100%，追加 missing tags
  → 根据 rate 区间设置填充条颜色

后续 verify 事件到达:
  → 更新 width 值，CSS transition 自动从当前值过渡到新值
  → 更新颜色和文字
```

## Markdown 渲染

### marked.js 集成方式

CDN 引入，在 optimize.html 的 `{% block scripts %}` 中添加：

```html
<script src="https://cdn.jsdelivr.net/npm/marked@15.0.7/marked.min.js"></script>
```

版本锁定为 15.x 最新补丁版本。CDN 容错：如果加载失败，`typeof marked` 为 undefined，降级使用 textContent。

### 渲染逻辑

输出区内容替换方式：

```
当前：outputArea.textContent = fullText;
改版：if (typeof marked !== 'undefined' && marked.parse) {
        outputArea.innerHTML = marked.parse(fullText);
      } else {
        outputArea.textContent = fullText;
      }
```

marked.js 配置（在 optimize.js 初始化时设置）：
- breaks: true（GFM 换行）
- gfm: true（GitHub Flavored Markdown）

### Markdown 渲染样式

在 main.css 中为 `.output-content` 内的 Markdown 元素定义样式：

| 元素 | 样式 |
|------|------|
| h1 | 24px, font-weight: 700, margin-top: 20px, margin-bottom: 12px, color: var(--text-primary) |
| h2 | 20px, font-weight: 600, margin-top: 16px, margin-bottom: 10px, color: var(--text-primary) |
| h3 | 17px, font-weight: 600, margin-top: 14px, margin-bottom: 8px, color: var(--text-primary) |
| p | font-size: 14px, line-height: 1.8, margin-bottom: 12px, color: var(--text-primary) |
| ul, ol | padding-left: 24px, margin-bottom: 12px |
| li | font-size: 14px, line-height: 1.8, margin-bottom: 4px |
| code (inline) | background: var(--bg-output), padding: 2px 6px, border-radius: 3px, font-size: 13px, font-family: monospace |
| pre | background: var(--bg-output), padding: 16px, border-radius: 6px, overflow-x: auto, margin-bottom: 12px, border: 1px solid var(--border-color) |
| pre code | background: none, padding: 0, font-size: 13px, line-height: 1.6 |
| blockquote | border-left: 3px solid var(--accent), padding-left: 16px, color: var(--text-secondary), margin-bottom: 12px |
| strong | font-weight: 600, color: var(--text-primary) |
| a | color: var(--accent), text-decoration: underline |
| hr | border: none, border-top: 1px solid var(--border-color), margin: 16px 0 |
| table | border-collapse: collapse, width: 100%, margin-bottom: 12px |
| th, td | border: 1px solid var(--border-color), padding: 8px 12px, font-size: 13px |
| th | background: var(--bg-output), font-weight: 600 |

注意：output-content 的 white-space 需要从 pre-wrap 改为 normal，因为 Markdown 渲染后由 HTML 控制换行。

### 占位状态

未输出时显示占位文字：
```
outputArea.innerHTML = '<span class="placeholder">优化结果将在这里显示...</span>';
```

优化过程中，意图头（"[意图识别] ..."）不再拼入输出文本，而是仅显示在 intent-coverage-bar 中。输出区只渲染优化正文。

## 交互行为

| 触发条件 | 动作 | 动画/过渡 |
|----------|------|-----------|
| SSE intents 事件 | 显示意图标签 + 进度条占位（0%） | intent-coverage-bar fadeIn, 200ms |
| SSE verify 事件 | 进度条从当前宽度过渡到目标宽度 | CSS transition: width 800ms ease-out |
| 覆盖率达到 100% | 填充条变为绿色，显示"所有意图已覆盖" | 颜色过渡 transition: background-color 400ms |
| SSE content 事件 | 追加内容到输出区，用 marked.parse 渲染 | 无 |
| 点击复制 | 复制纯文本（outputArea.innerText）到剪贴板 | toast fadeIn 300ms |

## 无障碍

| 元素 | 属性 |
|------|------|
| progress-bar-wrap | role="progressbar", aria-valuenow="{rate}", aria-valuemin="0", aria-valuemax="100", aria-label="意图覆盖率" |
| 进度条更新时 | JS 更新 aria-valuenow 值 |
| 覆盖率文字 | 作为 progressbar 的 aria-labelledby 引用 |

## 给开发的备注

- 进度条动画完全依赖 CSS transition，JS 只需设置目标 width 值
- progress-bar-fill 初始样式 width: 0%，不要用 display:none 隐藏，否则首次过渡无动画
- 复制按钮应复制纯文本（innerText），不是 HTML（innerHTML）
- 意图头信息（"[意图识别] N 个意图: ..."）在改版后仅显示在 intent-coverage-bar 中，不再拼入输出区的正文内容
- output-content 样式需要把 white-space: pre-wrap 改为 normal，否则 Markdown 渲染后的 HTML 换行会出问题
- 降级场景：marked.js CDN 加载失败时，typeof marked === 'undefined'，用 textContent 显示纯文本，white-space 需要保持 pre-wrap
  - 建议方案：给 output-content 默认 white-space: pre-wrap，当使用 marked 渲染时通过 JS 添加 class="md-rendered" 覆盖为 white-space: normal
