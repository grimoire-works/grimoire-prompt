/**
 * 模板管理页交互
 */

const templateList = document.getElementById('template-list');
const detailPanel = document.getElementById('detail-panel');
const createBtn = document.getElementById('create-btn');

let templates = [];
let currentId = null;

async function loadTemplates() {
    const resp = await fetch('/api/templates');
    templates = await resp.json();
    renderList();
}

function renderList() {
    templateList.innerHTML = '';
    templates.forEach(t => {
        const li = document.createElement('li');
        li.dataset.id = t.id;
        li.className = t.id === currentId ? 'active' : '';
        li.innerHTML = escapeHtml(t.name) + (t.is_builtin ? '<span class="badge">内置</span>' : '');
        li.addEventListener('click', () => selectTemplate(t.id));
        templateList.appendChild(li);
    });
}

function selectTemplate(id) {
    currentId = id;
    renderList();
    const t = templates.find(x => x.id === id);
    if (!t) return;
    renderDetail(t);
}

function renderDetail(t) {
    const isReadonly = t.is_builtin;
    detailPanel.innerHTML = `
        <div class="edit-form">
            <div class="field">
                <label>模板名称</label>
                <input id="edit-name" value="${escapeHtml(t.name)}" ${isReadonly ? 'readonly' : ''}>
            </div>
            <div class="field">
                <label>描述</label>
                <input id="edit-desc" value="${escapeHtml(t.description || '')}" ${isReadonly ? 'readonly' : ''}>
            </div>
            <div class="field">
                <label>模板内容</label>
                <textarea id="edit-content" ${isReadonly ? 'readonly' : ''}>${escapeHtml(t.content)}</textarea>
            </div>
            <div class="form-actions">
                ${isReadonly
                    ? `<button class="btn btn-primary" onclick="cloneTemplate('${t.id}')">克隆为用户模板</button>`
                    : `<button class="btn btn-danger" onclick="deleteTemplate('${t.id}')">删除</button>
                       <button class="btn btn-primary" onclick="saveTemplate('${t.id}')">保存</button>`
                }
            </div>
        </div>
    `;
}

createBtn.addEventListener('click', () => {
    currentId = null;
    renderList();
    detailPanel.innerHTML = `
        <div class="edit-form">
            <div class="field">
                <label>模板名称</label>
                <input id="edit-name" placeholder="如：我的优化模板">
            </div>
            <div class="field">
                <label>描述</label>
                <input id="edit-desc" placeholder="简短描述模板用途">
            </div>
            <div class="field">
                <label>模板内容</label>
                <textarea id="edit-content" placeholder="输入优化模板的 prompt 内容..."></textarea>
            </div>
            <div class="form-actions">
                <button class="btn btn-primary" onclick="createTemplate()">创建</button>
            </div>
        </div>
    `;
});

async function saveTemplate(id) {
    const body = {
        name: document.getElementById('edit-name').value,
        content: document.getElementById('edit-content').value,
        description: document.getElementById('edit-desc').value,
    };
    const resp = await fetch(`/api/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (resp.ok) {
        showToast('保存成功', 'success');
        loadTemplates();
    } else {
        showToast('保存失败', 'error');
    }
}

async function createTemplate() {
    const name = document.getElementById('edit-name').value.trim();
    const content = document.getElementById('edit-content').value.trim();
    if (!name || !content) {
        showToast('名称和内容不能为空', 'error');
        return;
    }
    const resp = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name,
            content,
            description: document.getElementById('edit-desc').value,
        }),
    });
    if (resp.ok) {
        showToast('创建成功', 'success');
        loadTemplates();
    } else {
        showToast('创建失败', 'error');
    }
}

async function deleteTemplate(id) {
    if (!confirm('确定删除该模板？')) return;
    const resp = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    if (resp.ok) {
        currentId = null;
        detailPanel.innerHTML = '<div class="detail-placeholder">选择一个模板查看或编辑</div>';
        loadTemplates();
    } else {
        showToast('删除失败', 'error');
    }
}

async function cloneTemplate(id) {
    const t = templates.find(x => x.id === id);
    if (!t) return;
    const resp = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: t.name + ' (副本)',
            content: t.content,
            description: t.description,
        }),
    });
    if (resp.ok) {
        showToast('克隆成功', 'success');
        loadTemplates();
    }
}

const HTML_ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, ch => HTML_ESCAPE_MAP[ch]);
}

function showToast(msg, type = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
}

loadTemplates();
