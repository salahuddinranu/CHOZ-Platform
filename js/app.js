// ============================================================
// CHOZ MAIN APP — Clean Version
// ============================================================

// ============================================================
// THEME TOGGLE
// ============================================================
const themeBtn = document.getElementById('themeBtn');

function getTheme() {
    const stored = document.documentElement.getAttribute('data-theme');
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function updateThemeBtn() {
    if (themeBtn) themeBtn.textContent = getTheme() === 'dark' ? '☀️' : '🌙';
}

if (themeBtn) {
    themeBtn.onclick = () => {
        const next = getTheme() === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('choz-theme', next);
        updateThemeBtn();
    };
}

const savedTheme = localStorage.getItem('choz-theme');
if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeBtn();

// ============================================================
// AUTH STATE
// ============================================================
let currentUser = null;
let authMode = 'signin';

async function checkAuth() {
    const { data: { session } } = await sb.auth.getSession();
    currentUser = session?.user || null;
    updateAuthUI();
}

function updateAuthUI() {
    const authBtn = document.getElementById('authBtn');
    const dashBtn = document.getElementById('dashBtn');
    if (!authBtn || !dashBtn) return;

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
    if (typeof initNotifications === 'function') initNotifications();
});

// ============================================================
// AUTH MODAL
// ============================================================
function openAuth() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('hidden');
}

function closeAuth() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.add('hidden');

    const errEl = document.getElementById('authError');
    if (errEl) errEl.textContent = '';

    const passEl = document.getElementById('authPass');
    if (passEl) passEl.value = '';

    const terms = document.getElementById('termsCheck');
    if (terms) terms.checked = false;

    if (typeof updatePasswordStrength === 'function') updatePasswordStrength();
}

function toggleAuthMode(e) {
    if (e) e.preventDefault();
    authMode = authMode === 'signin' ? 'signup' : 'signin';

    const title = document.getElementById('authTitle');
    const submit = document.getElementById('authSubmit');
    const switchText = document.getElementById('authSwitchText');
    const switchLink = document.getElementById('authSwitch');
    const strength = document.getElementById('passwordStrength');
    const terms = document.getElementById('termsLabel');
    const pwdInput = document.getElementById('authPass');
    const errEl = document.getElementById('authError');

    if (title) title.textContent = authMode === 'signin' ? 'Sign in' : 'Sign up';
    if (submit) submit.textContent = authMode === 'signin' ? 'Sign in' : 'Sign up';
    if (switchText) switchText.textContent = authMode === 'signin' ? 'No account?' : 'Already have account?';
    if (switchLink) switchLink.textContent = authMode === 'signin' ? 'Sign up' : 'Sign in';
    if (strength) strength.style.display = authMode === 'signup' ? 'block' : 'none';
    if (terms) terms.style.display = authMode === 'signup' ? 'flex' : 'none';
    if (pwdInput) pwdInput.setAttribute('autocomplete', authMode === 'signup' ? 'new-password' : 'current-password');
    if (errEl) errEl.textContent = '';
}

