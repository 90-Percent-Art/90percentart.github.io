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
const chatSend = document.getElementById('chat-send');
const loggedInAs = document.getElementById('logged-in-as');
const logoutBtn = document.getElementById('logout-btn');
const offlineCard = document.getElementById('offline-card');
const statusLine = document.getElementById('status-line');
const backlogBody = document.getElementById('backlog-body');
const notesOpen = document.getElementById('notes-open');
const notesReviewed = document.getElementById('notes-reviewed');
const notesHandled = document.getElementById('notes-handled');

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

function appendMsg(role, text) {
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.textContent = text;
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
        const { history, reachable } = await api('/api/history');
        chatLog.innerHTML = '';
        (history || []).forEach((m) => appendMsg(m.role, m.text));
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

function renderStatus(snapshot) {
    const b = snapshot.budget || {};
    const parts = [];
    if (b.mode && b.mode !== 'unknown') {
        parts.push(`Budget: <b>${esc(b.mode)}</b> (${fmtPct(b.usedFraction)} of ${fmtTokens(b.weeklyBudgetTokens)} used, ${fmtPct(b.elapsedFraction)} of week elapsed)`);
    }
    if (snapshot.state && snapshot.state.updatedAt) {
        parts.push(`State last updated: <b>${new Date(snapshot.state.updatedAt).toLocaleString()}</b>`);
    }
    statusLine.innerHTML = parts.length ? parts.map((p) => `<span>${p}</span>`).join('') : 'No status data available.';
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
                        ${it.evanRating ? `<span class="rating">you: ${it.evanRating}/5</span>` : ''}
                    </li>`).join('')}</ul>`
                : '<div class="orc-empty">Nothing here yet.</div>'}
        </details>`).join('');
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
            statusLine.textContent = 'Unavailable -- relay offline.';
            backlogBody.innerHTML = '';
            notesOpen.innerHTML = notesReviewed.innerHTML = notesHandled.innerHTML = '';
            return;
        }
        offlineCard.classList.remove('show');
        renderStatus(snapshot);
        renderBacklog(snapshot.backlog);
        const notes = snapshot.notes || {};
        renderNoteList(notesOpen, notes.open);
        renderNoteList(notesReviewed, notes.reviewed);
        renderNoteList(notesHandled, notes.handled);
    } catch (e) {
        offlineCard.classList.add('show');
        statusLine.textContent = `Couldn't load status: ${e.message}`;
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
    showLogin();
});

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = chatInput.value.trim();
    if (!message) return;
    appendMsg('user', message);
    chatInput.value = '';
    chatSend.disabled = true;
    const working = appendMsg('working', 'Thinking...');
    try {
        const { reply } = await api('/api/chat', { method: 'POST', body: JSON.stringify({ message }) });
        working.remove();
        appendMsg('assistant', reply);
        loadSnapshot(); // a chat turn may have changed backlog/notes -- refresh the read-only view
    } catch (e2) {
        working.remove();
        appendMsg('error', e2.message);
    } finally {
        chatSend.disabled = false;
        chatInput.focus();
    }
});

init();
