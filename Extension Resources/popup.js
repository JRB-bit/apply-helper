const api = globalThis.browser ?? globalThis.chrome;
const MEM_KEY = 'ah_memory_v2';
const SET_KEY = 'ah_settings_v2';
const DEFAULT_SETTINGS = { learn: true, autoFill: 'ats', pausedSites: [] };

const $ = (id) => document.getElementById(id);
let memory = { entries: {} };
let settings = { ...DEFAULT_SETTINGS };
let tab = null;
let host = '';

async function init() {
    const got = await api.storage.local.get([MEM_KEY, SET_KEY]);
    memory = got[MEM_KEY]?.entries ? got[MEM_KEY] : { entries: {} };
    settings = { ...DEFAULT_SETTINGS, ...(got[SET_KEY] || {}) };
    try {
        [tab] = await api.tabs.query({ active: true, currentWindow: true });
        host = tab?.url ? new URL(tab.url).hostname : '';
    } catch (e) { host = ''; }

    $('learn').checked = settings.learn;
    $('autoFill').value = settings.autoFill;
    if (host) { $('host').textContent = host.replace(/^www\./, ''); $('pause').checked = settings.pausedSites.includes(host); }
    else $('pauseRow').hidden = true;

    render();
    countFillable();
}

const saveSettings = () => api.storage.local.set({ [SET_KEY]: settings });
const saveMemory = () => api.storage.local.set({ [MEM_KEY]: memory });
const display = (v) => (Array.isArray(v) ? v.join('; ') : String(v ?? ''));

function render() {
    const q = $('search').value.trim().toLowerCase();
    const all = Object.values(memory.entries).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    const n = all.length;
    $('stats').textContent = n ? `${n} ${n === 1 ? 'answer' : 'answers'} learned` : 'Ready to learn';
    const rows = q ? all.filter((e) => (e.label + ' ' + display(e.value)).toLowerCase().includes(q)) : all;
    const list = $('list');
    list.textContent = '';
    $('empty').hidden = n > 0;
    for (const e of rows) {
        const li = document.createElement('li');
        const head = document.createElement('div');
        head.className = 'q';
        const lab = document.createElement('span');
        lab.textContent = e.label;
        lab.title = e.label + (e.site ? ` — last used on ${e.site}` : '');
        const del = document.createElement('button');
        del.className = 'del';
        del.title = 'Forget this answer';
        del.textContent = '×';
        del.addEventListener('click', () => { delete memory.entries[e.key]; saveMemory(); render(); });
        head.append(lab, del);
        const val = document.createElement('textarea');
        val.className = 'v';
        val.rows = 1;
        val.value = display(e.value);
        val.addEventListener('change', () => {
            const t = val.value.trim();
            if (!t) { delete memory.entries[e.key]; }
            else {
                e.value = e.kind === 'multi' ? t.split(/\s*;\s*/).filter(Boolean) : t;
                e.updated = Date.now();
            }
            saveMemory();
            render();
        });
        li.append(head, val);
        list.append(li);
    }
}

async function countFillable() {
    if (!tab?.id) return;
    try {
        const r = await api.tabs.sendMessage(tab.id, { type: 'count' });
        if (r?.fillable) $('fill').textContent = `Fill ${r.fillable} ${r.fillable === 1 ? 'answer' : 'answers'} on this page`;
    } catch (e) { /* page not reachable */ }
}

$('fill').addEventListener('click', async () => {
    const out = $('result');
    out.hidden = false;
    if (!tab?.id) { out.textContent = 'No page open.'; return; }
    try {
        const r = await api.tabs.sendMessage(tab.id, { type: 'fill' });
        out.textContent = r?.filled
            ? `Filled ${r.filled} ${r.filled === 1 ? 'answer' : 'answers'}${r.review ? ` · ${r.review} highlighted to check` : ''}.`
            : 'Nothing new to fill — anything you type now will be remembered.';
    } catch (e) {
        out.textContent = 'Can’t reach this page. In Safari, click the Apply Helper icon and choose “Always Allow on This Website”, then reload.';
    }
});

$('learn').addEventListener('change', (e) => { settings.learn = e.target.checked; saveSettings(); });
$('autoFill').addEventListener('change', (e) => { settings.autoFill = e.target.value; saveSettings(); });
$('pause').addEventListener('change', (e) => {
    const set = new Set(settings.pausedSites);
    e.target.checked ? set.add(host) : set.delete(host);
    settings.pausedSites = [...set];
    saveSettings();
});
$('search').addEventListener('input', render);

$('export').addEventListener('click', async () => {
    const text = JSON.stringify({ app: 'Apply Helper', version: 2, exported: new Date().toISOString(), memory }, null, 1);
    try { await navigator.clipboard.writeText(text); $('export').textContent = 'Copied ✓'; }
    catch (e) { $('importBox').hidden = false; $('importText').value = text; $('importText').select(); $('export').textContent = 'Copy the text below'; }
    setTimeout(() => { $('export').textContent = 'Copy backup'; }, 2500);
});
$('import').addEventListener('click', () => { $('importBox').hidden = !$('importBox').hidden; $('importText').value = ''; $('importText').focus(); });
$('importGo').addEventListener('click', () => {
    try {
        const data = JSON.parse($('importText').value);
        const entries = data.memory?.entries || data.entries;
        if (!entries) throw new Error();
        memory.entries = { ...memory.entries, ...entries };
        saveMemory();
        $('importBox').hidden = true;
        render();
    } catch (e) { $('importText').value = ''; $('importText').placeholder = 'That doesn’t look like an Apply Helper backup.'; }
});
$('clear').addEventListener('click', () => {
    if (!confirm('Forget every saved answer? This can’t be undone.')) return;
    memory = { entries: {} };
    saveMemory();
    render();
});

$('settings').addEventListener('click', () => { api.runtime.openOptionsPage(); window.close(); });

init();
