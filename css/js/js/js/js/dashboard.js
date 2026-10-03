// ============================================================
// CHOZ USER DASHBOARD
// ============================================================

function showDashboard() {
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('comparison-flow').classList.add('hidden');
    document.getElementById('reveal-section').classList.add('hidden');
    document.getElementById('dashboard').scrollIntoView({ behavior: 'smooth' });
    loadDashboardTab('overview');
}

document.querySelectorAll('.dashboard-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.dashboard-tabs .tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        loadDashboardTab(tab.dataset.tab);
    });
});

async function loadDashboardTab(tab) {
    const content = document.getElementById('dashboard-content');
    content.innerHTML = '<p>Loading...</p>';

    if (tab === 'overview') {
        const { count: comparisons } = await supabase
            .from('comparisons')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id);
        const { count: memories } = await supabase
            .from('decision_memories')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id);
        content.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card"><h3>${comparisons || 0}</h3><p>Comparisons</p></div>
                <div class="stat-card"><h3>${memories || 0}</h3><p>Decision Memories</p></div>
            </div>
        `;
    } else if (tab === 'history') {
        const { data } = await supabase
            .from('comparisons')
            .select('*, categories(name)')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(20);
        content.innerHTML = data?.length
            ? data.map(c => `
                <div class="history-item">
                    <span>${c.categories?.name || 'Comparison'}</span>
                    <span>${new Date(c.created_at).toLocaleDateString()}</span>
                </div>
            `).join('')
            : '<p>No comparisons yet. Start exploring!</p>';
    } else if (tab === 'memories') {
        const { data } = await supabase
            .from('decision_memories')
            .select('*, categories(name)')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
        content.innerHTML = data?.length
            ? data.map(m => `
                <div class="memory-card">
                    <h4>${m.title || 'Decision'}</h4>
                    <p>${m.note || 'No note'}</p>
                    <small>${new Date(m.created_at).toLocaleDateString()}</small>
                </div>
            `).join('')
            : '<p>No Decision Memories yet.</p>';
    } else if (tab === 'favorites') {
        const { data } = await supabase
            .from('favorites')
            .select('*, items(*)')
            .eq('user_id', currentUser.id);
        content.innerHTML = data?.length
            ? data.map(f => `<div class="favorite-item">${f.items?.name}</div>`).join('')
            : '<p>No favorites yet.</p>';
    } else if (tab === 'profile') {
        content.innerHTML = `
            <div class="profile-form">
                <p>Email: ${currentUser.email}</p>
                <button class="btn btn-outline" onclick="signOut()">Sign Out</button>
                <button class="btn btn-outline" style="color:#ef4444;border-color:#ef4444;" onclick="deleteAccount()">Delete Account</button>
            </div>
        `;
    }
}

async function deleteAccount() {
    if (!confirm('Are you sure? This will delete your account and all data.')) return;
    await supabase.from('profiles').delete().eq('id', currentUser.id);
    await supabase.auth.signOut();
    showToast('Account deleted.', 'info');
    window.location.href = '/';
}
