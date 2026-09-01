# 开发计划 — grimoire-prompt

## 项目概述
提示词优化工具

## 任务列表
| # | 任务 | 状态 | DEV_ID | TEST_ID | 涉及文件 | 验收标准 | 备注 |
|---|------|------|--------|---------|----------|----------|------|
| 0 | 环境验证 + 编译检查 | ⏳ 待办 | - | - | backend/, static/js/, templates/ | `python -m compileall backend/ -q` 零输出 | 主Agent直接做 |
| 1 | CSS 变量体系 + 亮色配色替换 | ✅ 完成 | a0e8b27ba2c8d9d7f | - | static/css/main.css | 在 `<html>` 上设置 `data-theme="dark"` → 所有优化页元素使用暗色变量值；移除 `data-theme` → 恢复亮色值；无硬编码颜色残留 | 依赖 Task 0 |
| 2 | 暗色变量值 + 暗色过渡动画 | ✅ 完成 | ac73c64472cfda5c8 | - | static/css/main.css | 暗色模式下：页面背景 #0f1117、卡片 #1a1d27、导航栏 #0d0f18；主题切换时 body/card 背景色有 0.3s ease 过渡，非颜色属性无过渡 | 依赖 Task 1 |
| 3 | theme-toggle.js 新建 + base.html 主题按钮 + 防 FOUC 内联 JS | ✅ 完成 | af1ec0d705ec46dad | - | static/js/theme-toggle.js（新建）, templates/base.html | 点击切换按钮 → 亮暗主题切换且 localStorage 持久化；刷新页面无 FOUC 闪烁；清空 localStorage 后跟随系统 prefers-color-scheme；系统主题变化时（无 localStorage 时）自动跟随 | 依赖 Task 2 |
| 4 | optimize.html 结构重组 + 分栏布局 + container 加宽 | ✅ 完成 | a6f70523bc6013954 | - | templates/optimize.html, static/css/main.css | 桌面端（>=768px）input-section 和 output-section 左右等宽并排（gap 16px）；视口 <768px 自动回退上下堆叠；container max-width 为 1280px；移动端 config-bar flex-wrap 换行 | 依赖 Task 1 |
| 5 | 意图覆盖率进度条（HTML 结构 + CSS 样式） | ✅ 完成 | a6db0d4ed6713a2a8 | - | templates/optimize.html, static/css/main.css | intent-coverage-bar 位于 output-section 顶部（section-header 下方、output-content 上方）；进度条 6px 高、圆角 3px；标签使用 CSS 变量着色；无障碍属性 role="progressbar" + aria-valuenow | 依赖 Task 4 |
| 6 | marked.js CDN 引入 + Markdown 渲染 + 白空格降级处理 | ✅ 完成 | a276b5fd9b8985b9a | - | templates/optimize.html, static/js/optimize.js, static/css/main.css | SSE content 事件输出区显示 Markdown 渲染内容（标题、列表、代码块正确格式化）；DevTools 阻止 CDN 域名 → 降级为纯文本 pre-wrap 显示；复制按钮复制纯文本（无 HTML 标签） | 依赖 Task 4 |
| 7 | SSE 意图/验证事件改造（进度条驱动 + 移除意图头拼接） | ✅ 完成 | ac351db097ad9be28 | - | static/js/optimize.js | SSE intents 事件 → 进度条显示 0% + 意图标签；SSE verify 事件 → 进度条宽度 CSS transition 动画到目标百分比 + 颜色按覆盖率区间变化（绿/橙/红）+ 状态文案；输出区正文不再包含 "[意图识别]..." 头文本 | 依赖 Task 5, Task 6 |
| 8 | 管理页/设置页暗色适配（CSS 变量替换） | ✅ 完成 | a1dff3624ac6999e1 | - | static/css/main.css | 暗色模式下模板管理页和设置页所有元素正确显示（无白字白底、无边框消失）；sidebar/detial/list/form/select/textarea 均使用 CSS 变量；功能不受影响 | 依赖 Task 2 |

## 第二批：代码评审问题修复（260901）

