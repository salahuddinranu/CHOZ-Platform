// ============================================================
// CHOZ BLIND COMPARISON ENGINE — Priority Aware
// ============================================================

let currentComparison = {
    categoryId: null,
    options: [],
    labels: [],
    priorities: [],
    choice: null,
    step: 'select' // 'select' | 'priorities' | 'revealed'
};

async function startComparison(categoryId) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { openAuth(); return; }

    currentComparison.categoryId = categoryId;
    currentComparison.step = 'select';
    currentComparison.choice = null;

    const { data: items, error } = await sb
        .from('items')
        .select('*, brands(name), item_attributes(*, attribute_definitions(id, name, slug, unit, is_priority_eligible))')
        .eq('category_id', categoryId)
        .eq('is_active', true);

    if (error || !items || items.length < 2) {
        alert('Not enough items in this category yet.');
        return;
    }

    // Filter items that have at least 2 attributes
    const validItems = items.filter(i => (i.item_attributes || []).length >= 2);
    if (validItems.length < 2) {
        alert('Not enough items with complete data in this category.');
        return;
    }

    const shuffled = [...validItems].sort(() => Math.random() - 0.5).slice(0, 3);
    currentComparison.options = shuffled;
    currentComparison.labels = ['A', 'B', 'C'].slice(0, shuffled.length);

    renderComparisonModal();
}

function renderComparisonModal() {
    const modal = document.getElementById('compModal');
    const content = document.getElementById('compContent');
    const { options, labels } = currentComparison;

    content.innerHTML = `
        <div class="comp-header">
            <h3 style="font-family:'Bricolage Grotesque';font-size:22px">Blind Comparison</h3>
            <span class="badge">Step 1 of 2: Pick an option</span>
        </div>
        <p style="color:var(--mute);font-size:14px;margin-bottom:16px">
            Brand names are hidden. Review the specs and pick the option that feels right.
        </p>
        <div class="options-grid" id="optionsGrid">
            ${options.map((item, i) => {
                const attrs = (item.item_attributes || []).slice(0, 6);
                return `
                    <div class="option-card" data-idx="${i}" onclick="selectOption(${i})">
                        <h3>Option ${labels[i]}</h3>
                        ${attrs.map(a => `
                            <div class="attr-row">
                                <span class="label">${a.attribute_definitions?.name || ''}</span>
                                <span class="value">${a.value || a.numeric_value || '—'}${a.attribute_definitions?.unit ? ' ' + a.attribute_definitions.unit : ''}</span>
                            </div>
                        `).join('') || '<p style="color:var(--mute);font-size:13px">No attributes</p>'}
                    </div>
                `;
            }).join('')}
        </div>
        <button class="btn p" style="width:100%;padding:14px" id="lockBtn" onclick="goToPriorities()" disabled>
            Select an option first
        </button>
    `;
    modal.classList.remove('hidden');
}

function selectOption(idx) {
    currentComparison.choice = idx;
    document.querySelectorAll('.option-card').forEach((el, i) => {
        el.classList.toggle('selected', i === idx);
    });
    const lockBtn = document.getElementById('lockBtn');
    lockBtn.disabled = false;
    lockBtn.textContent = 'Next: Set Your Priorities →';
}

function goToPriorities() {
    if (currentComparison.choice === null) return;
    currentComparison.step = 'priorities';
    renderPrioritiesStep();
}

