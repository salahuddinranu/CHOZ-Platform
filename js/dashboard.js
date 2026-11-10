// ============================================================
// CHOZ USER DASHBOARD — Complete & Error-Free (Final)
// ============================================================

let currentUser = null;
let currentTab = 'overview';

async function init() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = '/';
        return;
    }
    currentUser = session.user;
    loadTab('overview');
}

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
    else if (tab === 'saved') loadSavedComparisons(content);
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

    // Get Profile Data (Avatar & is_pro status)
    const { data: profile } = await sb.from('profiles').select('avatar_url, is_pro, full_name').eq('id', currentUser.id).maybeSingle();
    const avatarUrl = profile && profile.avatar_url ? profile.avatar_url : '';
    const isPro = profile && profile.is_pro === true;
    
    const userName = profile && profile.full_name ? profile.full_name : (currentUser.email ? currentUser.email.split('@')[0] : 'User');
    const initial = userName.charAt(0).toUpperCase();
    
    // Check if Creator
    const isCreator = currentUser.email === 'salahuddinranu@gmail.com';

    content.innerHTML = `
        <!-- Profile Card -->
        <div style="background: linear-gradient(135deg, #3A3FD9, #7C3AED); color: white; border-radius: 20px; padding: 30px; display: flex; align-items: center; gap: 24px; flex-wrap: wrap; margin-bottom: 24px; position: relative; overflow: hidden; box-shadow: 0 10px 30px rgba(58,63,217,0.3);">
            <div style="position: absolute; top: -50px; right: -50px; width: 150px; height: 150px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
            
            <div style="text-align: center; z-index: 1;">
                <div id="profileAvatar" style="width: 100px; height: 100px; border-radius: 50%; background: rgba(255,255,255,0.2); border: 3px solid white; display: grid; place-items: center; overflow: hidden; font-size: 40px; font-weight: bold; margin: 0 auto; font-family:'Bricolage Grotesque';">
                    ${avatarUrl ? '<img src="' + avatarUrl + '" style="width:100%;height:100%;object-fit:cover;">' : initial}
                </div>
                <input type="file" id="avatarUpload" accept="image/*" style="display: none;">
                <button class="btn" style="margin-top: 12px; font-size: 12px; padding: 6px 16px; background: white; color: var(--ac); border: none; border-radius: 100px; font-weight: 600;" onclick="document.getElementById('avatarUpload').click()">📷 Change</button>
            </div>

            <div style="flex: 1; z-index: 1; min-width: 200px;">
                <h2 style="font-family: 'Bricolage Grotesque'; font-size: 26px; margin-bottom: 4px; color: white;">${userName}</h2>
                <p style="font-size: 14px; opacity: 0.9; margin-bottom: 16px;">${currentUser.email}</p>
                <div style="display: flex; gap: 10px; font-size: 13px; font-weight: 500; flex-wrap: wrap;">
                    ${isCreator ? '<span style="background: #FFD25A; color: #1a1a1a; padding: 6px 14px; border-radius: 100px; font-weight: 700;">👑 Creator of CHOZ</span>' : ''}
                    ${isPro ? '<span style="background: rgba(255,255,255,0.2); padding: 6px 14px; border-radius: 100px;">⭐ Pro Member</span>' : '<span style="background: rgba(255,255,255,0.2); padding: 6px 14px; border-radius: 100px;">🎯 Smart Chooser</span>'}
                </div>
            </div>
        </div>

        <!-- Stats -->
        <div class="stat-grid" style="margin-bottom: 24px;">
            <div class="stat" style="background: #E0E7FF; border: none;">
                <h3 style="color: #4338CA;">${comps.count || 0}</h3>
                <p style="color: #4338CA; font-weight: 600;">Total Comparisons</p>
            </div>
            <div class="stat" style="background: #DCFCE7; border: none;">
                <h3 style="color: #15803D;">${mems.count || 0}</h3>
                <p style="color: #15803D; font-weight: 600;">Decision Memories</p>
            </div>
            <div class="stat" style="background: #FEF3C7; border: none;">
                <h3 style="color: #B45309;">${favs.count || 0}</h3>
                <p style="color: #B45309; font-weight: 600;">Saved Favorites</p>
            </div>
        </div>

        <!-- Action Card -->
        <div style="background: var(--sf); border: 1px solid var(--line); border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <h3 style="font-family: 'Bricolage Grotesque'; font-size: 20px; margin-bottom: 8px;">Ready for your next decision?</h3>
            <p style="color: var(--mute); font-size: 14px; margin-bottom: 20px;">Use blind comparison to find exactly what you need.</p>
            <a class="btn p" href="/#categories" style="padding: 12px 24px; font-size: 15px;">🎯 Start New Comparison</a>
        </div>

        <!-- Pro Access Card (Only show if NOT Pro) -->
        ${!isPro ? `
            <div style="background: linear-gradient(135deg, #FFD25A, #FFA500); border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px; color: #1a1a1a; box-shadow: 0 10px 30px rgba(255, 165, 0, 0.2);">
                <h3 style="font-family: 'Bricolage Grotesque'; font-size: 20px; margin-bottom: 8px;">⭐ Upgrade to CHOZ Pro</h3>
                <p style="font-size: 14px; margin-bottom: 20px; font-weight: 500; opacity: 0.9;">Remove all ads, unlock premium features, and get priority support.</p>
                <a class="btn" href="/get-pro.html" style="padding: 12px 24px; font-size: 15px; background: #1a1a1a; color: white; border: none; font-weight: bold;">Get Pro Now</a>
            </div>
        ` : `
            <div style="background: #dcfce7; border: 1px solid #22c55e; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px; color: #166534;">
                <h3 style="font-family: 'Bricolage Grotesque'; font-size: 20px; margin-bottom: 8px;">👑 You are a Pro Member</h3>
                <p style="font-size: 14px; margin-bottom: 0; font-weight: 500;">Enjoy an ad-free experience and premium features.</p>
            </div>
        `}
    `;

    // Avatar Upload Logic
    setTimeout(() => {
        try {
            const avatarUpload = document.getElementById('avatarUpload');
            if (avatarUpload) {
                avatarUpload.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    const { data: { session } } = await sb.auth.getSession();
                    if (!session) return;
                    
                    const fileExt = file.name.split('.').pop();
                    const fileName = session.user.id + '-' + Date.now() + '.' + fileExt;
                    
                    const { error } = await sb.storage.from('avatars').upload(fileName, file);
                    if (error) { alert('Upload error: ' + error.message); return; }
                    
                    const { data: urlData } = sb.storage.from('avatars').getPublicUrl(fileName);
                    await sb.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', session.user.id);
                    
                    const avatarEl = document.getElementById('profileAvatar');
                    if (avatarEl) {
                        avatarEl.innerHTML = '<img src="' + urlData.publicUrl + '" style="width:100%;height:100%;object-fit:cover;">';
                    }
                    alert('Profile picture update ho gayi!');
                });
            }
        } catch(e) {
            console.log("Mobile upload error:", e);
        }
    }, 100);
}

