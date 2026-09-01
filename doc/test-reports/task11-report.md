# 测试报告 - 任务 11: XSS 安全修复

## 第 1 次测试

- 待测文件：`static/js/optimize.js`、`templates/optimize.html`、`static/vendor/purify.min.js`（DEV_ID: a121452e17972f1ee）
- 测试方式：jsdom DOM 模拟攻击载荷测试（脚本位于 /tmp/task11-test/test-xss.cjs，不进项目）。使用**项目本地 static/vendor/purify.min.js（3.4.14）真实消毒** + npm marked@15.0.12（与 CDN marked@15 同版本系列），在 jsdom 中加载真实 optimize.js 执行 renderOutput/handleIntentsEvent/click 流程，共 54 项断言
- 静态检查：`node --check static/js/optimize.js` 通过；`python -m compileall backend/ -q` 零错误零警告

### 验收标准验证

| # | 验收标准 | 结果 | 说明 |
|---|---------|------|------|
| 1 | `<img src=x onerror=window.__xss=1>` 经 renderOutput 后不执行，文本内容保留 | ✅ 通过 | marked@15 无法将该载荷识别为标签（未加引号属性值含第二个 `=`），输出为实体转义纯文本 `<p>&lt;img src=x onerror=window.__xss=1&gt;</p>`——不执行且文本完整保留；引号变体 `<img src=x onerror="window.__xss3=1">` 被 marked 识别为真实标签后经 DOMPurify 消毒为 `<img src="x">`（onerror 剥离）。两条路径均不执行 |
| 2 | intents 含 `<script>alert(1)</script>` 时显示纯文本不执行 | ✅ 通过 | handleIntentsEvent 经 escapeHtml 转义：3 个意图标签均渲染为 `<span>` 纯文本（含 `<script>`、`<img onerror>` 载荷），DOM 中无 script/img 元素，innerHTML 为 `&lt;script&gt;` 实体 |
| 3 | `<a href="javascript:alert(1)">` 危险协议被净化 | ✅ 通过 | markdown 链接与裸 `<a>` 标签的 javascript: href 均被 DOMPurify 移除（0 个存活），https 正常链接保留；data:text/html 与 `<iframe src="javascript:...">` 也被净化 |
| 4 | 正常 Markdown（标题/列表/代码块/链接/表格）渲染不受影响 | ✅ 通过 | h1、无序列表、行内代码、pre>code 代码块、a[href=https]、GFM 表格（th/td）全部正常渲染，md-rendered 类正确添加 |
| 5 | escapeHtml 实现正确（& < > " ' 全覆盖） | ❌ 未通过 | `div.textContent → div.innerHTML` 的序列化规范只转义 `&` `<` `>`，**`"` 和 `'` 原样返回**（实测 `escapeHtml('<>"\'&') === '&lt;&gt;"\'&amp;'`）。当前唯一调用点（intent 标签，元素内容上下文）中引号无危害、无实际 XSS 漏洞，但不满足 AC 明确的全覆盖要求 |
| 6 | marked 或 DOMPurify 任一不可用时降级为 textContent | ✅ 通过 | 三种组合实测（双库缺失 / 仅缺 DOMPurify / 仅缺 marked）：renderOutput 均不抛错、不走 HTML 渲染（无 img/strong/h1 元素）、载荷与 markdown 语法以纯文本原文呈现 |
| 7 | optimize.html CDN 标签 + 本地降级逻辑正确 | ✅ 通过 | CDN `dompurify@3` 主版本锁定；`window.DOMPurify \|\| document.write('<script src="/static/vendor/purify.min.js"><\/script>')` 降级模式正确（含 `\/` 转义）；`static/vendor/purify.min.js` 存在（29204 字节，DOMPurify 3.4.14，已在 jsdom 中实测成功加载且 sanitize 功能正常）；`/static` 挂载于 backend/main.py:38，路径有效 |
| 8 | 任务 10 的错误处理逻辑未被破坏 | ✅ 通过 | 3 个回归场景 12 项断言全过：非 2xx（detail 显示 + toast + 复制禁用 + 按钮恢复）、SSE error 事件（错误显示 + 复制禁用 + 不走 md 渲染 + intents 进度条不受破坏）、成功流（markdown 渲染 + 流内注入载荷被消毒 + 复制启用） |
| 9 | node --check static/js/optimize.js 通过 | ✅ 通过 | 零报错 |

### 判定：FAIL

| # | 严重度 | 位置 | 原因 | 修改建议 |
|---|--------|------|------|----------|
| 1 | 中等 | static/js/optimize.js:25-29 | escapeHtml 采用 `textContent → innerHTML` 方案，HTML 文本节点序列化规范只转义 `&` `<` `>`，引号 `"` `'` 不转义，不满足 AC-5 全覆盖要求。当前调用点在元素内容上下文（intent 标签）中无实际漏洞，但该工具函数一旦被用于属性上下文（如 `title="..."`、`data-x="..."`）即可被引号闭合属性逃逸，属潜在误用隐患 | 改为正则全量转义：`String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))` |

