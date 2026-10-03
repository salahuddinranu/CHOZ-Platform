// ============================================================
// CHOZ AUTHENTICATION MODULE
// ============================================================

let currentUser = null;
let authMode = 'signin';

// Check session on load
async function initAuth() {
    const { data: { session }, error } = await chozSupabase.auth.getSession();

    if (error) {
        console.error('Session error:', error);
        return;
    }

    if (session) {
        currentUser = session.user;
        updateAuthUI(true);
        await loadUserProfile();
    }

    chozSupabase.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;
        updateAuthUI(!!session);

        if (session) {
            loadUserProfile();
        }
    });
}

function updateAuthUI(isLoggedIn) {
    const authBtn = document.getElementById('auth-btn');
    const dashboard = document.getElementById('dashboard');

    if (!authBtn) return;

    if (isLoggedIn) {
        authBtn.textContent = 'Dashboard';
        authBtn.onclick = () => showDashboard();
    } else {
        authBtn.textContent = 'Sign In';
        authBtn.onclick = () => openAuthModal();

        if (dashboard) {
            dashboard.classList.add('hidden');
        }
    }
}

function openAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function toggleAuthMode() {
    authMode = authMode === 'signin' ? 'signup' : 'signin';

    document.getElementById('auth-title').textContent =
        authMode === 'signin' ? 'Sign In' : 'Sign Up';

    document.getElementById('auth-submit').textContent =
        authMode === 'signin' ? 'Sign In' : 'Sign Up';

    document.getElementById('auth-switch').innerHTML =
        authMode === 'signin'
            ? `Don't have an account? <a href="#" onclick="toggleAuthMode()">Sign Up</a>`
            : `Already have an account? <a href="#" onclick="toggleAuthMode()">Sign In</a>`;
}

// Form submit
const authForm = document.getElementById('auth-form');

if (authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const submitBtn = document.getElementById('auth-submit');

        submitBtn.disabled = true;
        submitBtn.textContent = 'Please wait...';

        try {
            if (authMode === 'signin') {

                const { error } =
                    await chozSupabase.auth.signInWithPassword({
                        email,
                        password
                    });

                if (error) throw error;

                showToast('Welcome back!', 'success');

            } else {

                const { error } =
                    await chozSupabase.auth.signUp({
                        email,
                        password
                    });

                if (error) throw error;

                showToast(
                    'Check your email to verify your account.',
                    'info'
                );
            }

            closeAuthModal();

        } catch (err) {
            console.error('Authentication error:', err);
            showToast(err.message, 'error');

        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent =
                authMode === 'signin' ? 'Sign In' : 'Sign Up';
        }
    });
}

// Google Sign-In
async function signInWithGoogle() {
    const { error } =
        await chozSupabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });

    if (error) {
        console.error('Google sign-in error:', error);
        showToast(error.message, 'error');
    }
}

// Sign Out
async function signOut() {
    const { error } = await chozSupabase.auth.signOut();

    if (error) {
        showToast(error.message, 'error');
        return;
    }

    currentUser = null;
    updateAuthUI(false);

    showToast('Signed out.', 'info');

    window.location.href = '/';
}

// Load user profile
async function loadUserProfile() {
    if (!currentUser) return;

    const { data, error } = await chozSupabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (error) {
        console.error('Profile error:', error);
        return;
    }

    window.userProfile = data;
}

// Toast helper
function showToast(message, type = 'info') {
    const toast = document.createElement('div');

    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toast.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        background: ${
            type === 'success'
                ? '#22c55e'
                : type === 'error'
                    ? '#ef4444'
                    : '#6366f1'
        };
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        font-size: 0.9rem;
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
}

// Init
initAuth();
