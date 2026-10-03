// ============================================================
// CHOZ GLOBAL SEARCH
// ============================================================

const RECENT_KEY = 'choz-recent-searches';
const MAX_RECENT = 5;

let searchDebounceTimer = null;
let searchResultsCache = {};

// Open search modal
function openSearch() {
    const modal = document.getElementById('searchModal');
    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('searchInput')?.focus(), 50);
    renderEmptyState();
}

function closeSearch() {
    document.getElementById('searchModal').classList.add('hidden');
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').innerHTML = '';
}

// Empty state — show recent searches
function renderEmptyState() {
    const results = document.getElementById('searchResults');
    const recent = getRecentSearches();

    if (recent.length === 0) {
        results.innerHTML = `
            <p style="text-align:center;color:var(--mute);font-size:13px;padding:40px 20px">
                Type to search products, brands, categories...
            </p>
        `;
        return;
    }

    results.innerHTML = `
        <div style="padding:8px 12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <span style="font-size:11px;font-weight:600;color:var(--mute);text-transform:uppercase;letter-spacing:0.5px">Recent</span>
                <button onclick="clearRecentSearches()" style="background:none;border:none;font-size:11px;color:var(--ac);cursor:pointer">Clear</button>
            </div>
            ${recent.map(q => `
                <div onclick="performSearch('${q.replace(/'/g, "\\'")}')"
                     style="padding:10px 12px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:14px;color:var(--ink)"
                     onmouseover="this.style.background='var(--bg-alt)'" onmouseout="this.style.background='transparent'">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--mute)" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    ${escapeHtml(q)}
                </div>
            `).join('')}
        </div>
    `;
}

// Handle input
function onSearchInput(e) {
    const q = e.target.value.trim();

    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);

    if (q.length < 2) {
        renderEmptyState();
        return;
    }

    document.getElementById('searchResults').innerHTML = `
        <div style="text-align:center;padding:40px;color:var(--mute);font-size:13px">Searching...</div>
    `;

    searchDebounceTimer = setTimeout(() => performSearch(q), 250);
}