function renderPrioritiesStep() {
    const content = document.getElementById('compContent');
    const chosenItem = currentComparison.options[currentComparison.choice];

    // Collect all unique attributes from all options
    const allAttrs = new Map();
    currentComparison.options.forEach(item => {
        (item.item_attributes || []).forEach(a => {
            if (a.attribute_definitions && !allAttrs.has(a.attribute_definitions.id)) {
                allAttrs.set(a.attribute_definitions.id, a.attribute_definitions);
            }
        });
    });

    const attrsArray = [...allAttrs.values()];
    // Initialize priorities with all attributes
    currentComparison.priorities = attrsArray.map(a => a.id);

    content.innerHTML = `
        <div class="comp-header">
            <h3 style="font-family:'Bricolage Grotesque';font-size:22px">Your Priorities</h3>
            <span class="badge">Step 2 of 2: Rank what matters</span>
        </div>
        <p style="color:var(--mute);font-size:14px;margin-bottom:8px">
            Drag to reorder. Top = most important to you.
        </p>
        <p style="color:var(--mute);font-size:12px;margin-bottom:16px">
            <em>Tip: Click the ↑ ↓ buttons to move items.</em>
        </p>
        <div class="priority-list" id="priorityList">
            ${attrsArray.map((a, i) => `
                <div class="priority-item" draggable="true" data-attr-id="${a.id}" data-idx="${i}">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span class="rank">${i + 1}</span>
                        <span>${a.name}${a.unit ? ' (' + a.unit + ')' : ''}</span>
                    </div>
                    <div style="display:flex;gap:4px;">
                        <button class="btn" style="padding:4px 10px;font-size:12px;" onclick="movePriority(${i}, -1)">↑</button>
                        <button class="btn" style="padding:4px 10px;font-size:12px;" onclick="movePriority(${i}, 1)">↓</button>
                    </div>
                </div>
            `).join('')}
        </div>
        <button class="btn p" style="width:100%;padding:14px" onclick="lockChoice()">
            🔒 Lock Choice & Reveal
        </button>
        <button class="btn" style="width:100%;margin-top:8px;" onclick="backToSelect()">
            ← Back to options
        </button>
    `;

    setupDragAndDrop();
}

function setupDragAndDrop() {
    const list = document.getElementById('priorityList');
    if (!list) return;
    let dragged = null;

    list.querySelectorAll('.priority-item').forEach(item => {
        item.addEventListener('dragstart', e => {
            dragged = item;
            item.style.opacity = '0.5';
        });
        item.addEventListener('dragend', () => {
            item.style.opacity = '1';
            updateRanks();
        });
        item.addEventListener('dragover', e => e.preventDefault());
        item.addEventListener('drop', e => {
            e.preventDefault();
            if (!dragged || dragged === item) return;
            const items = [...list.children];
            const fromIdx = items.indexOf(dragged);
            const toIdx = items.indexOf(item);
            if (fromIdx < toIdx) item.after(dragged);
            else item.before(dragged);
        });
    });
}

function updateRanks() {
    const items = document.querySelectorAll('#priorityList .priority-item');
    items.forEach((el, i) => {
        el.querySelector('.rank').textContent = i + 1;
        el.dataset.idx = i;
    });
    currentComparison.priorities = [...items].map(el => el.dataset.attrId);
}

function movePriority(idx, dir) {
    const list = document.getElementById('priorityList');
    const items = [...list.children];
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    if (dir === -1) items[target].before(items[idx]);
    else items[target].after(items[idx]);
    updateRanks();
}

function backToSelect() {
    currentComparison.step = 'select';
    renderComparisonModal();
    // Re-highlight previous choice
    if (currentComparison.choice !== null) {
        const cards = document.querySelectorAll('.option-card');
        if (cards[currentComparison.choice]) cards[currentComparison.choice].classList.add('selected');
        const lockBtn = document.getElementById('lockBtn');
        if (lockBtn) { lockBtn.disabled = false; lockBtn.textContent = 'Next: Set Your Priorities →'; }
    }
}

async function lockChoice() {
    if (currentComparison.choice === null) return;

    updateRanks();
    const chosenIdx = currentComparison.choice;
    const chosenItem = currentComparison.options[chosenIdx];
    const chosenLabel = currentComparison.labels[chosenIdx];

    // Fetch full details
    const { data: fullItem } = await sb
        .from('items')
        .select('*, brands(*), item_attributes(*, attribute_definitions(*))')
        .eq('id', chosenItem.id)
        .single();

    // Save comparison record
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
        await sb.from('comparisons').insert({
            user_id: session.user.id,
            category_id: currentComparison.categoryId,
            title: 'Blind Comparison',
            status: 'completed',
            completed_at: new Date().toISOString()
        });
    }

    currentComparison.step = 'revealed';
    renderReveal(fullItem, chosenLabel);
}

