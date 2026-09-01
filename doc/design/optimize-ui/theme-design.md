# UI 设计方案 - 暗色模式与配色体系

## 配色方案

### CSS 变量定义

所有颜色通过 CSS 变量管理，定义在 `:root`（亮色）和 `[data-theme="dark"]`（暗色）选择器上。

| 变量名 | 亮色值 | 暗色值 | 用途 |
|--------|--------|--------|------|
| --bg-page | #f8f9fb | #0f1117 | 页面整体背景 |
| --bg-card | #ffffff | #1a1d27 | 卡片/面板背景 |
| --bg-input | #ffffff | #1e2130 | 输入框/textarea 背景 |
| --bg-output | #f9fafb | #141722 | 输出区域背景 |
| --bg-navbar | #1a1a2e | #0d0f18 | 导航栏背景 |
| --text-primary | #1f2937 | #e5e7eb | 主文字颜色 |
| --text-secondary | #6b7280 | #9ca3af | 次要文字（标签、说明） |
| --text-tertiary | #9ca3af | #6b7280 | 占位符、禁用文字 |
| --text-inverse | #e5e7eb | #1f2937 | 导航栏文字（深色底用浅字） |
| --text-nav-link | #a0a0b0 | #6b7280 | 导航链接默认色 |
| --border-color | #e5e7eb | #2d3140 | 边框颜色 |
| --border-focus | #4f46e5 | #6366f1 | 输入框聚焦边框 |
| --accent | #4f46e5 | #6366f1 | 强调色（按钮、进度条、选中态） |
| --accent-hover | #4338ca | #818cf8 | 强调色悬浮 |
| --accent-subtle | #eef2ff | #1e1b4b | 强调色浅底（tag 背景） |
| --accent-text | #4f46e5 | #818cf8 | 强调色文字（tag 文字） |
| --success | #059669 | #34d399 | 成功状态（全量覆盖） |
| --success-bg | #ecfdf5 | #064e3b | 成功背景 |
| --warning | #d97706 | #fbbf24 | 警告状态（部分覆盖） |
| --warning-bg | #fffbeb | #451a03 | 警告背景 |
| --danger | #ef476f | #f87171 | 危险/错误 |
| --shadow-sm | 0 1px 2px rgba(0,0,0,0.05) | 0 1px 2px rgba(0,0,0,0.3) | 小阴影（卡片） |
| --shadow-md | 0 4px 12px rgba(0,0,0,0.08) | 0 4px 12px rgba(0,0,0,0.4) | 中阴影 |

### 色彩层级关系

亮色模式的三级层级：
```
页面背景 (#f8f9fb) → 卡片 (#ffffff) → 输出区 (#f9fafb)
    最浅                最白              微灰
```

暗色模式的三级层级：
```
页面背景 (#0f1117) → 输出区 (#141722) → 卡片 (#1a1d27)
    最深               中深              较浅
```

注意暗色模式的层级方向与亮色相反：页面最深，卡片相对最浅，这样卡片从深色背景中"浮起"。

## 间距系统

基于 8px 栅格：

| 场景 | 值 | 说明 |
|------|----|------|
| 容器内边距 | 24px (3x) | 卡片、配置栏 |
| 区块间距 | 16px (2x) | config-bar 与 split-layout、section-header 间距 |
| 元素内间距 | 8px (1x) | 按钮内边距、小间距 |
| 紧凑间距 | 4px (0.5x) | 表单组 label 与输入框间距 |

## 字号系统

| 元素 | 字号 | 字重 |
|------|------|------|
| 导航品牌名 | 18px | 600 |
| 导航链接 | 14px | 400 |
| section 标题 | 15px | 600 |
| 正文 | 14px | 400 |
| 次要文字/标签 | 13px | 500 |
| 标签/辅助信息 | 12px | 400 |
| 按钮文字 | 14px | 500 |
| textarea 文字 | 14px | 400 |
| output 内容 | 14px | 400，行高 1.8 |

## 圆角系统

| 元素 | 圆角 |
|------|------|
| 卡片 | 8px |
| 按钮 | 6px |
| 输入框/textarea | 6px |
| 进度条 | 3px |
| 意图 tag | 4px |
| toast | 6px |

## 导航栏暗色切换按钮

### 按钮设计

```
位置：导航栏最右侧，与 nav-links 同一行
尺寸：32x32px
圆角：6px
背景：transparent，hover 时 rgba(255,255,255,0.1)
图标：内联 SVG，16x16px
```

亮色模式（导航栏深色底，当前状态）：
- 显示月亮图标（表示可以切换到暗色）
- 图标颜色 #a0a0b0

暗色模式（导航栏深色底）：
- 显示太阳图标（表示可以切换到亮色）
- 图标颜色 #9ca3af

### SVG 图标

月亮图标（切换到暗色）：
```
路径：M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z
viewBox：0 0 24 24
stroke：currentColor，stroke-width：2，stroke-linecap：round，stroke-linejoin：round
fill：none
```

太阳图标（切换到亮色）：
```
路径：circle cx=12 cy=12 r=5 + 8条射线 line
viewBox：0 0 24 24
stroke：currentColor，stroke-width：2，stroke-linecap：round，stroke-linejoin：round
fill：none
```

按钮内通过 JS 控制两个 SVG 的显示/隐藏（或用一个 SVG + JS 替换 innerHTML）。

## 主题切换逻辑

### 初始化流程

```
1. 页面加载
2. 读取 localStorage 的 "theme" 值
3. 如果有值 → 用该值设置 data-theme 属性
4. 如果无值 → 读取 window.matchMedia('(prefers-color-scheme: dark)') 的结果
   - 匹配暗色 → 设置 data-theme="dark"
   - 不匹配 → 不设置（使用 :root 默认的亮色变量）
5. 根据当前主题渲染对应的切换图标
```

### 切换流程

```
1. 用户点击主题按钮
2. 获取当前 data-theme 值
3. 取反（dark ↔ light / 空）
4. 设置 document.documentElement.setAttribute('data-theme', 新值)
5. 写入 localStorage.setItem('theme', 新值)
6. 更新切换图标
```

### 系统偏好监听

```
监听 matchMedia('prefers-color-scheme: dark') 的 change 事件
仅当 localStorage 中无 theme 值时响应（有手动偏好时不被系统覆盖）
```

## 给开发的备注

- CSS 变量选择器用 `:root` 对应亮色，`[data-theme="dark"]` 对应暗色
- 导航栏背景在亮色和暗色模式下都是深色（--bg-navbar），只是暗色模式下更深一些
- body 不需要加 data-theme，设置在 html 元素上（`:root` 即 html）
- 切换按钮需要 `aria-label="切换暗色模式"`，状态更新时改为"切换亮色模式"
- 页面加载时主题切换需要在 `<head>` 中内联一段 JS（避免 FOUC 闪烁），或在 theme-toggle.js 中用 DOMContentLoaded 尽早执行
- theme-toggle.js 需要在 base.html 中通过 `<script>` 标签引入，放在 body 末尾