async function handleAuthSubmit() {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPass').value;
    const errEl = document.getElementById('authError');
    const submitBtn = document.getElementById('authSubmit');

    errEl.textContent = '';
    errEl.style.color = '#ef4444';

    if (!email || !password) {
        errEl.textContent = 'Email and password required.';
        return;
    }

    // Signup validations
    if (authMode === 'signup') {
        const checks = checkPasswordStrength(password);
        if (!checks.length) {
            errEl.textContent = 'Password must be at least 8 characters.';
            return;
        }
        if (!checks.upper || !checks.number) {
            errEl.textContent = 'Password must contain an uppercase letter and a number.';
            return;
        }

        const termsCheck = document.getElementById('termsCheck');
        if (!termsCheck || !termsCheck.checked) {
            errEl.textContent = 'Please agree to Terms and Privacy Policy.';
            return;
        }
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Please wait...';

    try {
        if (authMode === 'signin') {
            const { error } = await sb.auth.signInWithPassword({ email, password });
            if (error) throw error;
            closeAuth();
            if (typeof toastSuccess === 'function') toastSuccess('Welcome back!');
        } else {
            const { error } = await sb.auth.signUp({ email, password });
            if (error) throw error;
            errEl.style.color = '#22c55e';
            errEl.textContent = 'Account created! You can now sign in.';

            const termsCheck = document.getElementById('termsCheck');
            if (termsCheck) termsCheck.checked = false;
            document.getElementById('authPass').value = '';
            updatePasswordStrength();

            if (typeof toastSuccess === 'function') toastSuccess('Account created!');
        }
    } catch (err) {
        errEl.style.color = '#ef4444';

        let msg = err.message || 'Something went wrong.';
        const lowerMsg = msg.toLowerCase();

        // Better error messages
        if (lowerMsg.includes('invalid login credentials') || lowerMsg.includes('invalid credentials')) {
            msg = 'Invalid email or password. If you signed up with Google, use "Continue with Google" below, or click "Forgot password?" to set a password.';
        } else if (lowerMsg.includes('email not confirmed')) {
            msg = 'Please verify your email first. Check your inbox for the confirmation link.';
        } else if (lowerMsg.includes('user already registered') || lowerMsg.includes('already been registered')) {
            msg = 'This email is already registered. Try signing in, or use "Forgot password?" to reset.';
        } else if (lowerMsg.includes('password should be') || lowerMsg.includes('weak password')) {
            msg = 'Password is too weak. Use at least 8 characters with uppercase and number.';
        } else if (lowerMsg.includes('rate limit') || lowerMsg.includes('too many')) {
            msg = 'Too many attempts. Please wait a few minutes and try again.';
        } else if (lowerMsg.includes('provider') && lowerMsg.includes('google')) {
            msg = 'This account uses Google sign-in. Please use "Continue with Google".';
        }

        errEl.textContent = msg;

    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = authMode === 'signin' ? 'Sign in' : 'Sign up';
    }
}

// ============================================================
// FORGOT PASSWORD
// ============================================================
async function handleForgotPassword(e) {
    if (e) e.preventDefault();

    const email = document.getElementById('authEmail').value.trim();
    const errEl = document.getElementById('authError');

    if (!email) {
        errEl.style.color = '#ef4444';
        errEl.textContent = 'Enter your email above, then click Forgot password.';
        document.getElementById('authEmail').focus();
        return;
    }

    errEl.style.color = 'var(--mute)';
    errEl.textContent = 'Sending reset link...';

    try {
        const { error } = await sb.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/dashboard.html'
        });

        if (error) throw error;

        errEl.style.color = '#22c55e';
        errEl.textContent = '✓ Reset link sent to ' + email + '. Check your inbox and spam folder.';

        if (typeof toastSuccess === 'function') {
            toastSuccess('Reset link sent to ' + email);
        }
    } catch (err) {
        errEl.style.color = '#ef4444';
        let msg = err.message || 'Could not send reset link.';
        if (msg.toLowerCase().includes('rate limit')) {
            msg = 'Too many attempts. Please wait and try again.';
        }
        errEl.textContent = msg;
    }
}

async function handleGoogleLogin() {
    const errEl = document.getElementById('authError');
    try {
        const { error } = await sb.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        });
        if (error) throw error;
    } catch (err) {
        if (errEl) errEl.textContent = err.message;
    }
}

// ============================================================
// PASSWORD STRENGTH
// ============================================================
function checkPasswordStrength(pwd) {
    return {
        length: pwd.length >= 8,
        upper: /[A-Z]/.test(pwd),
        number: /[0-9]/.test(pwd),
        symbol: /[^A-Za-z0-9]/.test(pwd)
    };
}

function updatePasswordStrength() {
    const pwdEl = document.getElementById('authPass');
    if (!pwdEl) return;
    const pwd = pwdEl.value || '';
    const checks = checkPasswordStrength(pwd);

    document.querySelectorAll('#pwdChecks li').forEach(li => {
        const key = li.dataset.check;
        const icon = li.querySelector('.pwd-check-icon');
        if (!icon) return;

        if (checks[key]) {
            icon.textContent = '✓';
            icon.style.color = '#22c55e';
            icon.style.fontWeight = 'bold';
            li.style.color = 'var(--ink)';
        } else {
            icon.textContent = '○';
            icon.style.color = 'var(--mute)';
            icon.style.fontWeight = 'normal';
            li.style.color = 'var(--mute)';
        }
    });

    const score = Object.values(checks).filter(Boolean).length;
    const colors = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#16a34a'];
    const labels = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];

    document.querySelectorAll('.pwd-bar').forEach((bar, idx) => {
        bar.style.background = idx < score ? (colors[score - 1] || '#22c55e') : 'var(--line)';
    });

    const label = document.getElementById('pwdStrengthLabel');
    if (label) {
        label.textContent = pwd.length === 0 ? 'Password strength' : (labels[score] || 'Password strength');
        label.style.color = pwd.length === 0 ? 'var(--mute)' : (colors[score - 1] || '#22c55e');
        label.style.fontWeight = pwd.length > 0 ? '600' : 'normal';
    }
}

// ============================================================
// NOTIFICATIONS
// ============================================================
let notifListener = null;

