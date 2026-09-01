/**
 * 优化页交互：加载模板/LLM配置、流式优化、意图覆盖率进度条、复制结果
 * v8: XSS 安全修复（intent 标签转义 + marked 渲染结果 DOMPurify 消毒）
 * v9: 流式渲染节流（content 事件合并渲染，约 100ms 间隔，首个 chunk 立即渲染，流结束同步完成最终渲染）
 */

var templateSelect = document.getElementById('template-select');
var llmSelect = document.getElementById('llm-select');
var optimizeBtn = document.getElementById('optimize-btn');
var promptInput = document.getElementById('prompt-input');
var outputArea = document.getElementById('output-area');
var copyBtn = document.getElementById('copy-btn');
var charCount = document.getElementById('char-count');
var intentCoverageBar = document.getElementById('intent-coverage-bar');
var coverageProgressFill = document.getElementById('coverage-progress-fill');
var coveragePercent = document.getElementById('coverage-percent');
var coverageStatus = document.getElementById('coverage-status');
var coverageTags = document.getElementById('coverage-tags');

var markedAvailable = typeof marked !== 'undefined' && typeof marked.parse === 'function';
var purifyAvailable = typeof DOMPurify !== 'undefined' && typeof DOMPurify.sanitize === 'function';

/**
 * HTML 转义：LLM 输出（intent 标签等）不可信，拼接 HTML 前必须转义
 * 全量转义 & < > " '（引号也转义，防止未来误用于属性上下文时被引号闭合属性逃逸）
 */
var HTML_ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function(ch) {
        return HTML_ESCAPE_MAP[ch];
    });
}

/**
 * 将 Markdown 文本渲染到 outputArea
 * marked + DOMPurify 均可用时渲染为消毒后的 HTML（LLM 输出不可信，禁止直接 innerHTML），
 * 任一不可用时降级为纯文本
 */
function renderOutput(text) {
    if (markedAvailable && purifyAvailable) {
        outputArea.innerHTML = DOMPurify.sanitize(marked.parse(text));
        outputArea.classList.add('md-rendered');
    } else {
        outputArea.textContent = text;
    }
}

// ── 意图覆盖率进度条 ──

/**
 * 重置覆盖率进度条到初始状态
 */
function resetCoverageBar() {
    if (!intentCoverageBar) return;
    if (coverageProgressFill) {
        coverageProgressFill.style.width = '0%';
        coverageProgressFill.className = 'coverage-progress-fill';
    }
    if (coveragePercent) coveragePercent.textContent = '0%';
    if (coverageStatus) coverageStatus.textContent = '';
    if (coverageTags) coverageTags.innerHTML = '';
    var track = intentCoverageBar.querySelector('.coverage-progress-track');
    if (track) track.setAttribute('aria-valuenow', '0');
    intentCoverageBar.style.display = 'none';
}

/**
 * 处理 SSE intents 事件：显示进度条（0%）+ 意图标签
 */
function handleIntentsEvent(data) {
    if (!intentCoverageBar || !data.intents || data.intents.length === 0) return;

    intentCoverageBar.style.display = '';

    if (coveragePercent) coveragePercent.textContent = '0%';
    if (coverageStatus) coverageStatus.textContent = '验证中...';

    if (coverageTags) {
        var html = '';
        data.intents.forEach(function(intent) {
            html += '<span class="intent-tag">' + escapeHtml(intent) + '</span>';
        });
        coverageTags.innerHTML = html;
    }
}

/**
 * 处理 SSE verify 事件：进度条动画到目标百分比 + 颜色变化 + 状态文案
 */
