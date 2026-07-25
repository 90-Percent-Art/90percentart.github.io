// See web-chat/README.md in the 90percentart-ai-orchestrator repo for the full
// Worker setup this page depends on.
const API_BASE = 'https://chat-api.90percent.art';

const loginPanel = document.getElementById('login-panel');
const mainPanel = document.getElementById('main-panel');
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginStatus = document.getElementById('login-status');
const chatLog = document.getElementById('chat-log');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatModel = document.getElementById('chat-model');
const chatSend = document.getElementById('chat-send');
const loggedInAs = document.getElementById('logged-in-as');
const logoutBtn = document.getElementById('logout-btn');
const offlineCard = document.getElementById('offline-card');
const backlogBody = document.getElementById('backlog-body');
const tasksBody = document.getElementById('tasks-body');
const runNowBtn = document.getElementById('run-now-btn');
const runNowStatus = document.getElementById('run-now-status');
const feedbackForm = document.getElementById('feedback-form');
const noteFlash = document.getElementById('note-flash');
const notesOpen = document.getElementById('notes-open');
const notesReviewed = document.getElementById('notes-reviewed');
const notesHandled = document.getElementById('notes-handled');

let runStatusTimer = null;

function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function showLogin() {
    loginPanel.classList.add('show');
    mainPanel.classList.remove('show');
}

function showMain(email) {
    loginPanel.classList.remove('show');
    mainPanel.classList.add('show');
    loggedInAs.textContent = email;
}

function appendMsg(role, text, modelLabel) {
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.textContent = text;
    if (modelLabel) {
        const tag = document.createElement('span');
        tag.style.cssText = 'display:block;font-size:10.5px;opacity:.65;margin-top:3px;';
        tag.textContent = modelLabel;
        div.appendChild(tag);
    }
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
    return div;
}

async function api(path, opts = {}) {
    const resp = await fetch(`${API_BASE}${path}`, {
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        ...opts,
    });
    let data = null;
    try { data = await resp.json(); } catch { /* no body */ }
    if (!resp.ok) throw new Error((data && data.error) || `request failed (${resp.status})`);
    return data;
}

async function loadHistory() {
    try {
        const { history, models, selectedModel, reachable } = await api('/api/history');
        chatLog.innerHTML = '';
        (history || []).forEach((m) => appendMsg(m.role, m.text));
        if (models && models.length) {
            chatModel.innerHTML = models.map((m) => `<option value="${esc(m.id)}">${esc(m.label)}</option>`).join('');
            if (selectedModel) chatModel.value = selectedModel;
        }
        if (reachable === false) appendMsg('error', 'No relay machine is reachable right now -- is it powered on and connected?');
    } catch (e) {
        appendMsg('error', `Couldn't load history: ${e.message}`);
    }
}

function fmtTokens(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
}
function fmtPct(n) { return Math.round(n * 100) + '%'; }

function renderStats(snapshot) {
    const b = snapshot.budget || {};
    const modeCls = { conservative: 'crit', normal: 'info', expanded: 'good', unknown: 'warn' }[b.mode] || 'warn';
    document.getElementById('stat-budget').innerHTML = b.mode && b.mode !== 'unknown'
        ? `<span class="pill ${modeCls}">${esc(b.mode)}</span>`
        : '<span class="pill warn">unknown</span>';
    document.getElementById('stat-budget-meta').textContent = b.mode && b.mode !== 'unknown'
        ? `${fmtPct(b.usedFraction)} of ${fmtTokens(b.weeklyBudgetTokens)} · ${fmtPct(b.elapsedFraction)} of week elapsed`
        : 'ccusage unavailable';

    const sync = snapshot.sync || {};
    const syncEl = document.getElementById('stat-sync');
    const syncMeta = document.getElementById('stat-sync-meta');
    if (!sync.reachable) {
        syncEl.textContent = 'Pi unreachable';
        syncMeta.textContent = sync.error || '';
    } else if (sync.healthy === null || sync.healthy === undefined) {
        syncEl.textContent = 'No data yet';
        syncMeta.textContent = '';
    } else if (sync.healthy) {
        syncEl.innerHTML = `<span class="pill good">healthy</span>`;
        syncMeta.textContent = `${sync.ageMin}m ago · ${sync.piCommit}`;
    } else {
        syncEl.innerHTML = `<span class="pill crit">stale</span>`;
        syncMeta.textContent = `${sync.ageMin >= 60 ? (sync.ageMin / 60).toFixed(1) + 'h' : sync.ageMin + 'm'} ago`;
    }

    const state = snapshot.state || {};
    document.getElementById('stat-updated').textContent = state.updatedAt ? new Date(state.updatedAt).toLocaleTimeString() : '--';
    document.getElementById('stat-updated-meta').textContent = state.updatedAt ? new Date(state.updatedAt).toLocaleDateString() : 'no snapshot yet';
}