async function initNotifications() {
    const btn = document.getElementById('notifBtn');
    const dropdown = document.getElementById('notifDropdown');
    if (!btn || !dropdown) return;

    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        btn.style.display = 'none';
        return;
    }

    btn.style.display = 'inline-flex';

    btn.onclick = (e) => {
        e.stopPropagation();
        const isOpen = dropdown.style.display === 'block';
        dropdown.style.display = isOpen ? 'none' : 'block';
        if (!isOpen) loadNotifications();
    };

    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') dropdown.style.display = 'none';
    });

    loadNotifications();
    updateNotifBadge();

    if (notifListener) {
        try { sb.removeChannel(notifListener); } catch (e) {}
    }
    notifListener = sb
        .channel('notifications-' + session.user.id)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'user_notifications',
            filter: `user_id=eq.${session.user.id}`
        }, () => {
            loadNotifications();
            updateNotifBadge();
        })
        .subscribe();
}

async function loadNotifications() {
    const list = document.getElementById('notifList');
    if (!list) return;

    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;

    const { data, error } = await sb
        .from('user_notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error || !data || data.length === 0) {
        list.innerHTML = `
            <p style="text-align:center;color:var(--mute);font-size:13px;padding:32px 16px">
                No notifications yet.
            </p>
        `;
        return;
    }

    list.innerHTML = data.map(n => {
        const safeLink = (n.link || '').replace(/'/g, "\\'");
        return `
            <div onclick="openNotification('${n.id}', '${safeLink}')"
                 style="padding:12px 16px;border-radius:10px;cursor:pointer;margin-bottom:4px;background:${n.is_read ? 'transparent' : 'var(--acbg)'};transition:background 0.15s"
                 onmouseover="this.style.background='var(--bg-alt)'"
                 onmouseout="this.style.background='${n.is_read ? 'transparent' : 'var(--acbg)'}'">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                    <strong style="font-size:13px;font-weight:600;color:var(--ink);line-height:1.4">${escapeNotif(n.title)}</strong>
                    ${!n.is_read ? '<span style="width:8px;height:8px;background:var(--ac);border-radius:50%;flex-shrink:0;margin-top:5px"></span>' : ''}
                </div>
                ${n.message ? `<p style="font-size:12px;color:var(--mute);margin:4px 0 0 0;line-height:1.5">${escapeNotif(n.message)}</p>` : ''}
                <div style="font-size:11px;color:var(--mute);margin-top:6px">${notifTimeAgo(n.created_at)}</div>
            </div>
        `;
    }).join('');
}

async function updateNotifBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;

    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;

    const { count } = await sb
        .from('user_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('is_read', false);

    if (count && count > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = count > 99 ? '99+' : count;
    } else {
        badge.style.display = 'none';
    }
}

async function openNotification(id, link) {
    await sb.from('user_notifications').update({ is_read: true }).eq('id', id);
    updateNotifBadge();
    if (link && link.trim()) {
        window.location.href = link;
    } else {
        loadNotifications();
    }
}

async function markAllNotifsRead() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;

    await sb
        .from('user_notifications')
        .update({ is_read: true })
        .eq('user_id', session.user.id)
        .eq('is_read', false);

    loadNotifications();
    updateNotifBadge();
}

function notifTimeAgo(iso) {
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

function escapeNotif(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

// ============================================================
// CHOZ PULSE
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
            grid.innerHTML = `
                <p style="color:var(--mute);text-align:center;grid-column:1/-1;padding:40px">
                    Community trends are being collected.
                </p>
            `;
            return;
        }

        const activeTrends = (trends || []).filter(t => t.total_comparisons > 0);

        if (activeTrends.length === 0) {
            grid.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;padding:40px 20px">
                    <p style="color:var(--ink);font-weight:500;margin-bottom:6px">Community trends loading</p>
                    <p style="color:var(--mute);font-size:13px;max-width:400px;margin:0 auto">
                        Be among the first to compare.
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
                        <div style="font-size:11px;color:var(--mute);margin-top:2px">Last 30 days</div>
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
        grid.innerHTML = `
            <p style="color:var(--mute);text-align:center;grid-column:1/-1;padding:40px">
                Community trends unavailable right now.
            </p>
        `;
    }
}

