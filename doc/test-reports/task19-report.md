# 测试报告 - 任务 19: 前端收尾三处修复

## 第 1 次测试

### 验收标准验证

| # | 验收标准 | 结果 |
|---|---------|------|
| 1 | templates.js 列表渲染：模板名含 `<img src=x onerror=...>` 时显示纯文本不执行（escapeHtml 已应用于 t.name） | ✅ 通过 |
| 2 | escapeHtml 为正则全量转义（& < > " ' 五字符），用于 value="..." 属性上下文时引号不会闭合属性逃逸 | ✅ 通过 |
| 3 | optimize.html 引用 `optimize.js?v=9`（无 v=8 残留） | ✅ 通过 |
| 4 | optimize.js catch 分支：错误文案红色着色（var(--color-danger)）+ toast 提示，与 4xx/SSE error 分支行为一致 | ✅ 通过 |
| 5 | node --check 两个 js 文件通过；python -m compileall backend/ -q 零错误 | ✅ 通过 |
| 6 | 回归：renderDetail 表单、创建表单、克隆/删除按钮逻辑不受影响 | ✅ 通过 |

### 验证方法与证据

- **沙箱验证**（/tmp/task19-sandbox.js，node vm 加载真实源码 + mock DOM/fetch，共 31 项断言全部通过）：
  - AC1：恶意模板名渲染为 `&lt;img src=x ...` 纯文本实体，无未转义 `<img onerror` 注入；内置徽章与普通模板名渲染不受影响
  - AC2：`escapeHtml('<>"\'&') === '&lt;&gt;&quot;&#39;&amp;'`；`value="${escapeHtml(payload)}"` 中 payload 的双引号全部转义为 `&quot;`，属性无法被闭合逃逸；`&` 优先转义无双重实体问题；null/undefined 输入安全
  - AC4：fetch 抛异常（网络失败）→ catch 分支输出 `优化失败: network down`、`style.color = 'var(--color-danger, #ef476f)'`、toast error 弹出，与 4xx 分支（optimize.js:248-251）、SSE error 分支（optimize.js:296-299）三处行为一致；复制按钮保持禁用、优化按钮恢复可用
  - AC6：用户模板详情（三字段 + 删除/保存 + 无 readonly）、内置模板详情（readonly ×3 + 克隆按钮 + 无删除/保存）、创建表单（三字段 + 创建按钮）、克隆 POST 携带 "(副本)" 名称、DELETE 请求 URL 正确、删除后详情面板复位
- **静态检查**：
  - AC3：templates/optimize.html:66 为 `<script src="/static/js/optimize.js?v=9"></script>`；全仓 grep `v=8` 仅命中 doc/lessons-learned.md（经验记录本身）和 doc/plan.md（任务描述），模板/代码文件零残留
  - AC5：`node --check` templates.js、optimize.js 均通过；`python3 -m compileall backend/ -q` 零输出零错误
- **代码质量**：escapeHtml 从 DOM 依赖改为纯正则实现（templates.js:162-166），支持在非浏览器上下文使用；catch 分支的 `cancelPendingRender` 在 finally 中统一收尾，防止迟到定时渲染覆盖错误文案。轻微建议：escapeHtml/HTML_ESCAPE_MAP 在 templates.js 与 optimize.js 中重复定义，后续可考虑提取公共模块（不影响本次验收）。

### 判定：PASS
