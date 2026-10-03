// ============================================================
// CHOZ USER DASHBOARD
// ============================================================

let currentUser = null;
let currentTab = 'overview';

// Auth check
async function init() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = '/';
        return;
    }
    currentUser = session.user;
    renderUserHead();
    loadTab('overview');
}

function renderUserHead() {
    const email = currentUser.email || '';
    const initial = email.charAt(0).toUpperCase();
    document.getElementById('avatar').textContent = initial;
    document.getElementById('userName').textContent = email.split('@')[0];
    document.getElementById('userEmail').textContent = email;
}

// Tabs
document.querySelectorAll('.dash-nav button').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.dash-nav button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadTab(btn.dataset.tab);
    });
});

function loadTab(tab) {
    currentTab = tab;
    const content = document.getElementById('tabContent');
    content.innerHTML = '<div class="loading">Loading...</div>';

    if (tab === 'overview') loadOverview(content);
    else if (tab === 'history') loadHistory(content);
    else if (tab === 'memories') loadMemories(content);
    else if (tab === 'favorites') loadFavorites(content);
    else if (tab === 'settings') loadSettings(content);
}

// ============================================================
// OVERVIEW
// ============================================================
async function loadOverview(content) {
    const [comps, mems, favs] = await Promise.all([
        sb.from('comparisons').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id),
        sb.from('decision_memories').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id),
        sb.from('favorites').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id)
    ]);

    content.innerHTML = `
        <div class="stat-grid">
            <div class="stat"><h3>${comps.count || 0}</h3><p>Comparisons</p></div>
            <div class="stat"><h3>${mems.count || 0}</h3><p>Decision Memories</p></div>
            <div class="stat"><h3>${favs.count || 0}</h3><p>Favorites</p></div>
        </div>
        <div class="list-item" style="flex-direction:column;align-items:flex-start">
            <h4>Start a new comparison</h4>
            <p class="meta" style="margin-bottom:12px">Explore categories and make a blind decision.</p>
            <a class="btn p" href="/#cats">Browse categories →</a>
        </div>
    `;
}

// ============================================================
// HISTORY
// ============================================================
async function loadHistory(content) {
    const { data, error } = await sb
        .from('comparisons')
        .select('*, categories(name, icon)')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(30);

    if (error) { content.innerHTML = `<div class="empty"><h3>Error</h3><p>${error.message}</p></div>`; return; }
    if (!data || data.length === 0) {
        content.innerHTML = emptyState('No comparisons yet', 'Your comparison history will appear here.', '/#cats', 'Start comparing');
        return;
    }

    content.innerHTML = data.map(c => `
        <div class="list-item">
            <div>
                <h4>${c.categories?.icon || '📦'} ${c.categories?.name || 'Comparison'}</h4>
                <p class="meta">Status: ${c.status || 'active'}</p>
            </div>
            <span class="time">${formatDate(c.created_at)}</span>
        </div>
    `).join('');
}

