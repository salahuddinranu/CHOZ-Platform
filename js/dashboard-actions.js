// ============================================================
// CHOZ DASHBOARD ACTIONS OVERRIDE
// Intercepts signout + delete buttons and replaces them with
// proper confirmation flows. No changes to dashboard.js needed.
// ============================================================

(function() {
    'use strict';

    // Wait for DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOverride);
    } else {
        initOverride();
    }

    function initOverride() {
        // Event delegation — catches clicks on dynamically created buttons
        document.addEventListener('click', function(e) {
            // SIGN OUT BUTTON
            if (e.target && e.target.id === 'signOutBtn') {
                e.preventDefault();
                e.stopPropagation();
                showSignOutConfirmation();
                return false;
            }

            // DELETE ACCOUNT BUTTON
            if (e.target && e.target.id === 'deleteAccBtn') {
                e.preventDefault();
                e.stopPropagation();
                startDeleteFlow();
                return false;
            }
        }, true); // Use capture phase to intercept before dashboard.js handlers
    }

    // ============================================================
    // SIGN OUT WITH CONFIRMATION
    // ============================================================
    function showSignOutConfirmation() {
        const existing = document.getElementById('signOutModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'signOutModal';
        modal.className = 'modal';
        modal.style.zIndex = '9999';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:420px;text-align:center">
                <div style="font-size:52px;margin-bottom:16px;line-height:1">👋</div>
                <h3 style="font-family:'Bricolage Grotesque';font-size:22px;margin-bottom:10px">Sign out?</h3>
                <p style="color:var(--mute);font-size:14px;line-height:1.6;margin-bottom:26px">
                    Are you sure you want to sign out?<br>
                    Your saved decisions and memories will be waiting for you.
                </p>
                <div style="display:flex;gap:10px;flex-direction:column">
                    <button class="btn" style="padding:14px;font-size:15px" id="cancelSignOut">
                        ← No, continue using CHOZ
                    </button>
                    <button class="btn" style="padding:14px;font-size:15px;color:#ef4444;border-color:#ef4444" id="confirmSignOut">
                        Yes, sign me out
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('cancelSignOut').onclick = () => modal.remove();
        document.getElementById('confirmSignOut').onclick = async () => {
            const btn = document.getElementById('confirmSignOut');
            btn.disabled = true;
            btn.textContent = 'Signing out...';
            try {
                await sb.auth.signOut();
                window.location.href = '/';
            } catch (err) {
                btn.disabled = false;
                btn.textContent = 'Yes, sign me out';
                if (typeof toastError === 'function') toastError('Could not sign out: ' + err.message);
            }
        };

        modal.addEventListener('click', (e) => {
            if (e.target.id === 'signOutModal') modal.remove();
        });
    }

    // ============================================================
    // DELETE ACCOUNT — STEP 1 (Reason)
    // ============================================================
    function startDeleteFlow() {
        showDeleteStep1();
    }

    function showDeleteStep1() {
        const existing = document.getElementById('deleteModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'deleteModal';
        modal.className = 'modal';
        modal.style.zIndex = '9999';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:480px">
                <button class="modal-close" onclick="document.getElementById('deleteModal').remove()">×</button>

                <div style="text-align:center;margin-bottom:22px">
                    <div style="font-size:44px;margin-bottom:12px;line-height:1">😔</div>
                    <h3 style="font-family:'Bricolage Grotesque';font-size:22px;margin-bottom:6px">
                        We're sorry to see you go
                    </h3>
                    <p style="color:var(--mute);font-size:14px;line-height:1.6">
                        Before you go, could you tell us why?<br>
                        Your feedback helps us improve CHOZ.
                    </p>
                </div>

                <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px">
                    ${[
                        ['not_useful', "CHOZ isn't useful for me"],
                        ['privacy', 'Privacy concerns'],
                        ['too_complex', 'Too complex to use'],
                        ['missing_features', 'Missing features I need'],
                        ['taking_break', 'Just taking a break'],
                        ['other', 'Other reason']
                    ].map(([val, label]) => `
                        <label style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid var(--line);border-radius:10px;cursor:pointer;font-size:14px">
                            <input type="radio" name="chozDelReason" value="${val}" style="accent-color:var(--ac);width:16px;height:16px">
                            <span>${label}</span>
                        </label>
                    `).join('')}
                </div>

                <textarea id="chozDelFeedback" placeholder="Any additional feedback? (optional)" maxlength="300" rows="2"
                    style="width:100%;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink);font-family:inherit;font-size:14px;resize:vertical;margin-bottom:18px;box-sizing:border-box"></textarea>

                <div style="display:flex;gap:10px;flex-direction:column">
                    <button class="btn p" style="padding:14px;font-size:15px" id="chozDelNext">
                        Continue
                    </button>
                    <button class="btn" style="padding:14px;font-size:15px" id="chozDelCancel">
                        ← Actually, keep my account
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('chozDelNext').onclick = () => {
            const selected = document.querySelector('input[name="chozDelReason"]:checked');
            if (!selected) {
                if (typeof toastWarning === 'function') toastWarning('Please select a reason');
                return;
            }
            const feedback = (document.getElementById('chozDelFeedback') || {}).value || '';
            showDeleteStep2(selected.value, feedback.trim());
        };

        document.getElementById('chozDelCancel').onclick = () => modal.remove();
    }

    // ============================================================
    // DELETE ACCOUNT — STEP 2 (Retention)
    // ============================================================
    function showDeleteStep2(reason, feedback) {
        const modal = document.getElementById('deleteModal');
        if (!modal) return;

        modal.querySelector('.modal-content').innerHTML = `
            <button class="modal-close" onclick="document.getElementById('deleteModal').remove()">×</button>

            <div style="text-align:center;margin-bottom:22px">
                <div style="font-size:44px;margin-bottom:12px;line-height:1">💡</div>
                <h3 style="font-family:'Bricolage Grotesque';font-size:22px;margin-bottom:6px">
                    Before you delete...
                </h3>
                <p style="color:var(--mute);font-size:14px;line-height:1.6">
                    You have other options that might work for you:
                </p>
            </div>

            <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:22px">
                <div style="padding:16px;background:var(--ac-soft);border-radius:12px">
                    <strong style="font-size:15px;display:block;margin-bottom:4px;color:var(--ac)">💾 Export your data</strong>
                    <p style="margin:0;font-size:13px;color:var(--mute);line-height:1.5">
                        Download all your decisions, memories, and favorites before leaving.
                    </p>
                </div>

                <div style="padding:16px;background:var(--ac-soft);border-radius:12px">
                    <strong style="font-size:15px;display:block;margin-bottom:4px;color:var(--ac)">⏸️ Take a break</strong>
                    <p style="margin:0;font-size:13px;color:var(--mute);line-height:1.5">
                        Just sign out and come back later. Your account stays safe.
                    </p>
                </div>

                <div style="padding:16px;background:var(--ac-soft);border-radius:12px">
                    <strong style="font-size:15px;display:block;margin-bottom:4px;color:var(--ac)">💬 Tell us what's wrong</strong>
                    <p style="margin:0;font-size:13px;color:var(--mute);line-height:1.5">
                        We may be able to fix the issue you're facing.
                    </p>
                </div>
            </div>

            <div style="display:flex;gap:10px;flex-direction:column">
                <button class="btn" style="padding:14px;font-size:15px" id="chozDelExport">
                    📥 Export my data first
                </button>
                <button class="btn" style="padding:14px;font-size:15px" id="chozDelBreak">
                    ⏸️ Just sign me out for now
                </button>
                <button class="btn" style="padding:14px;font-size:15px;color:#ef4444;border-color:#ef4444" id="chozDelStill">
                    I still want to delete my account
                </button>
            </div>
        `;

        document.getElementById('chozDelExport').onclick = async () => {
            await exportUserData();
        };

        document.getElementById('chozDelBreak').onclick = async () => {
            await sb.auth.signOut();
            window.location.href = '/';
        };

        document.getElementById('chozDelStill').onclick = () => {
            showDeleteStep3(reason, feedback);
        };
    }

    // ============================================================
    // DELETE ACCOUNT — STEP 3 (Final confirmation)
    // ============================================================
    function showDeleteStep3(reason, feedback) {
        const modal = document.getElementById('deleteModal');
        if (!modal) return;

        modal.querySelector('.modal-content').innerHTML = `
            <div style="text-align:center;margin-bottom:20px">
                <div style="font-size:44px;margin-bottom:12px;line-height:1">⚠️</div>
                <h3 style="font-family:'Bricolage Grotesque';font-size:22px;margin-bottom:6px;color:#ef4444">
                    Final confirmation
                </h3>
                <p style="color:var(--mute);font-size:14px;line-height:1.6;margin-bottom:14px">
                    This will <strong style="color:var(--ink)">permanently delete</strong>:
                </p>
                <ul style="text-align:left;color:var(--mute);font-size:13px;line-height:1.8;padding-left:22px;margin:0 0 16px 0">
                    <li>Your account and profile</li>
                    <li>Comparison history</li>
                    <li>All Decision Memories</li>
                    <li>Favorites and bookmarks</li>
                    <li>Your reviews</li>
                </ul>
                <p style="color:#ef4444;font-size:13px;font-weight:600;margin-bottom:14px">
                    ⚠️ This cannot be undone.
                </p>
            </div>

            <label style="display:block;font-size:13px;font-weight:600;margin-bottom:8px">
                Type <code style="background:var(--line);padding:2px 6px;border-radius:4px;font-size:12px">DELETE</code> to confirm:
            </label>
            <input type="text" id="chozDelConfirm" placeholder="Type DELETE" autocomplete="off"
                style="width:100%;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink);font-family:inherit;font-size:15px;margin-bottom:18px;letter-spacing:2px;text-align:center;box-sizing:border-box">

            <div style="display:flex;gap:10px;flex-direction:column">
                <button class="btn" style="padding:14px;font-size:15px;background:#ef4444;color:white;border-color:#ef4444;opacity:0.5;cursor:not-allowed" id="chozDelFinal" disabled>
                    🗑️ Delete my account forever
                </button>
                <button class="btn" style="padding:14px;font-size:15px" id="chozDelCancelFinal">
                    ← Cancel, keep my account
                </button>
            </div>
        `;

        const input = document.getElementById('chozDelConfirm');
        const finalBtn = document.getElementById('chozDelFinal');

        input.addEventListener('input', () => {
            const ok = input.value === 'DELETE';
            finalBtn.disabled = !ok;
            finalBtn.style.opacity = ok ? '1' : '0.5';
            finalBtn.style.cursor = ok ? 'pointer' : 'not-allowed';
        });

        document.getElementById('chozDelCancelFinal').onclick = () => modal.remove();

        finalBtn.onclick = async () => {
            if (input.value !== 'DELETE') return;
            finalBtn.disabled = true;
            finalBtn.textContent = 'Deleting account...';

            try {
                const { data: { session } } = await sb.auth.getSession();
                if (!session) { window.location.href = '/'; return; }
                const userId = session.user.id;

                // Save feedback first
                if (reason || feedback) {
                    try {
                        await sb.from('feedback').insert({
                            user_id: userId,
                            type: 'account_deletion',
                            subject: 'Deletion reason: ' + (reason || 'not specified'),
                            message: feedback || '(no additional feedback)',
                            email: session.user.email
                        });
                    } catch (e) { console.warn('Feedback save:', e); }
                }

                // Delete user data
                await sb.from('decision_memories').delete().eq('user_id', userId);
                await sb.from('favorites').delete().eq('user_id', userId);
                await sb.from('saved_comparisons').delete().eq('user_id', userId);
                await sb.from('user_reviews').delete().eq('user_id', userId);
                await sb.from('user_notifications').delete().eq('user_id', userId);
                await sb.from('comparisons').delete().eq('user_id', userId);
                await sb.from('profiles').delete().eq('id', userId);

                await sb.auth.signOut();
                alert('Your account has been deleted. We\'re sorry to see you go.');
                window.location.href = '/';

            } catch (err) {
                console.error('Delete error:', err);
                finalBtn.textContent = '⚠️ Failed — try again';
                finalBtn.disabled = false;
                finalBtn.style.opacity = '1';
                finalBtn.style.cursor = 'pointer';
                if (typeof toastError === 'function') {
                    toastError('Could not delete: ' + err.message);
                }
            }
        };
    }

    // ============================================================
    // EXPORT USER DATA
    // ============================================================
    async function exportUserData() {
        try {
            const { data: { session } } = await sb.auth.getSession();
            if (!session) return;
            const userId = session.user.id;

            const [memories, favorites, saved, reviews, comparisons] = await Promise.all([
                sb.from('decision_memories').select('*').eq('user_id', userId),
                sb.from('favorites').select('*').eq('user_id', userId),
                sb.from('saved_comparisons').select('*').eq('user_id', userId),
                sb.from('user_reviews').select('*').eq('user_id', userId),
                sb.from('comparisons').select('*').eq('user_id', userId)
            ]);

            const exportData = {
                exported_at: new Date().toISOString(),
                user_email: session.user.email,
                decision_memories: memories.data || [],
                favorites: favorites.data || [],
                saved_comparisons: saved.data || [],
                reviews: reviews.data || [],
                comparisons: comparisons.data || []
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'choz-data-export-' + Date.now() + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            if (typeof toastSuccess === 'function') {
                toastSuccess('Data exported! Check your downloads.');
            }
        } catch (err) {
            console.error('Export error:', err);
            if (typeof toastError === 'function') {
                toastError('Could not export: ' + err.message);
            }
        }
    }

})();