function handleVerifyEvent(data) {
    if (!intentCoverageBar) return;

    var rate = Math.round(data.coverage_rate * 100);

    // 更新进度条宽度（CSS transition 会自动动画）
    if (coverageProgressFill) {
        coverageProgressFill.className = 'coverage-progress-fill';
        if (rate >= 80) {
            coverageProgressFill.classList.add('coverage-high');
        } else if (rate >= 50) {
            coverageProgressFill.classList.add('coverage-medium');
        } else {
            coverageProgressFill.classList.add('coverage-low');
        }
        coverageProgressFill.style.width = rate + '%';
    }

    if (coveragePercent) coveragePercent.textContent = rate + '%';

    // 更新状态文案
    if (coverageStatus) {
        if (data.coverage_rate >= 1.0) {
            coverageStatus.textContent = '所有意图已覆盖';
        } else if (data.missing && data.missing.length > 0) {
            coverageStatus.textContent = '可能未覆盖：' + data.missing.join('、');
        } else {
            coverageStatus.textContent = '覆盖率 ' + rate + '%';
        }
    }

    // 更新无障碍属性
    var track = intentCoverageBar.querySelector('.coverage-progress-track');
    if (track) track.setAttribute('aria-valuenow', String(rate));
}

// ── 初始化加载 ──

async function loadTemplates() {
    const resp = await fetch('/api/templates');
    const templates = await resp.json();
    templateSelect.innerHTML = '';
    templates.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name + (t.is_builtin ? '' : ' *');
        templateSelect.appendChild(opt);
    });
}

async function loadLlmConfigs() {
    const resp = await fetch('/api/llm-configs');
    const configs = await resp.json();
    llmSelect.innerHTML = '<option value="">默认</option>';
    configs.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name + ' (' + c.model_name + ')';
        if (c.is_default) opt.textContent += ' \u2605';
        llmSelect.appendChild(opt);
    });
}

loadTemplates();
loadLlmConfigs();

// 初始化
optimizeBtn.textContent = '优化';
charCount.textContent = '0 字';

// ── 字数统计 ──

promptInput.addEventListener('input', function() {
    charCount.textContent = promptInput.value.length + ' \u5b57';
});

// ── 流式优化 ──

