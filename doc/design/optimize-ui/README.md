# 优化页 UI 设计方案索引

## 设计文档

| 文档 | 内容 |
|------|------|
| [layout-design.md](layout-design.md) | 页面结构、HTML 层次、分栏布局、组件清单 |
| [theme-design.md](theme-design.md) | CSS 变量体系、配色方案（亮色/暗色）、间距/字号/圆角系统、主题切换逻辑 |
| [components-design.md](components-design.md) | 意图覆盖率进度条设计、Markdown 渲染集成方案 |
| [interaction-design.md](interaction-design.md) | 状态流转、动画规范、移动端适配、错误状态 |

## 设计概要

- 布局：左右分栏（1:1），grid 实现，<768px 回退单列
- 暗色模式：CSS 变量 + data-theme 属性，默认跟随系统，导航栏手动切换
- 配色：冷灰 + 靛蓝，亮色主色 #4f46e5，暗色主色 #6366f1
- 进度条：输出区顶部，800ms ease-out 增长动画，颜色根据覆盖率变化
- Markdown：marked.js CDN，降级为纯文本
- 涉及文件：templates/base.html, templates/optimize.html, static/css/main.css, static/js/optimize.js, static/js/theme-toggle.js（新建）
- 新增依赖：marked.js（CDN，不打包）
