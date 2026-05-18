/**
 * 设置页交互：LLM 配置管理
 */

const configList = document.getElementById('config-list');
const detailPanel = document.getElementById('detail-panel');
const createBtn = document.getElementById('create-btn');

let configs = [];
let currentId = null;

async function loadConfigs() {
    const resp = await fetch('/api/llm-configs');
    configs = await resp.json();
    renderList();
}

function renderList() {
    configList.innerHTML = '';
    configs.forEach(c => {
        const li = document.createElement('li');
        li.dataset.id = c.id;
        li.className = c.id === currentId ? 'active' : '';
        li.textContent = `${c.name} (${c.model_name})`;
        li.addEventListener('click', () => selectConfig(c.id));
        configList.appendChild(li);
    });
}

function selectConfig(id) {
    currentId = id;
    renderList();
    const c = configs.find(x => x.id === id);
    if (!c) return;
    renderForm(c);
}

function renderForm(c) {
    const providerOptions = ['openai', 'openai_compatible', 'anthropic']
        .map(p => `<option value="${p}" ${c.provider === p ? 'selected' : ''}>${p}</option>`)
        .join('');

    detailPanel.innerHTML = `
        <div class="edit-form">
            <div class="field">
                <label>配置名称</label>
                <input id="cfg-name" value="${escapeHtml(c.name)}">
            </div>
            <div class="field">
                <label>Provider</label>
                <select id="cfg-provider">${providerOptions}</select>
            </div>
            <div class="field">
                <label>API Key</label>
                <input id="cfg-apikey" type="password" placeholder="输入新的 API Key（留空不修改）">
            </div>
            <div class="field">
                <label>Base URL（OpenAI 兼容端点必填）</label>
                <input id="cfg-baseurl" value="${escapeHtml(c.base_url || '')}" placeholder="如 https://api.deepseek.com">
            </div>
            <div class="field">
                <label>模型名称</label>
                <input id="cfg-model" value="${escapeHtml(c.model_name)}">
            </div>
            <div class="field">
                <label>Temperature: <span id="temp-val">${c.temperature}</span></label>
                <input id="cfg-temp" type="range" min="0" max="2" step="0.1" value="${c.temperature}">
            </div>
            <div class="field">
                <label>Max Tokens</label>
                <input id="cfg-maxtokens" type="number" value="${c.max_tokens}">
            </div>
            <div class="field">
                <label>
                    <input id="cfg-default" type="checkbox" ${c.is_default ? 'checked' : ''}>
                    设为默认
                </label>
            </div>
            <div class="form-actions">
                <button class="btn" onclick="testConfig('${c.id}')">测试连接</button>
                <button class="btn btn-danger" onclick="deleteConfig('${c.id}')">删除</button>
                <button class="btn btn-primary" onclick="saveConfig('${c.id}')">保存</button>
            </div>
        </div>
    `;

    document.getElementById('cfg-temp').addEventListener('input', (e) => {
        document.getElementById('temp-val').textContent = e.target.value;
    });
}

// 新建表单
createBtn.addEventListener('click', () => {
    currentId = null;
    renderList();
    const providerOptions = ['openai', 'openai_compatible', 'anthropic']
        .map(p => `<option value="${p}">${p}</option>`)
        .join('');

    detailPanel.innerHTML = `
        <div class="edit-form">
            <div class="field">
                <label>配置名称</label>
                <input id="cfg-name" placeholder="如：我的 DeepSeek">
            </div>
            <div class="field">
                <label>Provider</label>
                <select id="cfg-provider">${providerOptions}</select>
            </div>
            <div class="field">
                <label>API Key</label>
                <input id="cfg-apikey" type="password" placeholder="sk-...">
            </div>
            <div class="field">
                <label>Base URL（OpenAI 兼容端点必填）</label>
                <input id="cfg-baseurl" placeholder="如 https://api.deepseek.com">
            </div>
            <div class="field">
                <label>模型名称</label>
                <input id="cfg-model" placeholder="如 deepseek-chat">
            </div>
            <div class="field">
                <label>Temperature: <span id="temp-val">0.7</span></label>
                <input id="cfg-temp" type="range" min="0" max="2" step="0.1" value="0.7">
            </div>
            <div class="field">
                <label>Max Tokens</label>
                <input id="cfg-maxtokens" type="number" value="4096">
            </div>
            <div class="field">
                <label>
                    <input id="cfg-default" type="checkbox">
                    设为默认
                </label>
            </div>
            <div class="form-actions">
                <button class="btn btn-primary" onclick="createConfig()">创建</button>
            </div>
        </div>
    `;

    document.getElementById('cfg-temp').addEventListener('input', (e) => {
        document.getElementById('temp-val').textContent = e.target.value;
    });
});

async function saveConfig(id) {
    const body = buildBody();
    const resp = await fetch(`/api/llm-configs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (resp.ok) {
        showToast('保存成功', 'success');
        loadConfigs();
    } else {
        showToast('保存失败', 'error');
    }
}

async function createConfig() {
    const body = buildBody();
    if (!body.name || !body.model_name) {
        showToast('名称和模型名称不能为空', 'error');
        return;
    }
    const resp = await fetch('/api/llm-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (resp.ok) {
        showToast('创建成功', 'success');
        loadConfigs();
    } else {
        showToast('创建失败', 'error');
    }
}

async function deleteConfig(id) {
    if (!confirm('确定删除该配置？')) return;
    const resp = await fetch(`/api/llm-configs/${id}`, { method: 'DELETE' });
    if (resp.ok) {
        currentId = null;
        detailPanel.innerHTML = '<div class="detail-placeholder">选择一个配置查看或编辑</div>';
        loadConfigs();
    }
}

async function testConfig(id) {
    showToast('测试连接中...', '');
    const resp = await fetch(`/api/llm-configs/${id}/test`, { method: 'POST' });
    const data = await resp.json();
    if (data.ok) {
        showToast('连接成功', 'success');
    } else {
        showToast('连接失败', 'error');
    }
}

function buildBody() {
    const apiKey = document.getElementById('cfg-apikey').value.trim();
    const body = {
        name: document.getElementById('cfg-name').value.trim(),
        provider: document.getElementById('cfg-provider').value,
        base_url: document.getElementById('cfg-baseurl').value.trim() || null,
        model_name: document.getElementById('cfg-model').value.trim(),
        temperature: parseFloat(document.getElementById('cfg-temp').value),
        max_tokens: parseInt(document.getElementById('cfg-maxtokens').value),
        is_default: document.getElementById('cfg-default').checked,
    };
    if (apiKey) body.api_key = apiKey;
    return body;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showToast(msg, type = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
}

loadConfigs();