| # | 任务 | 状态 | DEV_ID | TEST_ID | 涉及文件 | 验收标准 | 备注 |
|---|------|------|--------|---------|----------|----------|------|
| 9 | 优化接口错误处理改造 | ✅ 完成 | af1ab90b3cadfdfb0 | a3bc53c88ae6db966 | backend/routers/optimize.py | 模板不存在/未配置 LLM 时返回 4xx HTTPException JSON；chat_stream/verify 异常时 SSE 流内发送 `{"type":"error"}` 事件后正常结束流，不直接断流 | grim-dev |
| 10 | 前端优化失败提示 | ✅ 完成 | a1152849aa8a2ba18 | a877ab33ef9fe82a7 | static/js/optimize.js | fetch 后检查 resp.ok 与 content-type，非 SSE 错误响应读取 JSON error 并 toast 提示；收到 SSE error 事件时输出区显示错误信息；失败时复制按钮保持禁用 | grim-frontend，依赖 Task 9 |
| 11 | XSS 安全修复 | ✅ 完成 | a121452e17972f1ee | a431b920d35e95697 | static/js/optimize.js | intent 标签渲染前 HTML 转义；marked 渲染结果经消毒处理（如 DOMPurify 或等效方案），`<img onerror>` `<script>` 等注入内容不执行 | grim-frontend |
| 12 | API Key 加密存储 | ✅ 完成 | a822260e69cc7b240 | a6a54661cd03f4cfe | backend/config.py, backend/routers/llm_config.py, backend/crypto.py(新建), pyproject.toml, README.md | 使用 encryption_key 实现 Fernet 加密，api_key 密文入库；读取时解密；存量明文数据兼容（解密失败按明文处理并在下次保存时加密）；README 与实现一致 | grim-dev |
| 13 | History API 意图字段 | ✅ 完成 | a8f82aa488bb752e4 | a563343c1e133c577 | backend/schemas.py, backend/routers/history.py | GET /api/history 返回 original_intents、intent_coverage 字段 | grim-dev |
| 14 | 历史记录页面 | ✅ 完成 | a7b7ae4f91fb669f5 | ae2c5886afa4175c3 | templates/history.html(新建), static/js/history.js(新建), templates/base.html, backend/routers/pages.py | 导航栏新增"历史"入口；页面展示历史列表（分页）、原始/优化后提示词、意图覆盖率；支持删除单条与清空 | grim-frontend，依赖 Task 13 |
| 15 | provider 校验 + 意图提取 token 上限 | ✅ 完成 | a879aa4618186dc85 | a3f5a73bac133817c | backend/schemas.py, backend/intent.py | LlmConfigCreate/Update.provider 使用 Literal 校验非法值返回 422；意图提取/验证 max_tokens 500→2000 | grim-dev |
| 16 | 数据库轻量迁移 | ✅ 完成 | a160c273bf6f51ba5 | a484aeede82d0c2c2 | backend/database.py 或 backend/main.py | 启动时自动检测缺失列并 ALTER TABLE 补列（SQLite/MySQL 兼容）；构造缺列老库验证启动后自动补齐 | grim-dev |
| 17 | 流式渲染节流 | ✅ 完成 | a3cd93cae967ae93d | a73fd2b1301b3b023 | static/js/optimize.js | SSE content 事件渲染节流（约 100ms 或 rAF），流结束后保证完整渲染；功能与外观不变 | grim-frontend |
| 18 | marked.js 本地化 | ✅ 完成 | ad08ccb373124adef | ad87c97a4d79003ce | static/vendor/(新建), templates/optimize.html | marked.min.js 下载到本地 static/vendor/ 加载，移除 CDN 依赖；渲染与降级逻辑不变；README 同步更新 | grim-frontend |

| 19 | 前端收尾三处修复（templates.js XSS / 缓存版本号 / catch 着色） | ✅ 完成 | a739c15ac76159f14 | adde206cbf5002f88 | static/js/templates.js, templates/optimize.html, static/js/optimize.js | ① templates.js:24 t.name 经 escapeHtml 转义后再 innerHTML；② optimize.html optimize.js 引用 v=8→v=9；③ optimize.js catch 分支补红色着色 + toast | grim-frontend，提交前前端检查发现 |

## 当前进度
- 正在执行：已完成
- 第一批（UI 改版）：9/9 完成
- 第二批（问题修复）：10/10 完成
- 第三批（前端收尾）：1/1 完成
