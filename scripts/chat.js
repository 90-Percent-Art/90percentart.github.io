// Update this once the Cloudflare Worker is deployed (see web-chat/README.md in the
// 90percentart-ai-orchestrator repo for the full setup). Everything below assumes the
// Worker is reachable at this base URL and CORS/cookie config there points back at
// this site's origin.
const API_BASE = 'https://chat-api.90percent.art';

const loginPanel = document.getElementById('login-panel');
const chatPanel = document.getElementById('chat-panel');
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginStatus = document.getElementById('login-status');
const chatLog = document.getElementById('chat-log');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
const loggedInAs = document.getElementById('logged-in-as');
const logoutBtn = document.getElementById('logout-btn');

function showLogin() {
    loginPanel.classList.add('show');
    chatPanel.classList.remove('show');
}

function showChat(email) {
    loginPanel.classList.remove('show');
    chatPanel.classList.add('show');
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
        const { history } = await api('/api/history');
        chatLog.innerHTML = '';
        (history || []).forEach((m) => appendMsg(m.role, m.content));
    } catch (e) {
        appendMsg('error', `Couldn't load history: ${e.message}`);
    }
}

async function init() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
        try {
            const { email } = await api('/api/verify', { method: 'POST', body: JSON.stringify({ token }) });
            window.history.replaceState({}, '', 'chat.html'); // scrub the one-time token from the URL/history
            showChat(email);
            await loadHistory();
            return;
        } catch (e) {
            loginStatus.textContent = `Sign-in link problem: ${e.message}`;
        }
    }

    try {
        const { email } = await api('/api/me');
        if (email) {
            showChat(email);
            await loadHistory();
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
    } catch (e2) {
        working.remove();
        appendMsg('error', e2.message);
    } finally {
        chatSend.disabled = false;
        chatInput.focus();
    }
});

init();