// Perform search
async function performSearch(query) {
    const q = query.trim();
    if (!q) return;

    document.getElementById('searchInput').value = q;

    const results = document.getElementById('searchResults');
    results.innerHTML = `
        <div style="text-align:center;padding:40px;color:var(--mute);font-size:13px">Searching...</div>
    `;

    try {
        // Parallel search across tables
        const [cats, items, brands] = await Promise.all([
            sb.from('categories')
                .select('id, name, slug, icon')
                .eq('is_active', true)
                .ilike('name', `%${q}%`)
                .limit(5),
            sb.from('items')
                .select('id, name, base_price, currency, category_id, brands(name)')
                .eq('is_active', true)
                .ilike('name', `%${q}%`)
                .limit(8),
            sb.from('brands')
                .select('id, name, slug')
                .eq('is_active', true)
                .ilike('name', `%${q}%`)
                .limit(5)
        ]);

        const categories = cats.data || [];
        const products = items.data || [];
        const brandList = brands.data || [];

        const total = categories.length + products.length + brandList.length;

        if (total === 0) {
            results.innerHTML = `
                <div style="text-align:center;padding:40px 20px">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--mute)" stroke-width="1.5" style="opacity:0.4;margin-bottom:12px">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                    <p style="color:var(--ink);font-weight:500;margin-bottom:4px">No results for "${escapeHtml(q)}"</p>
                    <p style="color:var(--mute);font-size:13px">Try a different word</p>
                </div>
            `;
            return;
        }

        saveRecentSearch(q);

        let html = '';

        if (categories.length > 0) {
            html += `
                <div style="padding:8px 12px">
                    <div style="font-size:11px;font-weight:600;color:var(--mute);text-transform:uppercase;letter-spacing:0.5px;padding:6px 0">Categories</div>
                    ${categories.map(c => `
                        <div onclick="goToCategory('${c.id}')" class="search-item"
                             style="padding:10px 12px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:12px;font-size:14px"
                             onmouseover="this.style.background='var(--bg-alt)'" onmouseout="this.style.background='transparent'">
                            <span style="font-size:20px">${c.icon || '📦'}</span>
                            <span style="font-weight:500">${escapeHtml(c.name)}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if (products.length > 0) {
            html += `
                <div style="padding:8px 12px">
                    <div style="font-size:11px;font-weight:600;color:var(--mute);text-transform:uppercase;letter-spacing:0.5px;padding:6px 0">Products</div>
                    ${products.map(p => `
                        <div onclick="goToProduct('${p.id}')" class="search-item"
                             style="padding:10px 12px;border-radius:8px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-size:14px"
                             onmouseover="this.style.background='var(--bg-alt)'" onmouseout="this.style.background='transparent'">
                            <div>
                                <div style="font-weight:500">${escapeHtml(p.name)}</div>
                                ${p.brands?.name ? `<div style="font-size:12px;color:var(--mute)">${escapeHtml(p.brands.name)}</div>` : ''}
                            </div>
                            ${p.base_price ? `<span style="font-size:12px;color:var(--mute)">${p.currency} ${p.base_price.toLocaleString()}</span>` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if (brandList.length > 0) {
            html += `
                <div style="padding:8px 12px">
                    <div style="font-size:11px;font-weight:600;color:var(--mute);text-transform:uppercase;letter-spacing:0.5px;padding:6px 0">Brands</div>
                    ${brandList.map(b => `
                        <div onclick="goToBrand('${b.slug}')" class="search-item"
                             style="padding:10px 12px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:12px;font-size:14px"
                             onmouseover="this.style.background='var(--bg-alt)'" onmouseout="this.style.background='transparent'">
                            <span style="font-weight:500">${escapeHtml(b.name)}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        results.innerHTML = html;

    } catch (err) {
        console.error('Search error:', err);
        results.innerHTML = `
            <div style="text-align:center;padding:40px 20px;color:#ef4444;font-size:13px">
                Search failed. Please try again.
            </div>
        `;
    }
}

// Navigate actions
function goToCategory(categoryId) {
    closeSearch();
    if (typeof startComparison === 'function') {
        startComparison(categoryId);
    } else {
        window.location.href = '/#cats';
    }
}

function goToProduct(itemId) {
    closeSearch();
    // Store selection and go to home, then trigger reveal
    sessionStorage.setItem('choz-selected-item', itemId);
    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        if (typeof startComparison !== 'function') {
            window.location.href = '/#cats';
        }
    } else {
        window.location.href = '/#cats';
    }
}

function goToBrand(slug) {
    closeSearch();
    window.location.href = `/?brand=${encodeURIComponent(slug)}`;
}

// Recent searches storage
function getRecentSearches() {
    try {
        const raw = localStorage.getItem(RECENT_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function saveRecentSearch(q) {
    try {
        let recent = getRecentSearches().filter(x => x.toLowerCase() !== q.toLowerCase());
        recent.unshift(q);
        recent = recent.slice(0, MAX_RECENT);
        localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    } catch {}
}

function clearRecentSearches() {
    try { localStorage.removeItem(RECENT_KEY); } catch {}
    renderEmptyState();
}

// Escape HTML
function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('searchBtn');
    const searchModal = document.getElementById('searchModal');
    const searchInput = document.getElementById('searchInput');

    if (searchBtn) searchBtn.addEventListener('click', openSearch);
    if (searchModal) {
        searchModal.addEventListener('click', (e) => {
            if (e.target.id === 'searchModal') closeSearch();
        });
    }
    if (searchInput) searchInput.addEventListener('input', onSearchInput);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // "/" opens search (unless typing in input/textarea)
        if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            e.preventDefault();
            openSearch();
        }
        // ESC closes search
        if (e.key === 'Escape' && !document.getElementById('searchModal').classList.contains('hidden')) {
            closeSearch();
        }
    });
});
