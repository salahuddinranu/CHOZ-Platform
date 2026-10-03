// ============================================================
// CHOZ AUTHENTICATION MODULE
// ============================================================

let currentUser = null;
let authMode = 'signin';
let authFormInitialized = false;


// ============================================================
// CHECK SESSION
// ============================================================

async function initAuth() {
    try {
        const {
            data: { session },
            error
        } = await chozSupabase.auth.getSession();

        if (error) {
            console.error('Session error:', error);
            return;
        }

        if (session) {
            currentUser = session.user;
            updateAuthUI(true);
            await loadUserProfile();
        } else {
            updateAuthUI(false);
        }

        chozSupabase.auth.onAuthStateChange((event, session) => {
            currentUser = session?.user || null;

            updateAuthUI(!!session);

            if (session) {
                loadUserProfile();
            }

            if (event === 'PASSWORD_RECOVERY') {
                openPasswordReset();
            }
        });

        setupAuthForm();

        checkRecoveryMode();

    } catch (error) {
        console.error('Auth initialization error:', error);
    }
}


// ============================================================
// AUTH UI
// ============================================================

function updateAuthUI(isLoggedIn) {
    const authBtn = document.getElementById('auth-btn');
    const dashboard = document.getElementById('dashboard');

    if (!authBtn) return;

    if (isLoggedIn) {

        authBtn.textContent = 'Dashboard';

        authBtn.onclick = () => {
            if (typeof showDashboard === 'function') {
                showDashboard();
            }
        };

    } else {

        authBtn.textContent = 'Sign In';
        authBtn.onclick = () => openAuthModal();

        if (dashboard) {
            dashboard.classList.add('hidden');
        }
    }
}


// ============================================================
// OPEN / CLOSE AUTH MODAL
// ============================================================

function openAuthModal() {
    const modal = document.getElementById('auth-modal');

    if (!modal) return;

    modal.classList.remove('hidden');

    setAuthMode('signin');
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');

    if (modal) {
        modal.classList.add('hidden');
    }
}


// ============================================================
// AUTH MODE
// ============================================================

function setAuthMode(mode) {
    authMode = mode;

    const title = document.getElementById('auth-title');
    const submit = document.getElementById('auth-submit');
    const switchText = document.getElementById('auth-switch');

    if (title) {
        title.textContent =
            mode === 'signin'
                ? 'Welcome Back'
                : 'Create Your CHOZ Account';
    }

    if (submit) {
        submit.textContent =
            mode === 'signin'
                ? 'Sign In'
                : 'Create Account';
    }

    addSignupFields();
    addForgotPasswordLink();

    if (switchText) {

        switchText.innerHTML =
            mode === 'signin'
                ? `Don't have an account?
                   <a href="#" onclick="toggleAuthMode(); return false;">
                       Create Account
                   </a>`
                : `Already have an account?
                   <a href="#" onclick="toggleAuthMode(); return false;">
                       Sign In
                   </a>`;
    }

    updateSignupFieldsVisibility();
}


function toggleAuthMode() {
    setAuthMode(
        authMode === 'signin'
            ? 'signup'
            : 'signin'
    );
}


// ============================================================
// ADD PROFESSIONAL SIGNUP FIELDS
// ============================================================

function addSignupFields() {
    const form = document.getElementById('auth-form');

    if (!form) return;

    if (!document.getElementById('auth-full-name')) {

        const nameGroup = document.createElement('div');

        nameGroup.id = 'auth-name-group';

        nameGroup.innerHTML = `
            <input
                type="text"
                id="auth-full-name"
                placeholder="Full Name"
                autocomplete="name"
            >
        `;

        form.insertBefore(
            nameGroup,
            document.getElementById('auth-email')
        );
    }

    if (!document.getElementById('auth-username')) {

        const usernameGroup = document.createElement('div');

        usernameGroup.id = 'auth-username-group';

        usernameGroup.innerHTML = `
            <input
                type="text"
                id="auth-username"
                placeholder="Username"
                autocomplete="username"
            >
        `;

        form.insertBefore(
            usernameGroup,
            document.getElementById('auth-email')
        );
    }

    if (!document.getElementById('auth-confirm-password')) {

        const passwordInput =
            document.getElementById('auth-password');

        if (!passwordInput) return;

        const confirmGroup = document.createElement('div');

        confirmGroup.id = 'auth-confirm-password-group';

        confirmGroup.innerHTML = `
            <input
                type="password"
                id="auth-confirm-password"
                placeholder="Confirm Password"
                autocomplete="new-password"
            >
        `;

        passwordInput.insertAdjacentElement(
            'afterend',
            confirmGroup
        );
    }
}


function updateSignupFieldsVisibility() {

    const nameGroup =
        document.getElementById('auth-name-group');

    const usernameGroup =
        document.getElementById('auth-username-group');

    const confirmGroup =
        document.getElementById(
            'auth-confirm-password-group'
        );

    const forgotLink =
        document.getElementById('forgot-password-link');

    const isSignup = authMode === 'signup';

    if (nameGroup) {
        nameGroup.style.display =
            isSignup ? 'block' : 'none';
    }

    if (usernameGroup) {
        usernameGroup.style.display =
            isSignup ? 'block' : 'none';
    }

    if (confirmGroup) {
        confirmGroup.style.display =
            isSignup ? 'block' : 'none';
    }

    if (forgotLink) {
        forgotLink.style.display =
            isSignup ? 'none' : 'block';
    }
}