// ============================================================
// DECISION MEMORY
// ============================================================
async function loadMemories(content) {
    const { data, error } = await sb
        .from('decision_memories')
        .select('*, categories(name, icon)')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) { content.innerHTML = `<div class="empty"><h3>Error</h3><p>${error.message}</p></div>`; return; }
    if (!data || data.length === 0) {
        content.innerHTML = emptyState('No memories yet', 'When you complete a comparison and save your decision, it will appear here.', '/#cats', 'Make a decision');
        return;
    }

    content.innerHTML = data.map(m => `
        <div class="list-item">
            <div>
                <h4>${m.categories?.icon || '📌'} ${m.title || 'Decision'}</h4>
                <p class="meta">${m.categories?.name || ''}${m.note ? ' — ' + m.note : ''}</p>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
                <span class="time">${formatDate(m.created_at)}</span>
                <button class="btn" style="padding:4px 12px;font-size:12px" onclick="deleteMemory('${m.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

async function deleteMemory(id) {
    if (!confirm('Delete this memory? This cannot be undone.')) return;
    const { error } = await sb.from('decision_memories').delete().eq('id', id).eq('user_id', currentUser.id);
    if (error) { alert(error.message); return; }
    loadTab('memories');
}

// ============================================================
// FAVORITES
// ============================================================
async function loadFavorites(content) {
    const { data, error } = await sb
        .from('favorites')
        .select('*, items(name, base_price, currency, brands(name))')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) { content.innerHTML = `<div class="empty"><h3>Error</h3><p>${error.message}</p></div>`; return; }
    if (!data || data.length === 0) {
        content.innerHTML = emptyState('No favorites yet', 'Save items you like and they will appear here.', '/#cats', 'Explore');
        return;
    }

    content.innerHTML = data.map(f => `
        <div class="list-item">
            <div>
                <h4>${f.items?.name || 'Item'}</h4>
                <p class="meta">${f.items?.brands?.name || ''} — ${f.items?.currency || ''} ${f.items?.base_price?.toLocaleString() || '—'}</p>
            </div>
            <button class="btn" style="padding:4px 12px;font-size:12px" onclick="removeFavorite('${f.id}')">Remove</button>
        </div>
    `).join('');
}

async function removeFavorite(id) {
    const { error } = await sb.from('favorites').delete().eq('id', id).eq('user_id', currentUser.id);
    if (error) { alert(error.message); return; }
    loadTab('favorites');
}

// ============================================================
// SETTINGS
// ============================================================
async function loadSettings(content) {
    content.innerHTML = `
        <div class="setting-row">
            <div>
                <h4>Email</h4>
                <p>${currentUser.email}</p>
            </div>
        </div>
        <div class="setting-row">
            <div>
                <h4>Change password</h4>
                <p>Send a password reset link to your email.</p>
            </div>
            <button class="btn" onclick="resetPassword()">Send reset link</button>
        </div>
        <div class="setting-row">
            <div>
                <h4 style="color:#ef4444">Delete account</h4>
                <p>Permanently delete your account and all associated data.</p>
            </div>
            <button class="btn danger" onclick="deleteAccount()">Delete account</button>
        </div>
    `;
}

async function resetPassword() {
    const { error } = await sb.auth.resetPasswordForEmail(currentUser.email, {
        redirectTo: window.location.origin + '/dashboard.html'
    });
    if (error) { alert(error.message); return; }
    alert('Password reset link sent to ' + currentUser.email);
}

async function deleteAccount() {
    const confirmText = prompt('Type DELETE to confirm account deletion:');
    if (confirmText !== 'DELETE') return;

    // Delete user data (RLS ensures only own data)
    await sb.from('decision_memories').delete().eq('user_id', currentUser.id);
    await sb.from('favorites').delete().eq('user_id', currentUser.id);
    await sb.from('comparisons').delete().eq('user_id', currentUser.id);

    const { error } = await sb.rpc('delete_user');
    if (error) {
        // Fallback: just sign out
        await sb.auth.signOut();
        window.location.href = '/';
        return;
    }

    await sb.auth.signOut();
    alert('Account deleted.');
    window.location.href = '/';
}

// ============================================================
// HELPERS
// ============================================================
function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString();
}

function emptyState(title, text, link, linkText) {
    return `
        <div class="empty">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4M12 16h.01"/>
            </svg>
            <h3>${title}</h3>
            <p style="margin-bottom:20px">${text}</p>
            <a class="btn p" href="${link}">${linkText} →</a>
        </div>
    `;
}

// Sign out
document.getElementById('signOutBtn').onclick = async () => {
    await sb.auth.signOut();
    window.location.href = '/';
};

// Theme toggle
const themeBtn = document.getElementById('themeBtn');
function getTheme() {
    const stored = document.documentElement.getAttribute('data-theme');
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function updateThemeBtn() { themeBtn.textContent = getTheme() === 'dark' ? '☀️' : '🌙'; }
themeBtn.onclick = () => {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('choz-theme', next);
    updateThemeBtn();
};
const savedTheme = localStorage.getItem('choz-theme');
if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeBtn();

// Init
init();