// ============================================================
// BAQI TABS (History, Memories, Favorites, etc.)
// ============================================================
async function loadHistory(content) {
    const { data } = await sb.from('comparisons').select('*, categories(name)').eq('user_id', currentUser.id).order('created_at', { ascending: false });
    if (!data || data.length === 0) { content.innerHTML = '<div class="empty"><h3>No history</h3><p>Your comparisons will appear here.</p></div>'; return; }
    content.innerHTML = data.map(c => '<div class="list-item"><div><h4>' + (c.categories ? c.categories.name : 'Comparison') + '</h4><p class="meta">Status: ' + (c.status || 'active') + '</p></div><span class="time">' + new Date(c.created_at).toLocaleDateString() + '</span></div>').join('');
}

async function loadMemories(content) {
    const { data } = await sb.from('decision_memories').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
    if (!data || data.length === 0) { content.innerHTML = '<div class="empty"><h3>No memories</h3><p>Your saved decisions will appear here.</p></div>'; return; }
    content.innerHTML = data.map(m => '<div class="list-item"><div><h4>📌 ' + (m.title || 'Decision') + '</h4><p class="meta">' + (m.note || '') + '</p></div><span class="time">' + new Date(m.created_at).toLocaleDateString() + '</span></div>').join('');
}

async function loadFavorites(content) {
    const { data } = await sb.from('favorites').select('*, items(name)').eq('user_id', currentUser.id);
    if (!data || data.length === 0) { content.innerHTML = '<div class="empty"><h3>No favorites</h3><p>Items you favorite will appear here.</p></div>'; return; }
    content.innerHTML = data.map(f => '<div class="list-item"><div><h4>' + (f.items ? f.items.name : 'Item') + '</h4></div></div>').join('');
}

async function loadMyReviews(content) {
    const { data } = await sb.from('user_reviews').select('*, items(name)').eq('user_id', currentUser.id);
    if (!data || data.length === 0) { content.innerHTML = '<div class="empty"><h3>No reviews</h3><p>Your reviews will appear here.</p></div>'; return; }
    content.innerHTML = data.map(r => '<div class="list-item"><div><h4>' + (r.items ? r.items.name : 'Item') + '</h4><p class="meta">' + '★'.repeat(r.rating) + '</p></div></div>').join('');
}