// ============================================================
// FORGOT PASSWORD LINK
// ============================================================

function addForgotPasswordLink() {

    const form = document.getElementById('auth-form');

    if (!form) return;

    if (document.getElementById('forgot-password-link')) {
        updateSignupFieldsVisibility();
        return;
    }

    const link = document.createElement('a');

    link.id = 'forgot-password-link';

    link.href = '#';
    link.textContent = 'Forgot Password?';

    link.style.cssText = `
        display: block;
        margin: 0.75rem 0;
        text-align: right;
        font-size: 0.9rem;
        cursor: pointer;
        text-decoration: none;
    `;

    link.onclick = (e) => {
        e.preventDefault();
        openForgotPassword();
    };

    const submitButton =
        document.getElementById('auth-submit');

    if (submitButton) {
        submitButton.insertAdjacentElement(
            'afterend',
            link
        );
    }

    updateSignupFieldsVisibility();
}


// ============================================================
// AUTH FORM
// ============================================================

function setupAuthForm() {

    if (authFormInitialized) return;

    const authForm =
        document.getElementById('auth-form');

    if (!authForm) return;

    authFormInitialized = true;

    addSignupFields();
    addForgotPasswordLink();

    authForm.addEventListener(
        'submit',
        handleAuthSubmit
    );

    updateSignupFieldsVisibility();
}


async function handleAuthSubmit(e) {

    e.preventDefault();

    const email =
        document.getElementById('auth-email')?.value
            .trim();

    const password =
        document.getElementById('auth-password')?.value;

    const submitBtn =
        document.getElementById('auth-submit');

    if (!email || !password) {
        showToast(
            'Please enter your email and password.',
            'error'
        );
        return;
    }

    if (authMode === 'signup') {

        const fullName =
            document.getElementById('auth-full-name')
                ?.value.trim();

        const username =
            document.getElementById('auth-username')
                ?.value.trim();

        const confirmPassword =
            document.getElementById(
                'auth-confirm-password'
            )?.value;

        if (!fullName) {
            showToast(
                'Please enter your full name.',
                'error'
            );
            return;
        }

        if (!username) {
            showToast(
                'Please choose a username.',
                'error'
            );
            return;
        }

        if (password.length < 6) {
            showToast(
                'Password must be at least 6 characters.',
                'error'
            );
            return;
        }

        if (password !== confirmPassword) {
            showToast(
                'Passwords do not match.',
                'error'
            );
            return;
        }
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Please wait...';
    }

    try {

        // ====================================================
        // SIGN IN
        // ====================================================

        if (authMode === 'signin') {

            const { error } =
                await chozSupabase.auth
                    .signInWithPassword({
                        email,
                        password
                    });

            if (error) {
                throw error;
            }

            showToast(
                'Welcome back!',
                'success'
            );

            closeAuthModal();

        }

        // ====================================================
        // SIGN UP
        // ====================================================

        else {

            const fullName =
                document.getElementById(
                    'auth-full-name'
                ).value.trim();

            const username =
                document.getElementById(
                    'auth-username'
                ).value.trim();

            const { data, error } =
                await chozSupabase.auth.signUp({

                    email,

                    password,

                    options: {
                        data: {
                            full_name: fullName,
                            username: username
                        }
                    }
                });

            if (error) {
                throw error;
            }

            if (data.session) {

                currentUser =
                    data.session.user;

                updateAuthUI(true);

                await loadUserProfile();

                showToast(
                    'Account created successfully!',
                    'success'
                );

            } else {

                showToast(
                    'Account created. Please check your email and confirm your account before signing in.',
                    'info'
                );
            }

            closeAuthModal();
        }

    } catch (err) {

        console.error(
            'Authentication error:',
            err
        );

        showToast(
            err.message ||
            'Authentication failed.',
            'error'
        );

    } finally {

        if (submitBtn) {

            submitBtn.disabled = false;

            submitBtn.textContent =
                authMode === 'signin'
                    ? 'Sign In'
                    : 'Create Account';
        }
    }
}


// ============================================================
// GOOGLE SIGN-IN / SIGN-UP
// ============================================================

async function signInWithGoogle() {

    try {

        const { error } =
            await chozSupabase.auth
                .signInWithOAuth({

                    provider: 'google',

                    options: {
                        redirectTo:
                            window.location.origin
                    }
                });

        if (error) {
            throw error;
        }

    } catch (error) {

        console.error(
            'Google sign-in error:',
            error
        );

        showToast(
            error.message ||
            'Google sign-in failed.',
            'error'
        );
    }
}


// ============================================================
// FORGOT PASSWORD
// ============================================================

function openForgotPassword() {

    const email =
        document.getElementById('auth-email')?.value
            .trim();

    if (!email) {

        showToast(
            'Enter your email first, then click Forgot Password.',
            'info'
        );

        return;
    }

    sendPasswordReset(email);
}


