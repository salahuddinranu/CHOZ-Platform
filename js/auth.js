// ============================================================
// CHOZ AUTHENTICATION MODULE
// ============================================================

let currentUser = null;
let authMode = 'signin';

// Check session on load
async function initAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        updateAuthUI(true);
        await loadUserProfile();
    }
    supabase.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;
        updateAuthUI(!!session);
        if (session) loadUserProfile();
    });
}

function updateAuthUI(isLoggedIn) {
    const authBtn = document.getElementById('auth-btn');
    const dashboard = document.getElementById('dashboard');
    if (isLoggedIn) {
        authBtn.textContent = 'Dashboard';
        authBtn.onclick = () => showDashboard();
    } else {
        authBtn.textContent = 'Sign In';
        authBtn.onclick = () => openAuthModal();
        if (dashboard) dashboard.classList.add('hidden');
    }
}

function openAuthModal() {
    document.getElementById('auth-modal').classList.remove('hidden');
}

function closeAuthModal() {
    document.getElementById('auth-modal').classList.add('hidden');
}

function toggleAuthMode() {
    authMode = authMode === 'signin' ? 'signup' : 'signin';
    document.getElementById('auth-title').textContent = authMode === 'signin' ? 'Sign In' : 'Sign Up';
    document.getElementById('auth-submit').textContent = authMode === 'signin' ? 'Sign In' : 'Sign Up';
    document.getElementById('auth-switch').innerHTML = authMode === 'signin'
        ? `Don't have an account? <a href="#" onclick="toggleAuthMode()">Sign Up</a>`
        : `Already have an account? <a href="#" onclick="toggleAuthMode()">Sign In</a>`;
}

// Form submit
document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const submitBtn = document.getElementById('auth-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Please wait...';

    try {
        if (authMode === 'signin') {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            showToast('Welcome back!', 'success');
        } else {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;
            showToast('Check your email to verify your account.', 'info');
        }
        closeAuthModal();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = authMode === 'signin' ? 'Sign In' : 'Sign Up';
    }
});

// Google Sign-In
async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/dashboard' }
    });
    if (error) showToast(error.message, 'error');
}

// Sign Out
async function signOut() {
    await supabase.auth.signOut();
    currentUser = null;
    updateAuthUI(false);
    showToast('Signed out.', 'info');
    window.location.href = '/';
}

// Load user profile
async function loadUserProfile() {
    if (!currentUser) return;
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
    if (error) return;
    window.userProfile = data;
}

// Toast helper
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed; bottom: 2rem; right: 2rem;
        background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#6366f1'};
        color: white; padding: 1rem 1.5rem; border-radius: 12px;
        font-size: 0.9rem; z-index: 9999; animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Init
initAuth();
