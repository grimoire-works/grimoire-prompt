/**
 * 历史记录页交互：分页列表 + 详情展示 + 删除/清空
 * XSS 策略：动态文本一律 createElement/textContent；
 *          仅优化后提示词的 Markdown 渲染走 DOMPurify.sanitize(marked.parse(...))，
 *          任一库不可用时降级 textContent
 */

const historyList = document.getElementById('history-list');
const historyDetail = document.getElementById('history-detail');
const clearBtn = document.getElementById('clear-btn');
const prevBtn = document.getElementById('prev-page');
const nextBtn = document.getElementById('next-page');
const pageInfo = document.getElementById('page-info');

const PAGE_SIZE = 20;
const SUMMARY_MAX = 60;

const markedAvailable = typeof marked !== 'undefined' && typeof marked.parse === 'function';
const purifyAvailable = typeof DOMPurify !== 'undefined' && typeof DOMPurify.sanitize === 'function';

let page = 1;
let total = 0;
let items = [];
let currentId = null;

// ── 加载 ──

async function loadHistory() {
    let data;
    try {
        const resp = await fetch('/api/history?page=' + page + '&size=' + PAGE_SIZE);
        if (!resp.ok) {
            showToast('加载历史失败 (' + resp.status + ')', 'error');
            return;
        }
        data = await resp.json();
    } catch (err) {
        showToast('加载历史失败: ' + err.message, 'error');
        return;
    }
    items = Array.isArray(data.items) ? data.items : [];
    total = data.total || 0;
    renderList();
    renderPagination();
    // 当前选中记录已被删除（不在本页）时回到占位态
    if (currentId && !items.some(it => it.id === currentId)) {
        currentId = null;
        renderPlaceholder();
    }
}

// ── 列表渲染 ──

function renderList() {
    historyList.innerHTML = '';
    if (items.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'history-empty';
        empty.textContent = total === 0 ? '暂无优化历史记录' : '本页没有记录';
        historyList.appendChild(empty);
        return;
    }
    items.forEach(h => {
        const li = document.createElement('li');
        li.dataset.id = h.id;
        if (h.id === currentId) li.className = 'active';

        const title = document.createElement('div');
        title.className = 'history-item-title';
        title.textContent = summarize(h.original_prompt);

        const meta = document.createElement('div');
        meta.className = 'history-item-meta';
        meta.appendChild(metaSpan(formatTime(h.created_at)));
        meta.appendChild(metaSpan('模板: ' + (h.template_id || '-')));
        const coverage = metaSpan(coverageText(h.intent_coverage));
        coverage.classList.add(coverageClass(h.intent_coverage));
        meta.appendChild(coverage);

        li.appendChild(title);
        li.appendChild(meta);
        li.addEventListener('click', () => selectHistory(h.id));
        historyList.appendChild(li);
    });
}

function renderPagination() {
    const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = page >= maxPage || items.length === 0;
    pageInfo.textContent = '共 ' + total + ' 条 · 第 ' + page + '/' + maxPage + ' 页';
}

// ── 详情渲染 ──

function selectHistory(id) {
    currentId = id;
    renderList();
    const h = items.find(it => it.id === id);
    if (h) renderDetail(h);
}

function renderPlaceholder() {
    historyDetail.innerHTML = '';
    const ph = document.createElement('div');
    ph.className = 'detail-placeholder';
    ph.textContent = '选择一条记录查看详情';
    historyDetail.appendChild(ph);
}