async function sendPasswordReset(email) {

    try {

        const { error } =
            await chozSupabase.auth
                .resetPasswordForEmail(
                    email,
                    {
                        redirectTo:
                            window.location.origin
                    }
                );

        if (error) {
            throw error;
        }

        showToast(
            'Password reset email sent. Check your inbox.',
            'success'
        );

    } catch (error) {

        console.error(
            'Password reset error:',
            error
        );

        showToast(
            error.message ||
            'Could not send password reset email.',
            'error'
        );
    }
}


// ============================================================
// PASSWORD RECOVERY
// ============================================================

function checkRecoveryMode() {

    const hash =
        window.location.hash;

    const search =
        window.location.search;

    if (
        hash.includes('type=recovery') ||
        search.includes('type=recovery')
    ) {
        setTimeout(() => {
            openPasswordReset();
        }, 300);
    }
}


function openPasswordReset() {

    let modal =
        document.getElementById(
            'password-reset-modal'
        );

    if (!modal) {

        modal =
            document.createElement('div');

        modal.id =
            'password-reset-modal';

        modal.style.cssText = `
            position: fixed;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0,0,0,0.65);
            z-index: 10000;
            padding: 1rem;
        `;

        modal.innerHTML = `
            <div
                style="
                    width:100%;
                    max-width:420px;
                    background:white;
                    padding:2rem;
                    border-radius:16px;
                    box-shadow:0 20px 50px rgba(0,0,0,.25);
                "
            >

                <h2 style="margin-bottom:.5rem;">
                    Set New Password
                </h2>

                <p style="
                    margin-bottom:1.5rem;
                    opacity:.7;
                ">
                    Create a new password for your CHOZ account.
                </p>

                <input
                    type="password"
                    id="new-password"
                    placeholder="New Password"
                    autocomplete="new-password"
                    style="
                        width:100%;
                        padding:.9rem;
                        margin-bottom:1rem;
                    "
                >

                <input
                    type="password"
                    id="confirm-new-password"
                    placeholder="Confirm New Password"
                    autocomplete="new-password"
                    style="
                        width:100%;
                        padding:.9rem;
                        margin-bottom:1rem;
                    "
                >

                <button
                    id="update-password-btn"
                    class="btn btn-primary"
                    style="width:100%;"
                >
                    Update Password
                </button>

            </div>
        `;

        document.body.appendChild(modal);

        document
            .getElementById(
                'update-password-btn'
            )
            .addEventListener(
                'click',
                updatePassword
            );
    }

    modal.style.display = 'flex';
}


async function updatePassword() {

    const password =
        document.getElementById(
            'new-password'
        )?.value;

    const confirmPassword =
        document.getElementById(
            'confirm-new-password'
        )?.value;

    const button =
        document.getElementById(
            'update-password-btn'
        );

    if (!password || !confirmPassword) {

        showToast(
            'Please enter both password fields.',
            'error'
        );

        return;
    }

    if (password.length < 6) {

        showToast(
            'Password must be at least 6 characters.',
            'error'
        );

        return;
    }

    if (password !== confirmPassword) {

        showToast(
            'Passwords do not match.',
            'error'
        );

        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = 'Updating...';
    }

    try {

        const { error } =
            await chozSupabase.auth
                .updateUser({
                    password
                });

        if (error) {
            throw error;
        }

        showToast(
            'Password updated successfully!',
            'success'
        );

        const modal =
            document.getElementById(
                'password-reset-modal'
            );

        if (modal) {
            modal.remove();
        }

        await chozSupabase.auth.signOut();

        openAuthModal();

        showToast(
            'You can now sign in with your new password.',
            'info'
        );

    } catch (error) {

        console.error(
            'Update password error:',
            error
        );

        showToast(
            error.message ||
            'Could not update password.',
            'error'
        );

    } finally {

        if (button) {
            button.disabled = false;
            button.textContent =
                'Update Password';
        }
    }
}


// ============================================================
// SIGN OUT
// ============================================================

async function signOut() {

    const { error } =
        await chozSupabase.auth.signOut();

    if (error) {

        showToast(
            error.message,
            'error'
        );

        return;
    }

    currentUser = null;

    updateAuthUI(false);

    showToast(
        'Signed out.',
        'info'
    );

    window.location.href = '/';
}


// ============================================================
// LOAD USER PROFILE
// ============================================================

async function loadUserProfile() {

    if (!currentUser) return;

    const { data, error } =
        await chozSupabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

    if (error) {

        console.error(
            'Profile error:',
            error
        );

        return;
    }

    window.userProfile = data;
}


// ============================================================
// TOAST
// ============================================================

function showToast(
    message,
    type = 'info'
) {

    const toast =
        document.createElement('div');

    toast.className =
        `toast toast-${type}`;

    toast.textContent =
        message;

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
        z-index: 99999;
        box-shadow: 0 10px 30px rgba(0,0,0,.2);
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4000);
}


// ============================================================
// INITIALIZE
// ============================================================

initAuth();