function renderReveal(item, label) {
    const content = document.getElementById('compContent');
    const attrs = item.item_attributes || [];
    const priorities = currentComparison.priorities || [];

    // Build priority explanation
    const priorityExplanations = priorities.slice(0, 5).map((attrId, idx) => {
        const attr = attrs.find(a => a.attribute_definitions?.id === attrId);
        if (!attr) return null;
        return {
            rank: idx + 1,
            name: attr.attribute_definitions?.name || 'Unknown',
            value: `${attr.value || attr.numeric_value || '—'}${attr.attribute_definitions?.unit ? ' ' + attr.attribute_definitions.unit : ''}`
        };
    }).filter(Boolean);

    content.innerHTML = `
        <div class="reveal-card">
            <h2>🎉 Revealed</h2>
            <p style="opacity:0.9">You chose Option ${label}</p>
            <div class="item-name">${item.name}</div>
            <div class="brand-name">${item.brands?.name || 'Unknown brand'}</div>
            <div class="price">${item.currency} ${item.base_price?.toLocaleString() || '—'}</div>
        </div>

        <div class="why-section" style="background:var(--acbg);color:var(--ink)">
            <h4 style="font-family:'Bricolage Grotesque';font-size:18px;margin-bottom:12px">Why I Chose This</h4>
            <p style="margin-bottom:12px;font-size:14px">
                You ranked these priorities (top = most important):
            </p>
            ${priorityExplanations.length > 0 ? `
                <ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.8">
                    ${priorityExplanations.map(p => `
                        <li>
                            <strong>${p.name}</strong> 
                            <span style="color:var(--ac);font-weight:600">→ ${p.value}</span>
                        </li>
                    `).join('')}
                </ol>
                <p style="margin-top:14px;font-size:13px;color:var(--mute)">
                    You selected the option that felt right for these priorities. 
                    Brand names were hidden during your decision.
                </p>
            ` : `
                <p style="font-size:14px">You selected this option from ${currentComparison.options.length} anonymous choices.</p>
            `}
        </div>

       <div class="reveal-actions">
    <button class="btn p" onclick="saveDecision('${item.id}')">💾 Save to Memory</button>
    <button class="btn" onclick="shareResult()">🔗 Share</button>
    <button class="btn" onclick="showWhereToBuy('${item.id}', \`${item.name.replace(/`/g, '\\`')}\`, '${currentComparison.categoryId}')">🛒 Where to Buy</button>
    <button class="btn" onclick="closeCompModal()">Close</button>
</div>
<div id="buySection" style="margin-top:20px"></div>
<div id="buySection" style="margin-top:20px"></div>
    `;
}

async function saveDecision(itemId) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { openAuth(); return; }

    const item = currentComparison.options[currentComparison.choice];

    const { error } = await sb.from('decision_memories').insert({
        user_id: session.user.id,
        category_id: currentComparison.categoryId,
        chosen_item_id: itemId,
        title: `I chose ${item.name}`,
        note: '',
        priorities: currentComparison.priorities || []
    });

    if (error) {
        alert('Could not save: ' + error.message);
        return;
    }

    // Button feedback
    const btn = event.target;
    btn.textContent = '✅ Saved!';
    btn.disabled = true;
    setTimeout(() => {
        btn.textContent = '💾 Save to Memory';
        btn.disabled = false;
    }, 2000);
}

function shareResult() {
    const item = currentComparison.options[currentComparison.choice];
    const shareText = `I just chose "${item.name}" on CHOZ — blind comparison, real priorities. Choose without the noise.`;
    const shareUrl = window.location.origin;

    if (navigator.share) {
        navigator.share({
            title: 'My CHOZ Decision',
            text: shareText,
            url: shareUrl
        }).catch(() => {});
    } else {
        navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        alert('Copied to clipboard!');
    }
}

