# 经验教训库

- [0609] 暗色模式下表单元素需要显式声明 color 属性
  - 原因：部分浏览器（尤其是 select）在暗色背景上不继承父元素的 color，导致出现白底黑字或黑底黑字
  - 解法：在基础规则 select, input, textarea 上显式设置 color: var(--color-text)，并在 html[data-theme="dark"] 选择器中再次强制声明

- [0609] .btn 在暗色模式下需要加 border 显式声明
  - 原因：.btn 默认 border: none，在亮色模式下用 background 区分按钮即可，但暗色模式下 surface-dim 背景与周围 surface 背景对比度不足，按钮边界消失
  - 解法：html[data-theme="dark"] .btn 添加 border: 1px solid var(--color-border)

- [0609] input[readonly] 和 textarea[readonly] 需要暗色模式降级样式
  - 原因：只读字段用 background+color 区分可编辑状态，基础规则已用 CSS 变量，但暗色模式下浏览器可能覆盖 readonly 输入框的样式
  - 解法：在 html[data-theme="dark"] 中为 readonly 表单元素单独声明 background/color/border-color

- [0901] SSE 流式接口的前置校验禁止返回普通 JSON 错误体
  - 原因：StreamingResponse 接口若在校验阶段返回 `{"error": "..."}`（HTTP 200），前端 fetch 后直接进入 SSE 解析循环，读不到 data: 行，用户静默失败无任何提示
  - 解法：SSE 接口所有流开始前的校验失败一律 `raise HTTPException(4xx, detail=...)`；流开始后的异常在流内发 `{"type": "error", "message": ...}` 事件 + `{"done": true}` 正常收尾，禁止让异常直接断流

- [0901] LLM 输出回显到页面前必须消毒，禁止直接 innerHTML
  - 原因：数据链路是「用户输入 → LLM 处理 → 回显」，LLM 输出可被构造的输入诱导（如 `<img src=x onerror=...>`、`<script>`），marked 默认不过滤 HTML，直接 innerHTML 会执行注入代码
  - 解法：HTML 渲染路径统一走 `DOMPurify.sanitize(marked.parse(text))`（CDN + static/vendor 本地降级，任一消毒库不可用则整体降级 textContent）；拼接 HTML 的动态文本（intent 标签等）先用 escapeHtml 转义；错误文案/状态文案一律 textContent

- [0901] 数据库字段加密后，所有读取该字段的旁路逻辑（脱敏、测试、导出）都要走解密
  - 原因：api_key 改为密文入库后，`_mask_api_key(cfg.api_key)` 直接对密文取末 4 位，返回的脱敏值变成随机密文片段，用户看不到熟悉的 key 尾号；只改写入路径不改读取路径是最常见的遗漏
  - 解法：梳理该字段全部读点（列表脱敏 / test 连接 / 实际调用 / 历史导出），统一先 `decrypt_secret` 再用；解密函数内置"失败按明文返回"兜底，一处实现处处兼容存量数据

- [0901] Fernet 密文比明文长约 120 字符，加密落库前先核对列宽
  - 原因：String(256) 列存 160 字符明文 key 没问题，但 Fernet 密文达 ~312 字符，超宽会被截断导致解密失败且无报错（SQLite 不强制 VARCHAR 长度，MySQL 才报错，问题在切换数据库时才暴露）
  - 解法：引入加密时按「最长明文 + ~120 字符」重估列宽（本例加宽到 String(512)），并在模型注释中记录换算依据；老库列宽靠启动迁移任务补齐

- [0901] 数据库中以 JSON 字符串（Text 列）存储的结构化字段，暴露到 API 时必须解析 + 脏数据兜底
  - 原因：模型层存的是 `json.dumps` 后的字符串（如 `["a","b"]`），直接透传给前端拿到的是字符串而非数组；且历史数据可能存在非法 JSON，`json.loads` 裸调会抛异常导致接口 500
  - 解法：响应组装处统一走解析函数：None/空串 → None；`json.loads` 捕获 TypeError/ValueError → None；再用 `isinstance(list)` + 逐项 `isinstance(str)` 校验结构，不合法一律返回 None，保证脏数据静默降级而非报错

- [0901] escapeHtml 工具函数禁止用 `textContent → innerHTML` 方式实现，必须正则全量转义 `& < > " '`
  - 原因：HTML 文本节点序列化规范只转义 `& < >`，引号 `"` `'` 原样返回；当前调用点在元素内容上下文无危害，但该工具函数一旦被复用到属性上下文（`title="..."`、`data-x="..."`），引号即可闭合属性造成逃逸
  - 解法：`String(str).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))`；工具函数按"最坏上下文"设计，不能只满足当前调用点

- [0901] 新页面布局优先复用已有布局类，而不是新造一套同类样式
  - 原因：历史页照搬模板管理页的 manage-sidebar/manage-detail/item-list/detail-placeholder 结构，若新起类名（如 history-sidebar），暗色模式覆盖、主题切换过渡动画、hover/active 态都要重新写一遍，极易漏掉某条暗色规则导致白字白底
  - 解法：页面骨架复用现有布局类，只为页面特有元素（分页条、摘要行、详情分区）新增样式且全部用 CSS 变量；这样暗色适配和过渡自动继承，新增 CSS 量最小