function escapeHtmlPulse(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

// ============================================================
// ONBOARDING TOUR
// ============================================================
function initOnboarding() {
    const KEY = 'choz-onboarded';
    if (localStorage.getItem(KEY)) return;

    const modal = document.getElementById('onboardModal');
    if (!modal) return;

    setTimeout(() => {
        modal.classList.remove('hidden');
    }, 1200);
}

function nextOnboardStep(step) {
    showOnboardStep(step);
}

function prevOnboardStep(step) {
    showOnboardStep(step);
}

function showOnboardStep(step) {
    document.querySelectorAll('.onboard-step').forEach(el => {
        el.style.display = el.dataset.step === String(step) ? 'block' : 'none';
    });
    document.querySelectorAll('.onboard-dot').forEach(dot => {
        const isActive = parseInt(dot.dataset.dot) <= step;
        dot.style.background = isActive ? 'var(--ac)' : 'var(--line)';
        dot.style.width = dot.dataset.dot === String(step) ? '24px' : '8px';
        dot.style.borderRadius = dot.dataset.dot === String(step) ? '4px' : '50%';
    });
}

function finishOnboarding() {
    localStorage.setItem('choz-onboarded', '1');
    document.getElementById('onboardModal').classList.add('hidden');
    const cats = document.getElementById('cats');
    if (cats) cats.scrollIntoView({ behavior: 'smooth' });
}

function skipOnboarding() {
    localStorage.setItem('choz-onboarded', '1');
    document.getElementById('onboardModal').classList.add('hidden');
}

function startOnboardingFromHero() {
    localStorage.removeItem('choz-onboarded');
    const modal = document.getElementById('onboardModal');
    if (modal) {
        modal.classList.remove('hidden');
        showOnboardStep(1);
    }
}

// ============================================================
// COOKIE CONSENT
// ============================================================
function initCookieBanner() {
    const COOKIE_KEY = 'choz-cookie-consent';
    const banner = document.getElementById('cookieBanner');
    if (!banner) return;

    const consent = localStorage.getItem(COOKIE_KEY);
    if (consent) {
        applyCookieConsent(consent);
        return;
    }

    setTimeout(() => {
        banner.style.display = 'block';
    }, 800);

    const acceptBtn = document.getElementById('cookieAccept');
    if (acceptBtn) {
        acceptBtn.onclick = () => {
            localStorage.setItem(COOKIE_KEY, 'accepted');
            applyCookieConsent('accepted');
            hideBanner(banner);
        };
    }

    const rejectBtn = document.getElementById('cookieReject');
    if (rejectBtn) {
        rejectBtn.onclick = () => {
            localStorage.setItem(COOKIE_KEY, 'rejected');
            applyCookieConsent('rejected');
            hideBanner(banner);
        };
    }
}

function hideBanner(banner) {
    banner.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    banner.style.transform = 'translateY(100%)';
    banner.style.opacity = '0';
    setTimeout(() => {
        banner.style.display = 'none';
    }, 300);
}

function applyCookieConsent(consent) {
    // Future: load analytics/ads conditionally here
}

function resetCookieConsent() {
    localStorage.removeItem('choz-cookie-consent');
    const banner = document.getElementById('cookieBanner');
    if (banner) {
        banner.style.display = 'block';
        banner.style.transform = 'translateY(0)';
        banner.style.opacity = '1';
        initCookieBanner();
    }
}

// ============================================================
// SERVICE WORKER
// ============================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    });
}

// ============================================================
// EVENT LISTENERS
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // Auth modal close
    const closeBtn = document.getElementById('closeAuth');
    if (closeBtn) closeBtn.onclick = closeAuth;

    const authModal = document.getElementById('authModal');
    if (authModal) {
        authModal.addEventListener('click', (e) => {
            if (e.target.id === 'authModal') closeAuth();
        });
    }

    // Auth switch
    const switchBtn = document.getElementById('authSwitch');
    if (switchBtn) switchBtn.onclick = toggleAuthMode;

    // Password strength
    const pwdInput = document.getElementById('authPass');
    if (pwdInput) {
        pwdInput.addEventListener('input', () => {
            if (authMode === 'signup') updatePasswordStrength();
        });
    }

    // Auth submit
    const submitBtn = document.getElementById('authSubmit');
    if (submitBtn) submitBtn.onclick = handleAuthSubmit;

    // Google login
    const googleBtn = document.getElementById('googleBtn');
    if (googleBtn) googleBtn.onclick = handleGoogleLogin;

    // Hero demo reveal
    const revealBtn = document.getElementById('revealBtn');
    if (revealBtn) {
        revealBtn.onclick = function() {
            const card = document.getElementById('heroCard');
            if (!card) return;
            const isRevealed = card.classList.toggle('rv');
            this.textContent = isRevealed ? 'Hide brands again' : 'Lock choice & reveal';
        };
    }

    // Start comparison button
    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
        startBtn.onclick = () => {
            const cats = document.getElementById('cats');
            if (cats) cats.scrollIntoView({ behavior: 'smooth' });
        };
    }
});

// ============================================================
// INITIALIZE
// ============================================================
checkAuth();
initNotifications();
initCookieBanner();
initOnboarding();
loadCategories();
loadPulse();