function closeCompModal() {
    document.getElementById('compModal').classList.add('hidden');
    currentComparison = {
        categoryId: null, options: [], labels: [],
        priorities: [], choice: null, step: 'select'
    };
}

// Categories loading
async function loadCategories() {
    const grid = document.getElementById('catGrid');
    if (!grid) return;

    const { data: cats, error } = await sb
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

    if (error || !cats || cats.length === 0) {
        grid.innerHTML = '<p style="color:var(--mute)">No categories available.</p>';
        return;
    }

    grid.innerHTML = cats.map(c => `
        <a onclick="startComparison('${c.id}')">
            <span class="icon">${c.icon || '📦'}</span>
            <b>${c.name}</b>
            <small>${c.description || 'Compare options'}</small>
        </a>
    `).join('');
}

// Modal close handlers
document.addEventListener('DOMContentLoaded', () => {
    const compModal = document.getElementById('compModal');
    const closeComp = document.getElementById('closeComp');
    if (closeComp) closeComp.onclick = closeCompModal;
    if (compModal) compModal.addEventListener('click', (e) => {
        if (e.target.id === 'compModal') closeCompModal();
    });
});
// ============================================================
// WHERE TO BUY — Affiliate links with click tracking
// ============================================================
async function showWhereToBuy(itemId, itemName) {
    const section = document.getElementById('buySection');
    section.innerHTML = '<p style="text-align:center;color:var(--mute);font-size:14px;padding:16px">Loading buy options...</p>';

    const { data: links } = await sb
        .from('affiliate_links')
        .select('*')
        .eq('item_id', itemId)
        .eq('is_active', true)
        .order('created_at');

    let html = `
        <div style="background:var(--sf);border:1px solid var(--line);border-radius:14px;padding:20px">
            <h4 style="font-family:'Bricolage Grotesque';font-size:17px;margin-bottom:12px">🛒 Where to Buy</h4>
    `;

    if (links && links.length > 0) {
        // Admin-configured affiliate links
        html += `<p style="color:var(--mute);font-size:13px;margin-bottom:14px">
            These links are managed by CHOZ. We may earn a commission when you buy through them — this never affects your comparison result.
        </p>`;
        html += `<div style="display:flex;flex-direction:column;gap:8px">`;
        links.forEach(l => {
            const safeLabel = (l.label || l.provider || 'Open store').replace(/'/g, "\\'");
            html += `
                <a href="${l.url}" target="_blank" rel="noopener noreferrer nofollow sponsored"
                   onclick="trackAffiliateClick('${l.id}', '${itemId}')"
                   style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:var(--acbg);color:var(--ink);border-radius:10px;text-decoration:none;font-weight:500">
                    <span>${safeLabel}</span>
                    <span style="color:var(--ac);font-size:13px">Visit →</span>
                </a>
            `;
        });
        html += `</div>`;
    } else {
        // Fallback search links (no affiliate — just helps user find it)
        const q = encodeURIComponent(itemName);
        const searchLinks = [
            { name: 'Search on Daraz', url: `https://www.daraz.pk/catalog/?q=${q}`, icon: '🛍️' },
            { name: 'Search on OLX', url: `https://www.olx.com.pk/items/q-${q}`, icon: '📦' },
            { name: 'Search on Google Shopping', url: `https://www.google.com/search?tbm=shop&q=${q}`, icon: '🔍' }
        ];
        html += `<p style="color:var(--mute);font-size:13px;margin-bottom:14px">
            No purchase links are configured for this product yet. You can search on trusted platforms:
        </p>`;
        html += `<div style="display:flex;flex-direction:column;gap:8px">`;
        searchLinks.forEach(l => {
            html += `
                <a href="${l.url}" target="_blank" rel="noopener noreferrer"
                   style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:var(--sf);border:1px solid var(--line);color:var(--ink);border-radius:10px;text-decoration:none;font-weight:500">
                    <span>${l.icon} ${l.name}</span>
                    <span style="color:var(--ac);font-size:13px">Open →</span>
                </a>
            `;
        });
        html += `</div>`;
        html += `<p style="color:var(--mute);font-size:12px;margin-top:14px;font-style:italic">
            CHOZ does not sell products directly. These open search results on external platforms.
        </p>`;
    }

    html += `</div>`;
    section.innerHTML = html;
}

// Track affiliate click (for admin analytics)
async function trackAffiliateClick(linkId, itemId) {
    try {
        const { data: { session } } = await sb.auth.getSession();
        await sb.from('analytics_events').insert({
            event_type: 'affiliate_click',
            user_id: session?.user?.id || null,
            metadata: { link_id: linkId, item_id: itemId }
        });
    } catch (e) {
        // Silent fail — analytics should never break UX
    }
}
// ============================================================
// WHERE TO BUY — Admin links + Category-aware search fallback
// ============================================================

// Category-wise search providers
const SEARCH_PROVIDERS = {
    'cat-phone': [
        { name: 'Daraz', icon: '🛍️', url: q => `https://www.daraz.pk/catalog/?q=${q}` },
        { name: 'PriceOye', icon: '💰', url: q => `https://priceoye.pk/search?q=${q}` },
        { name: 'Mega.pk', icon: '🏬', url: q => `https://www.mega.pk/search/?q=${q}` },
        { name: 'OLX Pakistan', icon: '📦', url: q => `https://www.olx.com.pk/items/q-${q.replace(/%20/g, '-')}` },
        { name: 'WhatMobile', icon: '📱', url: q => `https://www.whatmobile.com.pk/search?q=${q}` },
        { name: 'Google Shopping', icon: '🔍', url: q => `https://www.google.com/search?tbm=shop&q=${q}` }
    ],
    'cat-laptop': [
        { name: 'Daraz', icon: '🛍️', url: q => `https://www.daraz.pk/catalog/?q=${q}` },
        { name: 'Mega.pk', icon: '🏬', url: q => `https://www.mega.pk/search/?q=${q}` },
        { name: 'OLX Pakistan', icon: '📦', url: q => `https://www.olx.com.pk/items/q-${q.replace(/%20/g, '-')}` },
        { name: 'Google Shopping', icon: '🔍', url: q => `https://www.google.com/search?tbm=shop&q=${q}` }
    ],
    'cat-headphone': [
        { name: 'Daraz', icon: '🛍️', url: q => `https://www.daraz.pk/catalog/?q=${q}` },
        { name: 'Mega.pk', icon: '🏬', url: q => `https://www.mega.pk/search/?q=${q}` },
        { name: 'Amazon', icon: '📦', url: q => `https://www.amazon.com/s?k=${q}` },
        { name: 'Google Shopping', icon: '🔍', url: q => `https://www.google.com/search?tbm=shop&q=${q}` }
    ],
    'cat-bike': [
        { name: 'OLX Pakistan', icon: '📦', url: q => `https://www.olx.com.pk/items/q-${q.replace(/%20/g, '-')}` },
        { name: 'PakWheels', icon: '🏍️', url: q => `https://www.pakwheels.com/used-bikes/search/all/${q.replace(/%20/g, '-')}` },
        { name: 'Daraz', icon: '🛍️', url: q => `https://www.daraz.pk/catalog/?q=${q}` },
        { name: 'Google', icon: '🔍', url: q => `https://www.google.com/search?q=${q}` }
    ],
    'cat-car': [
        { name: 'OLX Pakistan', icon: '📦', url: q => `https://www.olx.com.pk/items/q-${q.replace(/%20/g, '-')}` },
        { name: 'PakWheels', icon: '🚗', url: q => `https://www.pakwheels.com/used-cars/search/-/${q.replace(/%20/g, '-')}` },
        { name: 'Daraz', icon: '🛍️', url: q => `https://www.daraz.pk/catalog/?q=${q}` },
        { name: 'Google', icon: '🔍', url: q => `https://www.google.com/search?q=${q}` }
    ],
    'cat-hotel': [
        { name: 'Booking.com', icon: '🏨', url: q => `https://www.booking.com/searchresults.html?ss=${q}` },
        { name: 'Agoda', icon: '🏨', url: q => `https://www.agoda.com/search?q=${q}` },
        { name: 'Airbnb', icon: '🏠', url: q => `https://www.airbnb.com/s/${q}/homes` },
        { name: 'Trivago', icon: '🔍', url: q => `https://www.trivago.com/en-US/srl?query=${q}` }
    ]
};

async function showWhereToBuy(itemId, itemName, categoryId) {
    const section = document.getElementById('buySection');
    section.innerHTML = '<p style="text-align:center;color:var(--mute);font-size:14px;padding:16px">Loading buy options...</p>';

    // 1. Try admin-configured links
    const { data: adminLinks } = await sb
        .from('affiliate_links')
        .select('*')
        .eq('item_id', itemId)
        .eq('is_active', true)
        .order('created_at');

    let html = `
        <div style="background:var(--sf);border:1px solid var(--line);border-radius:14px;padding:20px">
            <h4 style="font-family:'Bricolage Grotesque';font-size:17px;margin-bottom:6px">🛒 Where to Buy</h4>
            <p style="color:var(--mute);font-size:12px;margin-bottom:16px">
                Find this product on trusted platforms.
            </p>
    `;

    // 2. Show admin links if any
    if (adminLinks && adminLinks.length > 0) {
        html += `<p style="color:var(--mute);font-size:13px;margin-bottom:12px;padding:10px;background:var(--acbg);border-radius:8px">
            ⓘ Some links below are affiliate links. We may earn a commission — this never affects your comparison result.
        </p>`;
        html += `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">`;
        adminLinks.forEach(l => {
            const safeLabel = (l.label || l.provider || 'Open store').replace(/'/g, "\\'");
            html += `
                <a href="${l.url}" target="_blank" rel="noopener noreferrer nofollow sponsored"
                   onclick="trackAffiliateClick('${l.id}', '${itemId}')"
                   style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:var(--acbg);color:var(--ink);border-radius:10px;text-decoration:none;font-weight:500">
                    <span>${safeLabel}</span>
                    <span style="color:var(--ac);font-size:13px">Visit →</span>
                </a>
            `;
        });
        html += `</div>`;
    }

    // 3. Show category-specific search links (always shown as fallback/additional)
    const providers = SEARCH_PROVIDERS[categoryId] || [
        { name: 'Google Shopping', icon: '🔍', url: q => `https://www.google.com/search?tbm=shop&q=${q}` },
        { name: 'Daraz', icon: '🛍️', url: q => `https://www.daraz.pk/catalog/?q=${q}` },
        { name: 'OLX Pakistan', icon: '📦', url: q => `https://www.olx.com.pk/items/q-${q.replace(/%20/g, '-')}` }
    ];

    const q = encodeURIComponent(itemName);
    html += `<div style="display:flex;flex-direction:column;gap:8px">`;
    providers.forEach(p => {
        html += `
            <a href="${p.url(q)}" target="_blank" rel="noopener noreferrer"
               style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:var(--sf);border:1px solid var(--line);color:var(--ink);border-radius:10px;text-decoration:none;font-weight:500">
                <span>${p.icon} Search on ${p.name}</span>
                <span style="color:var(--ac);font-size:13px">Open →</span>
            </a>
        `;
    });
    html += `</div>`;

    html += `<p style="color:var(--mute);font-size:12px;margin-top:14px;font-style:italic;line-height:1.5">
        CHOZ does not sell products directly. These links open search results on external platforms. 
        Prices and availability are shown by those platforms.
    </p>`;

    html += `</div>`;
    section.innerHTML = html;
}

// Track affiliate click
async function trackAffiliateClick(linkId, itemId) {
    try {
        const { data: { session } } = await sb.auth.getSession();
        await sb.from('analytics_events').insert({
            event_type: 'affiliate_click',
            user_id: session?.user?.id || null,
            metadata: { link_id: linkId, item_id: itemId }
        });
    } catch (e) {}
}
