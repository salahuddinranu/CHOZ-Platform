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
    else if (tab === 'reviews') loadMyReviews(content);
    else if (tab === 'profile') loadChoiceProfile(content);
    else if (tab === 'pulse') loadPulseDashboard(content);
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
// ============================================================
// MY REVIEWS
// ============================================================
async function loadMyReviews(content) {
    const { data, error } = await sb
        .from('user_reviews')
        .select('*, items(name, brands(name))')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) { content.innerHTML = `<div class="empty"><h3>Error</h3><p>${error.message}</p></div>`; return; }
    if (!data || data.length === 0) {
        content.innerHTML = emptyState(
            'No reviews yet',
            'When you complete a comparison and write a review, it will appear here.',
            '/#cats',
            'Start comparing'
        );
        return;
    }

    content.innerHTML = data.map(r => `
        <div class="list-item">
            <div style="flex:1">
                <h4>${r.items?.name || 'Item'}</h4>
                <div style="color:var(--hl);font-size:14px;margin:4px 0">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
                ${r.title ? `<strong style="font-size:14px;display:block;margin:6px 0">${escapeHtmlDashboard(r.title)}</strong>` : ''}
                <p class="meta">${escapeHtmlDashboard(r.content || '')}</p>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
                <span class="time">${formatDate(r.created_at)}</span>
                <div style="display:flex;gap:6px">
                    <button class="btn" style="padding:4px 10px;font-size:12px" onclick="editReview('${r.id}', ${r.rating}, \`${(r.title || '').replace(/`/g, '\\`')}\`, \`${(r.content || '').replace(/`/g, '\\`')}\`)">Edit</button>
                    <button class="btn" style="padding:4px 10px;font-size:12px;color:#ef4444" onclick="deleteReview('${r.id}')">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function deleteReview(id) {
    if (!confirm('Delete this review? This cannot be undone.')) return;
    const { error } = await sb.from('user_reviews').delete().eq('id', id).eq('user_id', currentUser.id);
    if (error) { alert(error.message); return; }
    loadTab('reviews');
}

async function editReview(id, currentRating, currentTitle, currentContent) {
    const content = document.getElementById('tabContent');

    content.innerHTML = `
        <div style="background:var(--sf);border:1px solid var(--line);border-radius:14px;padding:24px;max-width:600px;margin:0 auto">
            <h3 style="font-family:'Bricolage Grotesque';font-size:20px;margin-bottom:16px">Edit Review</h3>

            <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px">Rating</label>
            <select id="editRating" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);margin-bottom:14px;font-family:inherit;font-size:14px">
                ${[1,2,3,4,5].map(n => `<option value="${n}" ${n === currentRating ? 'selected' : ''}>${'★'.repeat(n)} (${n}/5)</option>`).join('')}
            </select>

            <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px">Title</label>
            <input type="text" id="editTitle" value="${escapeHtmlDashboard(currentTitle)}" maxlength="80"
                   style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);margin-bottom:14px;font-family:inherit;font-size:14px">

            <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px">Review</label>
            <textarea id="editContent" rows="4" maxlength="500"
                      style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);margin-bottom:14px;font-family:inherit;font-size:14px;resize:vertical">${escapeHtmlDashboard(currentContent)}</textarea>

            <div style="display:flex;gap:8px">
                <button class="btn p" style="flex:1" onclick="saveReviewEdit('${id}')">Save Changes</button>
                <button class="btn" onclick="loadTab('reviews')">Cancel</button>
            </div>
        </div>
    `;
}

async function saveReviewEdit(id) {
    const rating = parseInt(document.getElementById('editRating').value);
    const title = document.getElementById('editTitle').value.trim();
    const content = document.getElementById('editContent').value.trim();

    const { error } = await sb.from('user_reviews')
        .update({ rating, title: title || null, content: content || null })
        .eq('id', id)
        .eq('user_id', currentUser.id);

    if (error) { alert(error.message); return; }
    loadTab('reviews');
}

function escapeHtmlDashboard(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
// ============================================================
// CHOICE PROFILE — Preference patterns from user activity
// ============================================================
async function loadChoiceProfile(content) {
    content.innerHTML = '<div class="loading">Analyzing your choices...</div>';

    // Fetch all decision memories for this user
    const { data: memories, error } = await sb
        .from('decision_memories')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        content.innerHTML = `<div class="empty"><h3>Error</h3><p>${error.message}</p></div>`;
        return;
    }

    if (!memories || memories.length < 2) {
        content.innerHTML = `
            <div class="empty">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                </svg>
                <h3>Not enough data yet</h3>
                <p style="margin-bottom:20px">Complete at least 2 comparisons and save them to Memory. Your Choice Profile will then show your priority patterns.</p>
                <a class="btn p" href="/#cats">Start comparing →</a>
            </div>
        `;
        return;
    }

    // Analyze priorities across all memories
    const priorityCounts = {};
    const priorityRanks = {}; // Track average rank for each priority

    memories.forEach(m => {
        const priorities = m.priorities || [];
        priorities.forEach((p, idx) => {
            // p is a priority object or an ID — normalize
            let pid;
            if (typeof p === 'string') pid = p;
            else if (typeof p === 'object' && p !== null) pid = p.id || p.attribute_id || p.attr_id;
            else return;

            if (!pid) return;

            if (!priorityCounts[pid]) {
                priorityCounts[pid] = 0;
                priorityRanks[pid] = [];
            }
            priorityCounts[pid]++;
            priorityRanks[pid].push(idx + 1);
        });
    });

    // If priorities are stored as IDs, we need to fetch their names
    const priorityIds = Object.keys(priorityCounts);
    let priorityNameMap = {};

    if (priorityIds.length > 0) {
        const { data: attrDefs } = await sb
            .from('attribute_definitions')
            .select('id, name')
            .in('id', priorityIds);

        if (attrDefs) {
            attrDefs.forEach(a => { priorityNameMap[a.id] = a.name; });
        }
    }

    // Build insights
    const insights = Object.entries(priorityCounts)
        .map(([pid, count]) => ({
            id: pid,
            name: priorityNameMap[pid] || pid.substring(0, 8) + '...',
            count,
            percentage: Math.round((count / memories.length) * 100),
            avgRank: priorityRanks[pid].reduce((a, b) => a + b, 0) / priorityRanks[pid].length
        }))
        .filter(i => i.percentage >= 40) // Only show if 40%+ of comparisons
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 5);

    // Generate natural-language insights
    const insightsText = generateInsightsText(insights, memories.length);

    // Determine the top priority
    const topPriority = insights.length > 0 ? insights[0] : null;

    content.innerHTML = `
        <div style="background:var(--sf);border:1px solid var(--line);border-radius:16px;padding:24px;margin-bottom:16px">
            <h2 style="font-family:'Bricolage Grotesque';font-size:22px;margin-bottom:8px">Your Choice Profile</h2>
            <p style="color:var(--mute);font-size:14px;margin-bottom:20px">
                Based on your <strong>${memories.length} saved decisions</strong> on CHOZ.
                This is a transparent observation of your own activity — not a personality assessment.
            </p>

            ${topPriority ? `
                <div style="background:linear-gradient(135deg,var(--ac),#7C3AED);color:white;padding:20px;border-radius:14px;margin-bottom:20px">
                    <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:0.8;margin-bottom:8px">
                        Your #1 priority
                    </div>
                    <div style="font-family:'Bricolage Grotesque';font-size:24px;font-weight:700;margin-bottom:4px">
                        ${escapeHtmlProfile(topPriority.name)}
                    </div>
                    <div style="font-size:13px;opacity:0.9">
                        Appeared in ${topPriority.percentage}% of your comparisons
                    </div>
                </div>
            ` : ''}

            ${insights.length > 0 ? `
                <h3 style="font-family:'Bricolage Grotesque';font-size:16px;margin-bottom:12px">
                    Patterns detected
                </h3>
                ${insights.map(i => `
                    <div style="margin-bottom:14px">
                        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
                            <span style="font-weight:500">${escapeHtmlProfile(i.name)}</span>
                            <span style="color:var(--mute)">${i.percentage}%</span>
                        </div>
                        <div style="height:6px;background:var(--line);border-radius:3px;overflow:hidden">
                            <div style="height:100%;background:var(--ac);width:${i.percentage}%"></div>
                        </div>
                    </div>
                `).join('')}
            ` : `
                <p style="color:var(--mute);font-size:14px;text-align:center;padding:20px">
                    Your priorities vary too much to identify a clear pattern yet.
                    Complete more comparisons to see insights.
                </p>
            `}
        </div>

        ${insightsText.length > 0 ? `
            <div style="background:var(--sf);border:1px solid var(--line);border-radius:16px;padding:24px;margin-bottom:16px">
                <h3 style="font-family:'Bricolage Grotesque';font-size:16px;margin-bottom:12px">
                    What this suggests
                </h3>
                ${insightsText.map(t => `
                    <p style="font-size:14px;color:var(--mute);line-height:1.7;margin-bottom:10px">
                        ${t}
                    </p>
                `).join('')}
            </div>
        ` : ''}

        <div style="background:var(--sf);border:1px solid var(--line);border-radius:16px;padding:24px">
            <h3 style="font-family:'Bricolage Grotesque';font-size:16px;margin-bottom:8px">
                About this profile
            </h3>
            <p style="font-size:13px;color:var(--mute);line-height:1.7;margin-bottom:16px">
                Choice Profile observes patterns in your own CHOZ activity. It does not diagnose
                personality, psychology, or any sensitive trait. It only reflects what you chose
                to prioritize when comparing options on CHOZ.
            </p>
            <button class="btn" style="color:#ef4444;border-color:#ef4444" onclick="resetChoiceProfile()">
                Reset Choice Profile
            </button>
        </div>
    `;
}

// Generate natural-language insights
function generateInsightsText(insights, totalComparisons) {
    const text = [];

    if (insights.length === 0) return text;

    const top = insights[0];
    const second = insights[1];

    if (top.percentage >= 70) {
        text.push(`Across most of your decisions, <strong>${escapeHtmlProfile(top.name)}</strong> has been one of your top priorities.`);
    } else if (top.percentage >= 50) {
        text.push(`You frequently prioritize <strong>${escapeHtmlProfile(top.name)}</strong> when comparing options.`);
    }

    if (second && second.percentage >= 40) {
        text.push(`You also consistently consider <strong>${escapeHtmlProfile(second.name)}</strong> — it appeared in ${second.percentage}% of your comparisons.`);
    }

    if (insights.length >= 3) {
        text.push(`Overall, your decisions tend to balance ${insights.slice(0, 3).map(i => `<strong>${escapeHtmlProfile(i.name)}</strong>`).join(', ')}.`);
    }

    if (totalComparisons >= 5) {
        text.push(`This analysis is based on ${totalComparisons} saved decisions — a growing picture of what matters to you.`);
    }

    return text;
}

// Reset choice profile
async function resetChoiceProfile() {
    if (!confirm('Reset your Choice Profile? This will clear your saved Decision Memories. This cannot be undone.')) {
        return;
    }

    const { error } = await sb
        .from('decision_memories')
        .delete()
        .eq('user_id', currentUser.id);

    if (error) {
        alert('Could not reset: ' + error.message);
        return;
    }

    alert('Choice Profile reset.');
    loadTab('profile');
}

// Escape helper (agar pehle se nahi hai)
function escapeHtmlProfile(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}
// ============================================================
// CHOZ PULSE — Dashboard view
// ============================================================
async function loadPulseDashboard(content) {
    content.innerHTML = '<div class="loading">Loading community trends...</div>';

    const { data: trends, error } = await sb
        .from('pulse_category_trends')
        .select('*')
        .order('total_comparisons', { ascending: false });

    if (error) {
        content.innerHTML = `<div class="empty"><h3>Could not load</h3><p>${error.message}</p></div>`;
        return;
    }

    const activeTrends = (trends || []).filter(t => t.total_comparisons > 0);

    if (activeTrends.length === 0) {
        content.innerHTML = `
            <div class="empty">
                <h3>No community data yet</h3>
                <p style="margin-bottom:20px">Community trends will appear here once enough comparisons have been completed.</p>
                <a class="btn p" href="/#cats">Start comparing →</a>
            </div>
        `;
        return;
    }

    content.innerHTML = `
        <div style="background:var(--sf);border:1px solid var(--line);border-radius:16px;padding:24px;margin-bottom:16px">
            <h2 style="font-family:'Bricolage Grotesque';font-size:22px;margin-bottom:8px">CHOZ Pulse</h2>
            <p style="color:var(--mute);font-size:14px;margin-bottom:20px">
                Anonymous aggregate trends from the CHOZ community. No individual user data is shown.
            </p>

            ${activeTrends.slice(0, 10).map(t => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-top:1px solid var(--line)">
                    <div style="display:flex;align-items:center;gap:12px">
                        <span style="font-size:22px">${t.category_icon || '📦'}</span>
                        <div>
                            <div style="font-weight:500;font-size:15px">${escapeHtmlPulse(t.category_name)}</div>
                            <div style="font-size:12px;color:var(--mute);margin-top:2px">
                                ${t.unique_users || 0} unique users
                            </div>
                        </div>
                    </div>
                    <div style="text-align:right">
                        <div style="font-family:'Bricolage Grotesque';font-size:20px;font-weight:700;color:var(--ac)">
                            ${t.total_comparisons}
                        </div>
                        <div style="font-size:11px;color:var(--mute)">comparisons</div>
                    </div>
                </div>
            `).join('')}
        </div>

        <div style="background:var(--sf);border:1px solid var(--line);border-radius:16px;padding:24px">
            <h3 style="font-family:'Bricolage Grotesque';font-size:16px;margin-bottom:8px">
                About CHOZ Pulse
            </h3>
            <p style="font-size:13px;color:var(--mute);line-height:1.7">
                CHOZ Pulse shows anonymized trends from completed comparisons.
                Popularity in the community does not mean a product is objectively better —
                it only reflects what other users are choosing.
                Trends are updated as new comparisons are completed.
            </p>
        </div>
    `;
}
// ============================================================
// CHOZ PULSE — Dashboard view
// ============================================================
async function loadPulseDashboard(content) {
    content.innerHTML = '<div class="loading">Loading community trends...</div>';

    try {
        const { data: trends, error } = await sb
            .from('pulse_category_trends')
            .select('*')
            .order('total_comparisons', { ascending: false });

        if (error) {
            content.innerHTML = `
                <div class="empty">
                    <h3>Could not load</h3>
                    <p style="color:#6b7280;font-size:13px">${error.message}</p>
                    <p style="color:#6b7280;font-size:12px;margin-top:8px">Make sure the pulse_category_trends view exists in Supabase.</p>
                </div>
            `;
            return;
        }

        const activeTrends = (trends || []).filter(t => t.total_comparisons > 0);

        if (activeTrends.length === 0) {
            content.innerHTML = `
                <div style="background:var(--sf);border:1px solid var(--line);border-radius:16px;padding:40px 24px;text-align:center">
                    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--mute)" stroke-width="1.5" style="opacity:0.4;margin-bottom:16px">
                        <path d="M3 3v18h18"/>
                        <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
                    </svg>
                    <h3 style="font-family:'Bricolage Grotesque';font-size:20px;margin-bottom:8px">No community data yet</h3>
                    <p style="color:var(--mute);font-size:14px;max-width:400px;margin:0 auto 20px">
                        Complete a few comparisons and community trends will appear here.
                    </p>
                    <a class="btn p" href="/#cats">Start comparing →</a>
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div style="background:var(--sf);border:1px solid var(--line);border-radius:16px;padding:24px;margin-bottom:16px">
                <h2 style="font-family:'Bricolage Grotesque';font-size:22px;margin-bottom:8px">CHOZ Pulse</h2>
                <p style="color:var(--mute);font-size:14px;margin-bottom:20px">
                    Anonymous aggregate trends from the CHOZ community. No individual user data is shown.
                </p>

                ${activeTrends.slice(0, 10).map(t => `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-top:1px solid var(--line)">
                        <div style="display:flex;align-items:center;gap:12px">
                            <span style="font-size:24px">${t.category_icon || '📦'}</span>
                            <div>
                                <div style="font-weight:600;font-size:15px">${escapeHtmlPulse(t.category_name)}</div>
                                <div style="font-size:12px;color:var(--mute);margin-top:2px">
                                    ${t.unique_users || 0} unique users
                                </div>
                            </div>
                        </div>
                        <div style="text-align:right">
                            <div style="font-family:'Bricolage Grotesque';font-size:22px;font-weight:700;color:var(--ac)">
                                ${t.total_comparisons}
                            </div>
                            <div style="font-size:11px;color:var(--mute)">comparisons</div>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div style="background:var(--sf);border:1px solid var(--line);border-radius:16px;padding:24px">
                <h3 style="font-family:'Bricolage Grotesque';font-size:16px;margin-bottom:8px">
                    About CHOZ Pulse
                </h3>
                <p style="font-size:13px;color:var(--mute);line-height:1.7">
                    CHOZ Pulse shows anonymized trends from completed comparisons.
                    Popularity in the community does not mean a product is objectively better —
                    it only reflects what other users are choosing.
                    Trends are updated as new comparisons are completed.
                </p>
            </div>
        `;
    } catch (err) {
        content.innerHTML = `
            <div class="empty">
                <h3>Error</h3>
                <p style="color:#6b7280">${err.message}</p>
            </div>
        `;
    }
}

function escapeHtmlPulse(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