optimizeBtn.addEventListener('click', async function() {
    var prompt = promptInput.value.trim();
    var templateId = templateSelect.value;
    var llmConfigId = llmSelect.value || null;

    if (!prompt) { showToast('请输入提示词', 'error'); return; }
    if (!templateId) { showToast('请选择优化模板', 'error'); return; }

    optimizeBtn.disabled = true;
    optimizeBtn.textContent = '优化中...';
    outputArea.innerHTML = '';
    outputArea.classList.remove('md-rendered');
    outputArea.style.color = '';
    copyBtn.disabled = true;
    resetCoverageBar();

    // 本次优化是否失败（4xx 响应或 SSE error 事件），失败时复制按钮保持禁用
    var hasError = false;

    // ── 流式渲染节流 ──
    // content 事件只累积 fullText，渲染按 RENDER_INTERVAL_MS 时间节流合并，
    // 避免长输出时每个 chunk 都对完整文本做全量 marked.parse + sanitize 导致卡顿。
    // 节流状态定义在本次点击的闭包内，每次点击自然重置，上一轮的 pending 不会污染新一轮。
    // 注意：辅助函数必须定义在 fetch 之前，保证 HTTP 错误 / 网络异常等提前退出的路径
    // 也能在 finally 中安全调用 cancelPendingRender。
    // 首个 chunk 立即渲染（降低首屏延迟），之后进入节流。
    var RENDER_INTERVAL_MS = 100;
    var fullText = '';
    var renderTimer = null;
    var lastRenderTime = 0;

    function renderOutputNow() {
        lastRenderTime = Date.now();
        renderOutput(fullText);
    }

    // 首个 chunk 立即渲染；之后的多个 chunk 合并为一次定时渲染
    function scheduleRender() {
        if (lastRenderTime === 0) {
            renderOutputNow();
            return;
        }
        if (renderTimer !== null) return;
        var wait = Math.max(0, RENDER_INTERVAL_MS - (Date.now() - lastRenderTime));
        renderTimer = setTimeout(function() {
            renderTimer = null;
            renderOutputNow();
        }, wait);
    }

    // 取消 pending 渲染：错误路径调用，防止迟到的定时渲染覆盖错误文案
    function cancelPendingRender() {
        if (renderTimer !== null) {
            clearTimeout(renderTimer);
            renderTimer = null;
        }
    }

    // 流正常结束：取消定时并同步完成最终渲染，保证输出完整（复制按钮依赖 innerText）
    function flushFinalRender() {
        cancelPendingRender();
        renderOutputNow();
    }

    try {
        var resp = await fetch('/api/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt, template_id: templateId, llm_config_id: llmConfigId })
        });

        // 非 2xx：后端返回 JSON {"detail": "..."}（如模板不存在/未配置 LLM），读取并提示
        if (!resp.ok) {
            hasError = true;
            var httpErrMsg = '优化失败 (' + resp.status + ')';
            try {
                var errData = await resp.json();
                if (errData && errData.detail) httpErrMsg = errData.detail;
            } catch (e) { /* 响应体非 JSON 时保留容错文案 */ }
            outputArea.classList.remove('md-rendered');
            outputArea.textContent = httpErrMsg;
            outputArea.style.color = 'var(--color-danger, #ef476f)';
            showToast(httpErrMsg, 'error');
            return;
        }

        var reader = resp.body.getReader();
        var decoder = new TextDecoder();
        var buffer = '';

        while (true) {
            var result = await reader.read();
            if (result.done) break;

            buffer += decoder.decode(result.value, { stream: true });

            // 按 \n\n 分割完整 SSE 事件块
            while (buffer.indexOf('\n\n') !== -1) {
                var eventEnd = buffer.indexOf('\n\n');
                var eventBlock = buffer.substring(0, eventEnd);
                buffer = buffer.substring(eventEnd + 2);

                // 在事件块内提取 data: 行
                var lines = eventBlock.split('\n');
                var dataLine = '';
                for (var li = 0; li < lines.length; li++) {
                    var ln = lines[li].trim();
                    if (ln.indexOf('data: ') === 0) {
                        dataLine = ln.substring(6);
                        break;
                    }
                }
                if (!dataLine) continue;

                var data;
                try { data = JSON.parse(dataLine); } catch(e) { continue; }

                if (data.done) continue;

                if (data.type === 'intents') {
                    handleIntentsEvent(data);
                } else if (data.type === 'verify') {
                    handleVerifyEvent(data);
                } else if (data.type === 'error') {
                    // LLM 调用失败等流内错误：显示错误信息并标记本次失败
                    hasError = true;
                    var sseErrMsg = data.message || '优化失败';
                    outputArea.classList.remove('md-rendered');
                    outputArea.textContent = sseErrMsg;
                    outputArea.style.color = 'var(--color-danger, #ef476f)';
                    showToast(sseErrMsg, 'error');
                } else if (data.content) {
                    fullText += data.content;
                    scheduleRender();
                }
            }
        }

        // 流正常结束：立即完成最终渲染（含节流期间累积的尾部内容），
        // 再启用复制（复制读 outputArea.innerText，必须等最终渲染完成）
        if (!hasError) {
            if (fullText) flushFinalRender();
            copyBtn.disabled = false;
        }
    } catch (err) {
        outputArea.classList.remove('md-rendered');
        outputArea.textContent = '优化失败: ' + err.message;
        outputArea.style.color = 'var(--color-danger, #ef476f)';
        showToast('优化失败: ' + err.message, 'error');
    } finally {
        // 成功/失败/异常统一收尾：清掉 pending 定时渲染。
        // 成功路径 flush 后已无定时；错误/异常路径防止迟到的渲染覆盖错误文案
        cancelPendingRender();
        optimizeBtn.disabled = false;
        optimizeBtn.textContent = '优化';
    }
});

// ── 复制（使用 innerText 获取纯文本，不含 HTML 标签） ──

copyBtn.addEventListener('click', function() {
    navigator.clipboard.writeText(outputArea.innerText).then(function() {
        showToast('已复制到剪贴板', 'success');
    });
});

// ── Toast ──

function showToast(msg, type) {
    var el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function() { el.remove(); }, 2000);
}
