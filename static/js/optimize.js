/**
 * 优化页交互：加载模板/LLM配置、流式优化、意图覆盖状态、复制结果
 * v4: 修复 SSE 事件分割(\n\n)、header 用独立变量、统一 var 风格
 */

var templateSelect = document.getElementById('template-select');
var llmSelect = document.getElementById('llm-select');
var optimizeBtn = document.getElementById('optimize-btn');
var promptInput = document.getElementById('prompt-input');
var outputArea = document.getElementById('output-area');
var copyBtn = document.getElementById('copy-btn');
var charCount = document.getElementById('char-count');
var intentBar = document.getElementById('intent-bar');
var intentList = document.getElementById('intent-list');
var intentVerify = document.getElementById('intent-verify');

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

// 版本标记
optimizeBtn.textContent = '优化 v4';
charCount.textContent = 'v4 loaded';

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
    outputArea.textContent = '';
    copyBtn.disabled = true;
    if (intentBar) intentBar.style.display = 'none';

    try {
        var resp = await fetch('/api/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt, template_id: templateId, llm_config_id: llmConfigId })
        });

        var reader = resp.body.getReader();
        var decoder = new TextDecoder();
        var fullText = '';
        var buffer = '';
        var intentsShown = false;
        var intentHeaderText = '';  // 独立变量保存意图头，不依赖 textContent 解析

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
                    // 显示意图信息
                    intentsShown = true;
                    intentHeaderText = '[意图识别] ' + data.intents.length + ' 个意图: ' + data.intents.join(' | ') + '\n' + (data.summary || '') + '\n\n---\n\n';
                    outputArea.textContent = intentHeaderText;
                    if (intentBar) {
                        intentBar.style.display = 'block';
                        if (intentList) {
                            var html = '<span class="intent-label">识别到 ' + data.intents.length + ' 个意图：</span>';
                            data.intents.forEach(function(i) { html += '<span class="intent-tag">' + i + '</span>'; });
                            intentList.innerHTML = html;
                        }
                        if (intentVerify) intentVerify.innerHTML = '<span class="intent-pending">验证中...</span>';
                    }
                } else if (data.type === 'verify') {
                    if (intentBar && intentVerify) {
                        if (data.coverage_rate >= 1.0) {
                            intentVerify.innerHTML = '<span class="intent-pass">所有意图已覆盖</span>';
                        } else {
                            var rate = Math.round(data.coverage_rate * 100);
                            var missingHtml = '';
                            if (data.missing) data.missing.forEach(function(m) { missingHtml += '<span class="intent-missing-tag">' + m + '</span>'; });
                            intentVerify.innerHTML = '<span class="intent-warn">覆盖率 ' + rate + '%，可能未覆盖：</span>' + missingHtml;
                        }
                    }
                } else if (data.content) {
                    fullText += data.content;
                    if (intentsShown) {
                        // 用独立变量拼接，不依赖 textContent 解析
                        outputArea.textContent = intentHeaderText + fullText;
                    } else {
                        outputArea.textContent = fullText;
                    }
                }
            }
        }

        copyBtn.disabled = false;
    } catch (err) {
        outputArea.textContent = '优化失败: ' + err.message;
    } finally {
        optimizeBtn.disabled = false;
        optimizeBtn.textContent = '优化';
    }
});

// ── 复制 ──

copyBtn.addEventListener('click', function() {
    navigator.clipboard.writeText(outputArea.textContent).then(function() {
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
