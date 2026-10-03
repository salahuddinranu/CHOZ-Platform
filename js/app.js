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
