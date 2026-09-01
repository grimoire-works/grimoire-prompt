# UI 设计方案 - 交互状态与动画

## 页面级状态

### 优化流程状态机

```
                 ┌──────────────┐
                 │    idle      │ ← 初始状态
                 │  按钮可用     │
                 │  输出区占位   │
                 └──────┬───────┘
                        │ 点击"优化"
                        ▼
                 ┌──────────────┐
                 │   loading    │
                 │  按钮禁用     │
                 │  文字"优化中" │
                 │  清空输出区   │
                 └──────┬───────┘
                        │ SSE 开始
                        ▼
                 ┌──────────────┐
        ┌───────│  streaming   │───────┐
        │       │  按钮禁用     │       │
        │       │  内容流式写入  │       │
        │       └──────────────┘       │
        │  intents 事件                 │ verify 事件
        ▼                               ▼
 ┌──────────────┐              ┌──────────────┐
 │  显示意图标签  │              │  更新进度条   │
 │  进度条 0%    │              │  显示覆盖率   │
 └──────────────┘              └──────────────┘
        │                               │
        └───────────┬───────────────────┘
                    │ SSE 完成 (data.done)
                    ▼
             ┌──────────────┐
             │   complete   │
             │  按钮恢复     │
             │  启用复制     │
             │  进度条最终态  │
             └──────────────┘
```

### 各状态下 UI 元素状态

| 元素 | idle | loading | streaming | complete |
|------|------|---------|-----------|----------|
| 优化按钮 | 可用，文字"优化" | 禁用，文字"优化中..." | 禁用，文字"优化中..." | 可用，文字"优化" |
| textarea | 可编辑 | 可编辑 | 可编辑 | 可编辑 |
| 输出区 | 占位文字 | 清空 | Markdown 内容流式增长 | 完整 Markdown 内容 |
| 复制按钮 | 禁用 | 禁用 | 禁用 | 可用 |
| 进度条 | 隐藏 | 隐藏 | 显示，渐进增长 | 显示，最终值 |
| 意图标签 | 隐藏 | 隐藏 | 显示 | 显示 |

## 动画规范

### 进度条增长动画

```css
.progress-bar-fill {
  transition: width 800ms ease-out, background-color 400ms ease;
}
```

时间曲线：ease-out（快进慢停，从 0% 到 30% 很快，之后减速）
持续时间：800ms
颜色切换：400ms ease

### Toast 消息

保持现有动画不变：
```css
animation: fadeIn 0.3s ease;
```

### 导航栏切换按钮

```css
#theme-toggle {
  transition: background-color 0.2s ease;
}
#theme-toggle:hover {
  background: rgba(255, 255, 255, 0.1);
}
```

图标切换无动画，直接替换（SVG 替换是瞬时的，避免复杂动画增加维护成本）。

### 主题切换过渡

```css
body {
  transition: background-color 0.3s ease, color 0.3s ease;
}
```

仅对 background-color 和 color 加过渡，不要对所有属性加 transition（会导致按钮、输入框等都有过渡，体验奇怪）。

卡片、输入框等组件级过渡：
```css
.card, .output-content, .config-bar {
  transition: background-color 0.3s ease, border-color 0.3s ease;
}
```

### 不要动画的场景

- 左右分栏 ↔ 上下堆叠的切换：无动画，media query 即时响应
- 按钮禁用/启用：仅 opacity 变化，0.2s
- 输出区内容增长：无动画，内容直接追加

## 移动端适配

### 断点

```css
@media (max-width: 767px) {
  /* 上下堆叠 */
}
```

单一断点，不设计中间尺寸（平板横屏等不在本次范围内）。

### 移动端布局变化

| 元素 | 桌面端 | 移动端 |
|------|--------|--------|
| container max-width | 1280px | 100% |
| container padding | 0 16px | 0 12px |
| split-layout | grid 1fr 1fr | grid 1fr (单列) |
| config-bar | flex-row, 子元素 flex:1 | flex-wrap, 子元素 100% 宽 |
| textarea min-height | 160px | 120px |
| output-content min-height | 200px | 160px |
| navbar padding | 0 24px | 0 12px |
| nav-brand 字号 | 18px | 16px |
| section padding | 16px | 12px |

### 移动端 config-bar

```
桌面端：
┌────────────────────────────────────────────────┐
│ [优化模板 ▾]        [LLM 配置 ▾]     [ 优化 ]  │
└────────────────────────────────────────────────┘

移动端 (<768px)：
┌──────────────────────┐
│ 优化模板             │
│ [▾ 选择模板      ]  │
├──────────────────────┤
│ LLM 配置            │
│ [▾ 选择配置      ]  │
├──────────────────────┤
│ [      优化       ] │
└──────────────────────┘
```

移动端 config-bar 改为 flex-wrap: wrap，每个 form-group 和按钮各占一行，宽度 100%。

### 移动端导航栏

不折叠为汉堡菜单（仅 3 个链接，空间足够），保持横排，但缩减间距。

## 错误状态

| 场景 | UI 表现 |
|------|--------|
| 网络请求失败 | 输出区显示红色错误文字 "优化失败: {err.message}"，按钮恢复可用 |
| 无输入就点优化 | Toast 提示 "请输入提示词"（error 样式） |
| 未选模板就点优化 | Toast 提示 "请选择优化模板"（error 样式） |
| SSE 连接中断 | 输出区显示已完成的部分 + 错误提示，按钮恢复可用 |
| marked.js CDN 失败 | 降级为纯文本显示，无 toast 提示（静默降级） |

## 给开发的备注

- 进度条的 CSS transition 只设在 progress-bar-fill 上，不要设在 track 或 wrap 上
- 主题切换过渡只对颜色相关属性设置 transition，不要设全局 `transition: all`
- 移动端不需要独立的 CSS 文件，全部通过 media query 在 main.css 中处理
- 错误状态的文字颜色使用 var(--danger)，不要硬编码颜色值
- 移动端 textarea 高度可以适当减小，但最小不要低于 100px（否则输入体验差）
