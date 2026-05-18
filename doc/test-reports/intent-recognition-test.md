# 测试报告 - 意图识别与展示功能

## 第 1 次测试

### 测试范围

用户指定了 5 个测试维度：后端 SSE 事件流、前端 JS 代码审查、HTML 模板审查、后端意图模块审查、端到端流程验证。

### 验收标准验证

基于用户指定的测试范围，逐条验证：

| # | 验收标准 | 结果 | 说明 |
|---|---------|------|------|
| 1 | SSE 事件顺序：intents -> content -> verify -> done | ✅ 通过 | `optimize.py:47-72` 严格按 ①intents ②content 流 ③verify ④done 顺序 yield |
| 2 | intents 事件包含 intents 数组和 summary 字段 | ✅ 通过 | `optimize.py:48` JSON 包含 `type`, `intents`, `summary` 三个字段 |
| 3 | verify 事件包含 covered, missing, coverage_rate | ✅ 通过 | `optimize.py:71` JSON 包含 `type: 'verify'`, `covered`, `missing`, `coverage_rate` |
| 4 | done 事件包含 done: true 和 history_id | ✅ 通过 | `optimize.py:72` JSON 包含 `done: True`, `history_id` |
| 5 | 每个 SSE 事件格式为 `data: JSON\n\n` | ✅ 通过 | 所有 yield 均使用 `f"data: {json.dumps(...)}` + `\n\n` 格式 |
| 6 | JS buffer 处理正确（跨 chunk 数据拼接） | ❌ 未通过 | **严重缺陷**：`optimize.js:93` 按 `\n` 逐行分割，但 SSE 规范以 `\n\n` 分割事件。当 chunk 边界出现在 `\n\n` 之间时，单个事件会被当作两行分别处理，导致 JSON 解析失败或数据丢失。当前实现碰巧能工作是因为服务端每个事件恰好占一行 data，但不符合 SSE 规范且在多行事件时会崩溃 |
| 7 | JS 正确解析 `data: ` 前缀 | ✅ 通过 | `optimize.js:99` 检查 `line.indexOf('data: ') !== 0` 并用 `substring(6)` 提取 |
| 8 | JS JSON 解析有容错处理 | ✅ 通过 | `optimize.js:103` 使用 try/catch 包裹 JSON.parse，失败时 continue 跳过 |
| 9 | JS intents 事件正确更新 DOM | ✅ 通过 | `optimize.js:107-120` 设置 outputArea 文本、显示 intent-bar、生成 intent-tag 标签 |
| 10 | JS verify 事件正确处理 | ✅ 通过 | `optimize.js:121-131` 根据 coverage_rate 显示 "已覆盖" 或 "覆盖率 N%，未覆盖" 信息 |
| 11 | JS content 事件追加逻辑正确 | ❌ 未通过 | **中等缺陷**：`optimize.js:136` 使用 `outputArea.textContent.split('---\n\n')[0]` 提取 header，但 `textContent` 中的换行在不同浏览器中可能为 `\n` 或 `\r\n`。此外，如果 LLM 优化内容本身包含 `---\n\n`，split 会截断 header 部分。应使用独立变量保存 header 而非依赖文本内容解析 |
| 12 | JS 代码有 ES6 兼容性问题 | ❌ 未通过 | **中等缺陷**：`optimize.js:6-15` 全局作用域使用 `const` 声明变量（const templateSelect, const llmSelect 等），ES6 语法。第 60 行函数体内使用 `var`，风格不一致。const/let 在 IE11 等旧浏览器不支持。需确认项目目标浏览器支持范围 |
| 13 | HTML 模板包含 intent-bar 元素 | ✅ 通过 | `optimize.html:46-49` 包含 `div#intent-bar.intent-bar`、`div#intent-list.intent-list`、`div#intent-verify.intent-verify` |
| 14 | CSS 包含 intent 相关样式类 | ✅ 通过 | `main.css:361-423` 包含 `.intent-bar`, `.intent-list`, `.intent-verify`, `.intent-label`, `.intent-tag`, `.intent-summary`, `.intent-pending`, `.intent-pass`, `.intent-warn`, `.intent-missing-tag` 完整样式定义 |
| 15 | intent.py 容错降级：提取失败返回空意图 | ✅ 通过 | `intent.py:81-83` except 块捕获所有异常，返回 `{"intents": [], "summary": ""}`，不阻塞主流程 |
| 16 | intent.py 容错降级：验证失败返回全部覆盖 | ✅ 通过 | `intent.py:123-126` except 块捕获所有异常，返回 `{"covered": original_intents, "missing": [], "coverage_rate": 1.0}`，不误报 |
| 17 | _parse_json_response 处理 markdown 代码块包裹 | ✅ 通过 | `intent.py:38-41` 检测 ` ``` ` 前缀并移除代码块标记行 |
| 18 | _parse_json_response 处理非标准 JSON（提取第一个 JSON 对象） | ✅ 通过 | `intent.py:48-55` 使用 `text.find("{")` 和 `text.rfind("}")` 提取子串并尝试解析 |
| 19 | _parse_json_response 空输入或无效输入返回 None | ✅ 通过 | `intent.py:56` 所有路径失败后返回 None，调用方（`extract_intents:77`, `verify_intents:114`）均检查 `if parsed and "intents" in parsed` / `if parsed and "covered" in parsed` |
| 20 | SSE 流使用正确的 Content-Type 和缓存头 | ✅ 通过 | `optimize.py:74-81` `media_type="text/event-stream"`，headers 含 `Cache-Control: no-cache` 和 `X-Accel-Buffering: no` |
| 21 | 历史记录保存包含意图信息 | ✅ 通过 | `optimize.py:62-68` 调用 `_save_history` 传入 `original_intents` 和 `intent_coverage`；`_save_history:127-137` 正确写入 `OptimizationHistory` 模型的 `original_intents` 和 `intent_coverage` 字段 |
| 22 | 无意图时跳过 intents 事件，直接输出 content | ✅ 通过 | `optimize.py:47` `if intents:` 条件判断，空列表不 yield intents 事件 |
| 23 | 静态编译检查通过 | ✅ 通过 | `python -m compileall backend/ -q` 零错误零警告 |

### 判定：FAIL

| # | 严重度 | 位置 | 原因 | 修改建议 |
|---|--------|------|------|----------|
| 1 | 严重 | `static/js/optimize.js:93` | SSE buffer 按 `\n` 逐行分割而非按 `\n\n` 分割事件。当网络延迟导致 chunk 在 `\n\n` 中间断裂时，单行 data 会被截断为两行，第一行缺少数据、第二行不以 `data: ` 开头被跳过。同时如果服务端未来发出多行 SSE 事件（如 `id:` + `data:`），当前逻辑也会出错。应改为先按 `\n\n` 分割完整事件，再在事件内按行解析。 | 将 buffer 按 `\n\n` 分割事件块，在每个事件块内再按 `\n` 分割行并提取 `data:` 行内容拼接后 JSON 解析 |
| 2 | 中等 | `static/js/optimize.js:136` | header 提取依赖 `textContent.split('---\n\n')[0]`，存在两个风险：(a) textContent 换行符在不同浏览器可能为 `\r\n`；(b) 若 LLM 生成内容含 `---\n\n` 会错误截断 header | 使用独立 JS 变量（如 `var intentHeader = ''`）在 intents 事件时保存 header 文本，content 事件时直接用 `intentHeader + fullText` |
| 3 | 中等 | `static/js/optimize.js:6-15` | 全局作用域使用 `const` 声明（ES6），但函数内部混用 `var`（ES5），风格不一致。若项目要求 ES5 兼容性，const 在 IE11 不支持；若允许 ES6，函数内也应统一使用 const/let | 统一为 ES6（const/let）或 ES5（var），选择一种风格贯穿全文件 |