function commentBlockHtml(id, comments) {
    const list = comments && comments.length
        ? `<ul class="comment-list">${comments.map((c) => `<li class="${c.mandate ? 'mandate' : ''}">${c.mandate ? '&#9889; ' : ''}<span style="font-family:monospace;font-size:10px;opacity:.7;margin-right:6px;">${esc(c.ts)}</span>${esc(c.text)}</li>`).join('')}</ul>`
        : '';
    return `
        <div class="comment-block" data-id="${esc(id)}">
            ${list}
            <button type="button" class="comment-toggle" data-target="cf-${esc(id)}">${comments && comments.length ? 'reply' : 'comment'}</button>
            <form class="comment-form" id="cf-${esc(id)}" data-id="${esc(id)}">
                <input type="text" placeholder="Comment on this item…" required />
                <label><input type="checkbox" class="mandate-check" /> &#9889; now</label>
                <button type="submit" class="btn btn-sm btn-primary">Add</button>
            </form>
        </div>`;
}

function rateRowHtml(id, evanRating) {
    const dots = [1, 2, 3, 4, 5].map((n) =>
        `<button type="button" class="rate-btn ${n <= (evanRating || 0) ? 'filled' : ''}" data-id="${esc(id)}" data-score="${n}" title="Rate ${n}/5">&#9679;</button>`
    ).join('');
    return `<div class="rate-row"><span class="rate-label">you</span>${dots}${evanRating ? `<button type="button" class="clear-btn" data-id="${esc(id)}" data-score="0">clear</button>` : ''}</div>`;
}

function renderBacklog(sections) {
    if (!sections || !sections.length) {
        backlogBody.innerHTML = '<div class="orc-empty">Nothing here yet.</div>';
        return;
    }
    backlogBody.innerHTML = sections.map((sec) => `
        <details class="orc-section" open>
            <summary>${esc(sec.section)}</summary>
            ${sec.items.length
                ? `<ul class="orc-items">${sec.items.map((it) => `
                    <li>
                        <span class="tag ${esc(it.tag)}">${esc(it.tag)}</span>
                        ${esc(it.text)}
                        ${rateRowHtml(it.id, it.evanRating)}
                        ${commentBlockHtml(it.id, it.comments)}
                    </li>`).join('')}</ul>`
                : '<div class="orc-empty">Nothing here yet.</div>'}
        </details>`).join('');
}

function renderTasks(scheduledTasks) {
    if (!scheduledTasks || !scheduledTasks.length) {
        tasksBody.innerHTML = '<div class="orc-empty">No task snapshot yet.</div>';
        return;
    }
    tasksBody.innerHTML = scheduledTasks.map((t) => `
        <div class="task-row">
            <div><div>${esc(t.name)}</div><div class="sched">${esc(t.schedule)}</div></div>
            <span class="pill ${t.enabled ? 'good' : 'crit'}">${t.enabled ? 'active' : 'paused'}</span>
        </div>`).join('');
}

function renderNoteList(el, notes) {
    if (!notes || !notes.length) {
        el.innerHTML = '<div class="orc-empty">Nothing here.</div>';
        return;
    }
    el.innerHTML = notes.slice().reverse().map((n) => `<div class="orc-note">${esc(n)}</div>`).join('');
}

async function loadSnapshot() {
    try {
        const { snapshot, reachable } = await api('/api/orchestrator');
        if (!reachable || !snapshot) {
            offlineCard.classList.add('show');
            backlogBody.innerHTML = '';
            tasksBody.innerHTML = '';
            notesOpen.innerHTML = notesReviewed.innerHTML = notesHandled.innerHTML = '';
            return;
        }
        offlineCard.classList.remove('show');
        renderStats(snapshot);
        renderBacklog(snapshot.backlog);
        renderTasks(snapshot.state && snapshot.state.scheduledTasks);
        const notes = snapshot.notes || {};
        renderNoteList(notesOpen, notes.open);
        renderNoteList(notesReviewed, notes.reviewed);
        renderNoteList(notesHandled, notes.handled);
    } catch (e) {
        offlineCard.classList.add('show');
    }
}

async function pollRunStatus() {
    try {
        const { running } = await api('/api/run-status');
        if (running) {
            runNowBtn.disabled = true;
            runNowStatus.textContent = 'Running…';
            runStatusTimer = setTimeout(pollRunStatus, 3000);
        } else {
            runNowBtn.disabled = false;
            if (runNowStatus.textContent === 'Running…') {
                runNowStatus.textContent = 'Done.';
                loadSnapshot();
                setTimeout(() => { runNowStatus.textContent = ''; }, 4000);
            }
        }
    } catch {
        runNowBtn.disabled = false;
    }
}