- [0901] 枚举型字段必须在 Pydantic schema 层用 Literal 校验，禁止自由字符串入库
  - 原因：provider 这类由运行时字典（PROVIDERS）分发处理的字段，若 schema 层是自由 str，非法值能顺利入库，直到 optimize/test 调 get_provider 才抛 ValueError 变成 500，错误暴露点远离写入点，排查成本高
  - 解法：schema 定义与分发字典键集一致的 `Literal[...]`（Update 用 `Literal[...] | None = None`），FastAPI 自动返回 422；新增合法值时同步改 Literal 与分发字典两处，并在注释中互相引用

- [0901] Base.metadata.create_all 只建新表不改已有表，模型加列必须配套启动迁移
  - 原因：老库升级后启动不报错，运行时查询才炸（"no such column"），问题暴露点远离变更点；SQLite 的 ALTER TABLE ADD COLUMN 加 NOT NULL 列必须带默认值，且无法修改已有列类型
  - 解法：create_all 之后跑 ensure_columns（inspect 对比 Base.metadata，缺列 ALTER TABLE 补齐）；列类型经 `column.type.compile(dialect)` 生成天然兼容 SQLite/MySQL；NOT NULL 列按「server_default > 标量 default > 按类型推导」补默认值，推导不出降级为可空列告警；已有列类型变更只日志提示不做（SQLite 无法 ALTER 改列）

- [0901] SSE 流式渲染做节流时，「成功收尾 flush、错误收尾 cancel」必须成对出现
  - 原因：节流靠 setTimeout 合并渲染，若流结束/出错后不清理定时器，迟到的定时回调会用旧内容覆盖刚写入的错误文案或最终结果；反之错误路径若做最终渲染，会冲掉错误提示
  - 解法：节流状态（timer、lastRenderTime）放在每次请求的闭包内，天然随请求重置；成功路径在启用依赖渲染结果的交互（复制按钮读 innerText 等）之前同步 flushFinalRender（clearTimeout + 立即渲染最终全文）；错误/异常路径与 finally 中只 cancelPendingRender 不渲染；首个 chunk 立即渲染一次以降低首屏延迟

- [0901] JS 块内函数声明在执行到声明语句前是 undefined，finally 中的清理函数必须定义在 try 之前
  - 原因：块级函数声明（Annex B）只在代码执行到所在块后才完成赋值；try 块内、首个 await 之前就 return/throw 的路径（如 HTTP 非 2xx 提前返回），走到 finally 时块内定义的清理函数还是 undefined，调用直接 TypeError
  - 解法：被 finally / catch 引用的清理与节流辅助函数统一定义在 try 之前（函数体顶部），只依赖闭包变量不依赖 try 内的执行顺序；验收测试必须覆盖「流开始前就失败」的路径才能暴露此类问题

- [0901] 前端第三方库（marked/DOMPurify 等）优先本地化到 static/vendor/，不做「CDN 为主 + 本地降级」
  - 原因：国内网络访问 jsdelivr/unpkg 大概率失败，核心功能依赖 CDN 等于核心功能大概率不可用；且 document.write 降级回退只在 HTML 层，JS 层还要维护 typeof 检测，两层逻辑叠加容易漏改
  - 解法：库文件直接放 static/vendor/（StaticFiles 挂载下子目录可直接访问），模板统一本地引用并移除 CDN 标签和 document.write 降级；「降级」只保留一层——JS 里 typeof 库检测，本地文件缺失（404 不执行）自动走 textContent 纯文本路径，页面不报错

- [0901] XSS 修复按「字段 × 写入点」排查，同名工具函数的多处副本要同步修
  - 原因：同一不可信字段（如模板名）会在列表项、详情表单、下拉框等多处回显，只修被报告的那一行，其他拼接点仍是漏洞；且 escapeHtml 在各 JS 文件各有一份副本，规范更新（正则全量转义含引号）后旧副本不会自动跟进，本例 templates.js 的副本仍是禁止的 textContent 实现，且正被用在属性上下文
  - 解法：修复时 grep 该字段在所有文件的全部 innerHTML/属性拼接点逐一确认；工具函数实现规范落地时，同步检查并更新每个副本（或抽公共文件），并在文件头注释标注版本变更

- [0901] 模板引用静态资源带 ?v= 缓存版本号时，文件内容每次变更必须同步 bump
  - 原因：浏览器按完整 URL（含查询串）缓存，JS 内容改了但 ?v= 不变，老用户会继续命中旧缓存，出现「代码已修但线上复现」的假象；本例 optimize.js 已迭代到 v9 内容，html 引用停留在 v=8
  - 解法：约定 JS 文件头注释维护版本号（如 `* v9: ...`），每次改动同时更新注释版本与模板引用的 ?v=N 两处；提交前检查 grep 模板中所有 ?v= 引用与对应文件头版本一致