### 轻微建议（不影响判定）

1. templates/optimize.html:65 — CDN 版本 `dompurify@3` 为主版本锁定，CDN 小版本会持续漂移（本地降级为 3.4.14），极端情况下 CDN 与本地行为可能有细微差异。建议锁定到 `3.4.14`，或等待任务 18（marked.js 本地化）时一并彻底本地化。

## 第 2 次测试（重测）

- 修正内容：escapeHtml 由 `textContent → innerHTML` 方案改为正则全量转义（optimize.js:26-32，HTML_ESCAPE_MAP 五字符 + replace 单次遍历）
- 测试方式：重跑完整 jsdom 攻击载荷套件（/tmp/task11-test/test-xss.cjs，读取最新源码，marked@15.0.12 + 本地 purify.min.js 3.4.14），共 56 项断言；`node --check` 通过

### 验收标准验证

| # | 验收标准 | 结果 | 说明 |
|---|---------|------|------|
| 1 | `<img src=x onerror=...>` 不执行，文本内容保留 | ✅ 通过 | 回归通过 |
| 2 | intents 含 `<script>` 显示纯文本不执行 | ✅ 通过 | 回归通过 |
| 3 | `javascript:` 危险协议被净化 | ✅ 通过 | 回归通过 |
| 4 | 正常 Markdown 渲染不受影响 | ✅ 通过 | 回归通过 |
| 5 | escapeHtml 实现正确（& < > " ' 全覆盖） | ✅ 通过 | 实测 `escapeHtml('<>"\'&')` = `&lt;&gt;&quot;&#39;&amp;`，五字符全覆盖；null/undefined 容错保持；replace 单次遍历无双重转义问题（`&` → `&amp;` 即停） |
| 6 | 库不可用降级为 textContent | ✅ 通过 | 三种组合回归通过 |
| 7 | CDN 标签 + 本地降级逻辑正确 | ✅ 通过 | 回归通过（本地 purify.min.js 实测加载成功，3.4.14） |
| 8 | 任务 10 错误处理逻辑未被破坏 | ✅ 通过 | 3 场景 12 项断言回归全过 |
| 9 | node --check 通过 | ✅ 通过 | 零报错 |

汇总：PASS=56 FAIL=0

### 判定：PASS

| # | 上次问题 | 当前状态 |
|---|---------|---------|
| 1 | escapeHtml 引号未转义（AC-5，中等） | ✅ 已修复 |

### Prompt 效果评估

| 维度 | 评分 | 说明 |
|------|------|------|
| 需求清晰度 | ⭐3 | 任务描述明确指出消毒方案（DOMPurify）、降级策略与转义范围，dev 理解和实现方向正确 |
| 验收标准质量 | ⭐3 | 9 条 AC 全部可执行、可构造载荷验证，且覆盖降级与回归场景；AC-5 的"全覆盖"要求准确预判了引号转义缺陷，一轮即定位问题 |
| 修正效率 | ⭐3 | 1 轮修正即通过，修复实现（正则 + 映射表）优于最低要求，且注释说明了引号转义的原因 |