function renderDetail(h) {
    historyDetail.innerHTML = '';

    // 头部：时间/模板 + 删除按钮
    const header = document.createElement('div');
    header.className = 'history-detail-header';
    const time = document.createElement('span');
    time.className = 'history-time';
    time.textContent = formatTime(h.created_at) + ' · 模板: ' + (h.template_id || '-');
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-sm btn-danger';
    delBtn.textContent = '删除';
    delBtn.addEventListener('click', () => deleteHistory(h.id));
    header.appendChild(time);
    header.appendChild(delBtn);

    // 原始提示词
    const origSection = section('原始提示词');
    const origBox = document.createElement('div');
    origBox.className = 'history-original';
    origBox.textContent = h.original_prompt || '';
    origSection.appendChild(origBox);

    // 意图与覆盖率
    const metaSection = section('意图与覆盖率');
    const intentRow = document.createElement('div');
    intentRow.className = 'history-intent-row';
    const intentLabel = document.createElement('span');
    intentLabel.className = 'intent-label';
    intentLabel.textContent = '意图标签';
    const intentTags = document.createElement('span');
    intentTags.className = 'coverage-tags';
    if (Array.isArray(h.original_intents) && h.original_intents.length > 0) {
        h.original_intents.forEach(intent => {
            const tag = document.createElement('span');
            tag.className = 'intent-tag';
            tag.textContent = intent;
            intentTags.appendChild(tag);
        });
    } else {
        const none = document.createElement('span');
        none.className = 'intent-pending';
        none.textContent = '未记录';
        intentTags.appendChild(none);
    }
    intentRow.appendChild(intentLabel);
    intentRow.appendChild(intentTags);
    metaSection.appendChild(intentRow);

    const coverageRow = document.createElement('div');
    coverageRow.className = 'history-coverage-row';
    const coverageLabel = document.createElement('span');
    coverageLabel.className = 'intent-label';
    coverageLabel.textContent = '意图覆盖率';
    if (typeof h.intent_coverage === 'number' && isFinite(h.intent_coverage)) {
        const rate = Math.round(h.intent_coverage * 100);
        const track = document.createElement('div');
        track.className = 'coverage-progress-track';
        track.setAttribute('role', 'progressbar');
        track.setAttribute('aria-valuenow', String(rate));
        track.setAttribute('aria-valuemin', '0');
        track.setAttribute('aria-valuemax', '100');
        const fill = document.createElement('div');
        fill.className = 'coverage-progress-fill ' + coverageClass(h.intent_coverage);
        fill.style.width = rate + '%';
        track.appendChild(fill);
        const percent = document.createElement('span');
        percent.className = 'coverage-percent';
        percent.textContent = rate + '%';
        coverageRow.appendChild(coverageLabel);
        coverageRow.appendChild(track);
        coverageRow.appendChild(percent);
    } else {
        const none = document.createElement('span');
        none.className = 'intent-pending';
        none.textContent = '未记录';
        coverageRow.appendChild(coverageLabel);
        coverageRow.appendChild(none);
    }
    metaSection.appendChild(coverageRow);

    // 优化后提示词（Markdown 渲染，唯一允许 innerHTML 的路径，必须消毒）
    const optSection = section('优化后提示词');
    const mdBox = document.createElement('div');
    mdBox.className = 'output-content history-md';
    const optimized = h.optimized_prompt || '';
    if (optimized && markedAvailable && purifyAvailable) {
        mdBox.innerHTML = DOMPurify.sanitize(marked.parse(optimized));
        mdBox.classList.add('md-rendered');
    } else {
        mdBox.textContent = optimized || '（空）';
    }
    optSection.appendChild(mdBox);

    historyDetail.appendChild(header);
    historyDetail.appendChild(origSection);
    historyDetail.appendChild(metaSection);
    historyDetail.appendChild(optSection);
}

// ── 删除 / 清空 ──

async function deleteHistory(id) {
    if (!confirm('确定删除该条记录？')) return;
    try {
        const resp = await fetch('/api/history/' + encodeURIComponent(id), { method: 'DELETE' });
        if (!resp.ok) {
            showToast('删除失败 (' + resp.status + ')', 'error');
            return;
        }
        showToast('已删除', 'success');
    } catch (err) {
        showToast('删除失败: ' + err.message, 'error');
        return;
    }
    // 当前页删空后回退一页
    if (items.length === 1 && page > 1) page -= 1;
    await loadHistory();
}

async function clearAll() {
    if (!confirm('确定清空全部历史记录？此操作不可恢复。')) return;
    try {
        const resp = await fetch('/api/history', { method: 'DELETE' });
        if (!resp.ok) {
            showToast('清空失败 (' + resp.status + ')', 'error');
            return;
        }
        showToast('已清空', 'success');
    } catch (err) {
        showToast('清空失败: ' + err.message, 'error');
        return;
    }
    page = 1;
    currentId = null;
    renderPlaceholder();
    await loadHistory();
}

// ── 工具函数 ──

function summarize(text) {
    const flat = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    if (!flat) return '（空）';
    return flat.length > SUMMARY_MAX ? flat.slice(0, SUMMARY_MAX) + '...' : flat;
}

function formatTime(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
        + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function coverageText(coverage) {
    if (typeof coverage !== 'number' || !isFinite(coverage)) return '覆盖率未记录';
    return '覆盖率 ' + Math.round(coverage * 100) + '%';
}

function coverageClass(coverage) {
    if (typeof coverage !== 'number' || !isFinite(coverage)) return '';
    const rate = Math.round(coverage * 100);
    if (rate >= 80) return 'coverage-high';
    if (rate >= 50) return 'coverage-medium';
    return 'coverage-low';
}

function metaSpan(text) {
    const span = document.createElement('span');
    span.textContent = text;
    return span;
}

function section(title) {
    const sec = document.createElement('div');
    sec.className = 'history-section';
    const h4 = document.createElement('h4');
    h4.textContent = title;
    sec.appendChild(h4);
    return sec;
}

function showToast(msg, type = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
}

// ── 事件绑定 ──

prevBtn.addEventListener('click', () => {
    if (page <= 1) return;
    page -= 1;
    loadHistory();
});

nextBtn.addEventListener('click', () => {
    if (page >= Math.ceil(total / PAGE_SIZE)) return;
    page += 1;
    loadHistory();
});

clearBtn.addEventListener('click', clearAll);

loadHistory();