async function loadSavedComparisons(content) {
    const { data } = await sb.from('saved_comparisons').select('*').eq('user_id', currentUser.id);
    if (!data || data.length === 0) { content.innerHTML = '<div class="empty"><h3>No saved comparisons</h3></div>'; return; }
    content.innerHTML = data.map(s => '<div class="list-item"><div><h4>🔖 ' + (s.item_name || 'Saved') + '</h4></div></div>').join('');
}

// ============================================================
// SETTINGS (Profile Update & Password Change)
// ============================================================
async function loadSettings(content) {
    content.innerHTML = '<div class="loading">Loading...</div>';
    const { data: userProfile } = await sb.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
    
    content.innerHTML = `
        <div style="background:var(--sf);border:1px solid var(--line);border-radius:16px;padding:24px;margin-bottom:16px">
            <h3 style="font-family:'Bricolage Grotesque';font-size:18px;margin-bottom:16px">Edit Profile</h3>
            <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px">Display Name</label>
            <input type="text" id="editName" value="${userProfile && userProfile.full_name ? userProfile.full_name : ''}" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);margin-bottom:16px">
            
            <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px">Bio (optional)</label>
            <textarea id="editBio" rows="2" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);margin-bottom:16px">${userProfile && userProfile.bio ? userProfile.bio : ''}</textarea>
            
            <button class="btn p" id="saveProfileBtn">Save Changes</button>
        </div>
        <div style="background:var(--sf);border:1px solid var(--line);border-radius:16px;padding:24px">
            <h3 style="font-family:'Bricolage Grotesque';font-size:18px;margin-bottom:16px">Account</h3>
            <p style="font-size:14px;margin-bottom:12px"><strong>Email:</strong> ${currentUser.email}</p>
            <button class="btn" onclick="alert('Password reset link bhejne ke liye Forgot Password use karein.')">Change Password</button>
        </div>
    `;

    document.getElementById('saveProfileBtn').onclick = async () => {
        const name = document.getElementById('editName').value;
        const bio = document.getElementById('editBio').value;
        await sb.from('profiles').update({ full_name: name, bio: bio }).eq('id', currentUser.id);
        alert('Profile saved!');
    };
}

// ============================================================
// CHOICE PROFILE
// ============================================================
async function loadChoiceProfile(content) {
    content.innerHTML = '<div class="loading">Loading...</div>';
    const { data: memories } = await sb.from('decision_memories').select('*').eq('user_id', currentUser.id);
    if (!memories || memories.length < 2) {
        content.innerHTML = '<div class="empty"><h3>Not enough data</h3><p>Complete 2 comparisons to see your profile.</p></div>';
        return;
    }
    content.innerHTML = '<div style="background:var(--sf);border:1px solid var(--line);border-radius:16px;padding:24px"><h3>Your Profile</h3><p>You have saved ' + memories.length + ' decisions.</p></div>';
}

// ============================================================
// CHOZ PULSE
// ============================================================
async function loadPulseDashboard(content) {
    content.innerHTML = '<div class="loading">Loading...</div>';
    const { data: trends } = await sb.from('pulse_category_trends').select('*').limit(5);
    if (!trends || trends.length === 0) {
        content.innerHTML = '<div class="empty"><h3>No trends yet</h3><p>Community data will appear here soon.</p></div>';
        return;
    }
    content.innerHTML = '<div style="background:var(--sf);border:1px solid var(--line);border-radius:16px;padding:24px"><h3>CHOZ Pulse</h3><p>Trends are loading...</p></div>';
}

// ============================================================
// THEME TOGGLE & SIGN OUT
// ============================================================
const themeBtn = document.getElementById('themeBtn');
if (themeBtn) {
    themeBtn.onclick = () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
        localStorage.setItem('choz-theme', isDark ? 'light' : 'dark');
    };
}

const signOutBtn = document.getElementById('signOutBtn');
if (signOutBtn) {
    signOutBtn.onclick = async () => {
        await sb.auth.signOut();
        window.location.href = '/';
    };
}

// ============================================================
// ADMIN PORTAL BUTTON VISIBILITY
// ============================================================
async function checkAdminAndShowButton() {
    setTimeout(async () => {
        try {
            const { data: { session } } = await sb.auth.getSession();
            if (!session) return;

            const { data: adminData } = await sb
                .from('admin_users')
                .select('role')
                .eq('user_id', session.user.id)
                .maybeSingle();

            if (adminData) {
                const adminBtn = document.getElementById('adminPortalBtn');
                if (adminBtn) {
                    adminBtn.style.display = 'inline-flex';
                }
            }
        } catch (err) {
            console.error('Admin check error:', err);
        }
    }, 1000);
}

document.addEventListener('DOMContentLoaded', checkAdminAndShowButton);

// ============================================================
// START
// ============================================================
init();
