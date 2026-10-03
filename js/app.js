// ============================================================
// CHOZ MAIN APP
// ============================================================

// Theme toggle
const themeBtn = document.getElementById('themeBtn');
function getTheme() {
  const stored = document.documentElement.getAttribute('data-theme');
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function updateThemeBtn() {
  themeBtn.textContent = getTheme() === 'dark' ? '☀️' : '🌙';
}
themeBtn.onclick = () => {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('choz-theme', next);
  updateThemeBtn();
};
const savedTheme = localStorage.getItem('choz-theme');
if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeBtn();

// Auth state
let currentUser = null;

async function checkAuth() {
  const { data: { session } } = await sb.auth.getSession();
  currentUser = session?.user || null;
  updateAuthUI();
}
function updateAuthUI() {
  const authBtn = document.getElementById('authBtn');
  const dashBtn = document.getElementById('dashBtn');
  if (currentUser) {
    authBtn.style.display = 'none';
    dashBtn.style.display = 'inline-block';
    dashBtn.onclick = () => window.location.href = '/dashboard.html';
  } else {
    authBtn.style.display = 'inline-block';
    dashBtn.style.display = 'none';
    authBtn.onclick = openAuth;
  }
}
sb.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user || null;
  updateAuthUI();
});

// Auth modal
let authMode = 'signin';
function openAuth() {
  document.getElementById('authModal').classList.remove('hidden');
}
function closeAuth() {
  document.getElementById('authModal').classList.add('hidden');
  document.getElementById('authError').textContent = '';
}
document.getElementById('closeAuth').onclick = closeAuth;
document.getElementById('authModal').addEventListener('click', (e) => {
  if (e.target.id === 'authModal') closeAuth();
});

document.getElementById('authSwitch').onclick = (e) => {
  e.preventDefault();
  authMode = authMode === 'signin' ? 'signup' : 'signin';
  document.getElementById('authTitle').textContent = authMode === 'signin' ? 'Sign in' : 'Sign up';
  document.getElementById('authSubmit').textContent = authMode === 'signin' ? 'Sign in' : 'Sign up';
  document.getElementById('authSwitchText').textContent = authMode === 'signin' ? 'No account?' : 'Already have account?';
  document.getElementById('authSwitch').textContent = authMode === 'signin' ? 'Sign up' : 'Sign in';
};

document.getElementById('authSubmit').onclick = async () => {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPass').value;
  const errEl = document.getElementById('authError');
  errEl.textContent = '';

  if (!email || !password) { errEl.textContent = 'Email and password required.'; return; }

  try {
    if (authMode === 'signin') {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      closeAuth();
    } else {
      const { error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      errEl.style.color = '#22c55e';
      errEl.textContent = 'Account created! Check your email to verify.';
    }
  } catch (err) {
    errEl.style.color = '#ef4444';
    errEl.textContent = err.message;
  }
};

document.getElementById('googleBtn').onclick = async () => {
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  if (error) document.getElementById('authError').textContent = error.message;
};

// Hero demo reveal
document.getElementById('revealBtn').onclick = function() {
  const card = document.getElementById('heroCard');
  const isRevealed = card.classList.toggle('rv');
  this.textContent = isRevealed ? 'Hide brands again' : 'Lock choice & reveal';
};

// Start comparison button
document.getElementById('startBtn').onclick = () => {
  document.getElementById('cats').scrollIntoView({ behavior: 'smooth' });
};

// PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
}

// Init
checkAuth();
loadCategories();
loadPulse();
// ============================================================
// CHOZ PULSE — Community aggregate trends
// ============================================================
async function loadPulse() {
    const grid = document.getElementById('pulseGrid');
    if (!grid) return;

    try {
        const { data: trends, error } = await sb
            .from('pulse_category_trends')
            .select('*')
            .order('total_comparisons', { ascending: false })
            .limit(8);

        if (error) {
            console.error('Pulse error:', error);
            grid.innerHTML = `
                <p style="color:var(--mute);text-align:center;grid-column:1/-1;padding:40px">
                    Community trends are being collected. Complete a comparison to be part of it.
                </p>
            `;
            return;
        }

        // Filter to categories with at least 1 comparison
        const activeTrends = (trends || []).filter(t => t.total_comparisons > 0);

        if (activeTrends.length === 0) {
            grid.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;padding:40px 20px">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--mute)" stroke-width="1.5" style="opacity:0.4;margin-bottom:12px">
                        <path d="M3 3v18h18"/>
                        <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
                    </svg>
                    <p style="color:var(--ink);font-weight:500;margin-bottom:6px">Community trends loading</p>
                    <p style="color:var(--mute);font-size:13px;max-width:400px;margin:0 auto">
                        Be among the first to compare. Trends will show once enough decisions have been made.
                    </p>
                </div>
            `;
            return;
        }

        grid.innerHTML = activeTrends.map(t => `
            <div style="background:var(--sf);border:1px solid var(--line);border-radius:14px;padding:20px">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
                    <span style="font-size:28px">${t.category_icon || '📦'}</span>
                    <div>
                        <div style="font-family:'Bricolage Grotesque';font-size:16px;font-weight:700">
                            ${escapeHtmlPulse(t.category_name)}
                        </div>
                        <div style="font-size:11px;color:var(--mute);margin-top:2px">
                            Last 30 days
                        </div>
                    </div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--mute);margin-bottom:6px">
                    <span>Comparisons</span>
                    <span style="color:var(--ink);font-weight:600">${t.total_comparisons}</span>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--mute)">
                    <span>Unique users</span>
                    <span style="color:var(--ink);font-weight:600">${t.unique_users || 0}</span>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error('Pulse load failed:', err);
        grid.innerHTML = `
            <p style="color:var(--mute);text-align:center;grid-column:1/-1;padding:40px">
                Community trends unavailable right now.
            </p>
        `;
    }
}

// Escape helper (agar pehle se nahi hai)
function escapeHtmlPulse(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}