async function init() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
        try {
            const { email } = await api('/api/verify', { method: 'POST', body: JSON.stringify({ token }) });
            window.history.replaceState({}, '', 'orchestrator.html'); // scrub the one-time token from the URL/history
            showMain(email);
            await Promise.all([loadHistory(), loadSnapshot()]);
            pollRunStatus();
            return;
        } catch (e) {
            loginStatus.textContent = `Sign-in link problem: ${e.message}`;
        }
    }

    try {
        const { email } = await api('/api/me');
        if (email) {
            showMain(email);
            await Promise.all([loadHistory(), loadSnapshot()]);
            pollRunStatus();
            return;
        }
    } catch { /* fall through to login */ }

    showLogin();
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginEmail.value.trim();
    if (!email) return;
    const btn = loginForm.querySelector('button');
    btn.disabled = true;
    loginStatus.textContent = 'Sending...';
    try {
        await api('/api/login', { method: 'POST', body: JSON.stringify({ email }) });
        loginStatus.textContent = "If that email is on the allowlist, a sign-in link is on its way -- check your inbox.";
    } catch (e2) {
        loginStatus.textContent = `Error: ${e2.message}`;
    } finally {
        btn.disabled = false;
    }
});

logoutBtn.addEventListener('click', async () => {
    try { await api('/api/logout', { method: 'POST' }); } catch { /* best effort */ }
    if (runStatusTimer) clearTimeout(runStatusTimer);
    showLogin();
});

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = chatInput.value.trim();
    if (!message) return;
    const modelId = chatModel.value;
    const modelLabel = chatModel.options[chatModel.selectedIndex] ? chatModel.options[chatModel.selectedIndex].textContent : '';
    appendMsg('user', message);
    chatInput.value = '';
    chatSend.disabled = true;
    const working = appendMsg('working', 'Thinking...');
    try {
        const { reply } = await api('/api/chat', { method: 'POST', body: JSON.stringify({ message, model: modelId }) });
        working.remove();
        appendMsg('assistant', reply, modelLabel);
        loadSnapshot(); // a chat turn may have changed backlog/notes -- refresh the read-only view
    } catch (e2) {
        working.remove();
        appendMsg('error', e2.message);
    } finally {
        chatSend.disabled = false;
        chatInput.focus();
    }
});

runNowBtn.addEventListener('click', async () => {
    runNowBtn.disabled = true;
    runNowStatus.textContent = 'Starting…';
    try {
        const result = await api('/api/run-now', { method: 'POST' });
        if (!result.started) {
            runNowStatus.textContent = result.reason || 'Could not start.';
            runNowBtn.disabled = false;
            return;
        }
        runNowStatus.textContent = 'Running…';
        pollRunStatus();
    } catch (e) {
        runNowStatus.textContent = e.message;
        runNowBtn.disabled = false;
    }
});

feedbackForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const textarea = feedbackForm.querySelector('textarea');
    const note = textarea.value.trim();
    if (!note) return;
    const mandate = feedbackForm.querySelector('input[name="mandate"]').checked;
    const btn = feedbackForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
        await api('/api/notes', { method: 'POST', body: JSON.stringify({ note, mandate }) });
        textarea.value = '';
        feedbackForm.querySelector('input[name="mandate"]').checked = false;
        noteFlash.classList.add('show');
        setTimeout(() => noteFlash.classList.remove('show'), 2000);
        loadSnapshot();
    } catch (e2) {
        alert(`Couldn't add note: ${e2.message}`);
    } finally {
        btn.disabled = false;
    }
});

// Delegated handlers for dynamically-rendered backlog items (ratings + comments).
backlogBody.addEventListener('click', async (e) => {
    const rateBtn = e.target.closest('.rate-btn, .clear-btn');
    if (rateBtn) {
        const id = rateBtn.dataset.id;
        const score = parseInt(rateBtn.dataset.score, 10) || 0;
        try {
            await api('/api/rate', { method: 'POST', body: JSON.stringify({ id, score }) });
            loadSnapshot();
        } catch (err) {
            alert(`Couldn't save rating: ${err.message}`);
        }
        return;
    }
    const toggle = e.target.closest('.comment-toggle');
    if (toggle) {
        const target = document.getElementById(toggle.dataset.target);
        if (!target) return;
        target.classList.toggle('open');
        if (target.classList.contains('open')) {
            const input = target.querySelector('input[type="text"]');
            if (input) input.focus();
        }
    }
});

backlogBody.addEventListener('submit', async (e) => {
    if (!e.target.matches('.comment-form')) return;
    e.preventDefault();
    const form = e.target;
    const input = form.querySelector('input[type="text"]');
    const text = input.value.trim();
    if (!text) return;
    const id = form.dataset.id;
    const mandate = form.querySelector('.mandate-check').checked;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
        await api('/api/comment', { method: 'POST', body: JSON.stringify({ id, text, mandate }) });
        loadSnapshot();
    } catch (err) {
        alert(`Couldn't add comment: ${err.message}`);
        btn.disabled = false;
    }
});

init();
