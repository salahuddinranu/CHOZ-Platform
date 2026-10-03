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
    <button class="btn" onclick="openReviewModal('${item.id}', \`${item.name.replace(/`/g, '\\`')}\`)">⭐ Write Review</button>
    <button class="btn" onclick="shareResult()">🔗 Share</button>
    <button class="btn" onclick="showWhereToBuy('${item.id}', \`${item.name.replace(/`/g, '\\`')}\`, '${currentComparison.categoryId}')">🛒 Where to Buy</button>
    <button class="btn" onclick="closeCompModal()">Close</button>
</div>

<div id="reviewsSection" style="margin-top:20px"></div>
<div id="buySection" style="margin-top:20px"></div>
<div id="buySection" style="margin-top:20px"></div>
    `;
}
// Load reviews for this item
setTimeout(() => loadItemReviews(item.id, item.name), 100);

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

// ============================================================
// SHARE RESULT — Beautiful shareable card
// ============================================================
async function shareResult() {
    const item = currentComparison.options[currentComparison.choice];
    if (!item) return;

    // Fetch full details
    const { data: fullItem } = await sb
        .from('items')
        .select('*, brands(name), categories(name)')
        .eq('id', item.id)
        .single();

    if (!fullItem) {
        alert('Could not load item details.');
        return;
    }

    // Show share modal
    showShareModal(fullItem);
}

function showShareModal(item) {
    const modal = document.getElementById('compModal');
    const content = document.getElementById('compContent');

    const categoryName = item.categories?.name || 'Comparison';
    const brandName = item.brands?.name || 'Unknown brand';
    const price = item.base_price ? `${item.currency} ${item.base_price.toLocaleString()}` : 'Price unavailable';
    const priorities = (currentComparison.priorities || []).slice(0, 5);

    // Get priority names from chosen item's attributes
    const priorityNames = priorities
        .map(pid => item.item_attributes?.find(a => a.attribute_definitions?.id === pid))
        .filter(Boolean)
        .map(a => a.attribute_definitions?.name)
        .filter(Boolean);

    content.innerHTML = `
        <div class="comp-header">
            <h3 style="font-family:'Bricolage Grotesque';font-size:22px">Share Your Decision</h3>
            <button class="modal-close" style="position:static;font-size:20px" onclick="closeCompModal()">×</button>
        </div>

        <!-- Preview Card -->
        <div id="sharePreview" style="
            background: linear-gradient(135deg, #3A3FD9 0%, #7C3AED 100%);
            border-radius: 20px;
            padding: 32px;
            color: white;
            text-align: center;
            margin: 20px 0;
            box-shadow: 0 20px 60px rgba(58,63,217,0.3);
        ">
            <div style="font-family:'Bricolage Grotesque';font-size:14px;letter-spacing:3px;opacity:0.85;margin-bottom:20px">
                CHOZ
            </div>
            <div style="font-family:'Bricolage Grotesque';font-size:28px;font-weight:700;line-height:1.2;margin-bottom:8px">
                I chose this.
            </div>
            <div style="font-size:13px;opacity:0.8;margin-bottom:24px">
                Choose without the noise.
            </div>

            <div style="background:rgba(255,255,255,0.15);border-radius:14px;padding:20px;margin-bottom:20px;backdrop-filter:blur(10px)">
                <div style="font-size:11px;letter-spacing:2px;opacity:0.7;text-transform:uppercase;margin-bottom:8px">
                    ${escapeHtml(categoryName)}
                </div>
                <div style="font-size:20px;font-family:'Bricolage Grotesque';font-weight:700;margin-bottom:4px">
                    ${escapeHtml(item.name)}
                </div>
                <div style="font-size:13px;opacity:0.85;margin-bottom:8px">
                    ${escapeHtml(brandName)}
                </div>
                <div style="font-size:16px;font-weight:600">
                    ${price}
                </div>
            </div>

            ${priorityNames.length > 0 ? `
                <div style="margin-bottom:20px">
                    <div style="font-size:11px;letter-spacing:2px;opacity:0.7;text-transform:uppercase;margin-bottom:10px">
                        My priorities were
                    </div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center">
                        ${priorityNames.map(p => `
                            <span style="
                                background:rgba(255,255,255,0.2);
                                padding:6px 12px;
                                border-radius:20px;
                                font-size:12px;
                                font-weight:500;
                            ">${escapeHtml(p)}</span>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <div style="font-size:11px;opacity:0.6;margin-top:24px">
                choz-platform.pages.dev
            </div>
        </div>

        <!-- Actions -->
        <div style="display:flex;flex-direction:column;gap:10px">
            <button class="btn p" style="width:100%;padding:14px" onclick="downloadShareCard('${item.id}')">
                📥 Download Card (PNG)
            </button>
            <button class="btn" style="width:100%;padding:14px" onclick="shareNative('${item.id}')">
                📱 Share via Device
            </button>
            <button class="btn" style="width:100%;padding:14px" onclick="copyShareText('${item.id}')">
                📋 Copy Text
            </button>
            <button class="btn" style="width:100%;padding:14px" onclick="closeCompModal()">
                Close
            </button>
        </div>

        <p style="font-size:11px;color:var(--mute);text-align:center;margin-top:16px">
            Your share card shows no personal data.
        </p>
    `;
}

// Download share card as PNG (canvas generated)
async function downloadShareCard(itemId) {
    const item = currentComparison.options[currentComparison.choice];
    const { data: fullItem } = await sb
        .from('items')
        .select('*, brands(name), categories(name), item_attributes(*, attribute_definitions(name, id))')
        .eq('id', itemId)
        .single();

    if (!fullItem) { alert('Load failed'); return; }

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 1080, 1350);
    grad.addColorStop(0, '#3A3FD9');
    grad.addColorStop(1, '#7C3AED');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1350);

    // CHOZ logo text
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 42px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('CHOZ', 540, 130);

    // Tagline
    ctx.font = '22px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('Choose without the noise.', 540, 175);

    // "I chose this"
    ctx.font = 'bold 72px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('I chose this.', 540, 320);

    // White card
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(ctx, 90, 420, 900, 360, 32);
    ctx.fill();

    // Category
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText((fullItem.categories?.name || 'Comparison').toUpperCase(), 540, 500);

    // Product name
    ctx.font = 'bold 48px Arial';
    ctx.fillStyle = '#FFFFFF';
    wrapText(ctx, fullItem.name, 540, 580, 800, 56);

    // Brand
    ctx.font = '26px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(fullItem.brands?.name || '', 540, 680);

    // Price
    ctx.font = 'bold 40px Arial';
    ctx.fillStyle = '#FFD25A';
    const priceText = fullItem.base_price ? `${fullItem.currency} ${fullItem.base_price.toLocaleString()}` : '';
    ctx.fillText(priceText, 540, 740);

    // Priorities
    const priorities = (currentComparison.priorities || []).slice(0, 5);
    const priorityNames = priorities
        .map(pid => fullItem.item_attributes?.find(a => a.attribute_definitions?.id === pid))
        .filter(Boolean)
        .map(a => a.attribute_definitions?.name)
        .filter(Boolean);

    if (priorityNames.length > 0) {
        ctx.font = 'bold 22px Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('MY PRIORITIES', 540, 870);

        // Priority chips
        let x = 90;
        let y = 910;
        const chipH = 60;
        const chipGap = 16;
        ctx.font = 'bold 24px Arial';
        priorityNames.forEach(p => {
            const w = ctx.measureText(p).width + 60;
            if (x + w > 990) {
                x = 90;
                y += chipH + chipGap;
            }
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            roundRect(ctx, x, y, w, chipH, 30);
            ctx.fill();
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'left';
            ctx.fillText(p, x + 30, y + 40);
            ctx.textAlign = 'center';
            x += w + chipGap;
        });
    }

    // Footer
    ctx.font = '22px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'center';
    ctx.fillText('choz-platform.pages.dev', 540, 1270);

    // Download
    canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `choz-${fullItem.id}-decision.png`;
        a.click();
        URL.revokeObjectURL(url);
    }, 'image/png');
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line.trim(), x, currentY);
            line = words[n] + ' ';
            currentY += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line.trim(), x, currentY);
}

// Native share (mobile)
async function shareNative(itemId) {
    const item = currentComparison.options[currentComparison.choice];
    const { data: fullItem } = await sb
        .from('items')
        .select('*, brands(name), categories(name)')
        .eq('id', itemId)
        .single();

    const text = `I just chose "${fullItem?.name}" on CHOZ — blind comparison, real priorities. Choose without the noise.`;
    const url = window.location.origin;

    if (navigator.share) {
        try {
            await navigator.share({
                title: 'My CHOZ Decision',
                text: text,
                url: url
            });
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.warn('Share failed:', err);
            }
        }
    } else {
        copyShareText(itemId);
    }
}

// Copy text to clipboard
async function copyShareText(itemId) {
    const item = currentComparison.options[currentComparison.choice];
    const { data: fullItem } = await sb
        .from('items')
        .select('*, brands(name), categories(name)')
        .eq('id', itemId)
        .single();

    const text = `I just chose "${fullItem?.name}" (${fullItem?.brands?.name}) on CHOZ — blind comparison, real priorities. Choose without the noise.\n\nhttps://choz-platform.pages.dev`;

    try {
        await navigator.clipboard.writeText(text);
        // Show feedback
        const btn = event?.target;
        if (btn) {
            const original = btn.textContent;
            btn.textContent = '✓ Copied!';
            setTimeout(() => { btn.textContent = original; }, 2000);
        }
    } catch (err) {
        alert('Could not copy. Text:\n\n' + text);
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
// ============================================================
// REVIEWS SYSTEM
// ============================================================

// Load existing reviews for an item
async function loadItemReviews(itemId, itemName) {
    const section = document.getElementById('reviewsSection');
    if (!section) return;

    const { data: reviews } = await sb
        .from('user_reviews')
        .select('*, profiles(email)')
        .eq('item_id', itemId)
        .eq('is_approved', true)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
        .limit(3);

    if (!reviews || reviews.length === 0) {
        section.innerHTML = `
            <div style="background:var(--sf);border:1px solid var(--line);border-radius:14px;padding:18px">
                <p style="color:var(--mute);font-size:13px;text-align:center">
                    No reviews yet. Be the first to share your experience.
                </p>
            </div>
        `;
        return;
    }

    const avgRating = (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1);
    const stars = '★'.repeat(Math.round(avgRating)) + '☆'.repeat(5 - Math.round(avgRating));

    section.innerHTML = `
        <div style="background:var(--sf);border:1px solid var(--line);border-radius:14px;padding:20px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
                <h4 style="font-family:'Bricolage Grotesque';font-size:17px">⭐ User Reviews</h4>
                <span style="color:var(--hl);font-size:16px">${stars} <span style="color:var(--mute);font-size:13px">(${avgRating})</span></span>
            </div>
            ${reviews.map(r => `
                <div style="border-top:1px solid var(--line);padding:12px 0">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                        <span style="color:var(--hl);font-size:14px">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
                        <span style="color:var(--mute);font-size:12px">${formatReviewDate(r.created_at)}</span>
                    </div>
                    ${r.title ? `<strong style="font-size:14px;display:block;margin-bottom:4px">${escapeHtml(r.title)}</strong>` : ''}
                    <p style="color:var(--mute);font-size:13px;margin:0;line-height:1.5">${escapeHtml(r.content || '')}</p>
                </div>
            `).join('')}
        </div>
    `;
}

// Open review modal
function openReviewModal(itemId, itemName) {
    const section = document.getElementById('reviewsSection');
    section.innerHTML = `
        <div style="background:var(--sf);border:1px solid var(--line);border-radius:14px;padding:24px">
            <h4 style="font-family:'Bricolage Grotesque';font-size:18px;margin-bottom:4px">Write a Review</h4>
            <p style="color:var(--mute);font-size:13px;margin-bottom:16px">${escapeHtml(itemName)}</p>

            <div style="margin-bottom:14px">
                <label style="display:block;font-size:13px;font-weight:600;margin-bottom:8px">Your rating</label>
                <div id="starPicker" style="font-size:32px;color:var(--line);cursor:pointer;user-select:none">
                    <span data-star="1">★</span><span data-star="2">★</span><span data-star="3">★</span><span data-star="4">★</span><span data-star="5">★</span>
                </div>
            </div>

            <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px">Title (optional)</label>
            <input type="text" id="reviewTitle" placeholder="Summarize your experience" maxlength="80"
                   style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);margin-bottom:14px;font-family:inherit;font-size:14px">

            <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px">Your review</label>
            <textarea id="reviewContent" placeholder="What did you like or dislike?" maxlength="500" rows="4"
                      style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);margin-bottom:14px;font-family:inherit;font-size:14px;resize:vertical"></textarea>

            <div style="display:flex;gap:8px">
                <button class="btn p" style="flex:1" onclick="submitReview('${itemId}', \`${itemName.replace(/`/g, '\\`')}\`)">Submit Review</button>
                <button class="btn" onclick="loadItemReviews('${itemId}', \`${itemName.replace(/`/g, '\\`')}\`)">Cancel</button>
            </div>
            <p id="reviewError" style="color:#ef4444;font-size:13px;margin-top:10px;text-align:center"></p>
        </div>
    `;

    // Star picker logic
    let selectedRating = 0;
    const stars = section.querySelectorAll('#starPicker span');
    stars.forEach(star => {
        star.addEventListener('mouseenter', () => {
            const val = parseInt(star.dataset.star);
            stars.forEach(s => {
                s.style.color = parseInt(s.dataset.star) <= val ? 'var(--hl)' : 'var(--line)';
            });
        });
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.dataset.star);
            stars.forEach(s => {
                s.style.color = parseInt(s.dataset.star) <= selectedRating ? 'var(--hl)' : 'var(--line)';
            });
            stars.forEach(s => s.dataset.selected = 'true');
        });
    });
    section.querySelector('#starPicker').addEventListener('mouseleave', () => {
        stars.forEach(s => {
            s.style.color = parseInt(s.dataset.star) <= selectedRating ? 'var(--hl)' : 'var(--line)';
        });
    });

    // Store rating globally for submit
    window.__currentRating = () => selectedRating;
}

async function submitReview(itemId, itemName) {
    const rating = window.__currentRating ? window.__currentRating() : 0;
    const title = document.getElementById('reviewTitle').value.trim();
    const content = document.getElementById('reviewContent').value.trim();
    const errEl = document.getElementById('reviewError');

    if (rating < 1) {
        errEl.textContent = 'Please select a rating (1-5 stars).';
        return;
    }

    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        errEl.textContent = 'Please sign in to submit a review.';
        return;
    }

    const { error } = await sb.from('user_reviews').insert({
        user_id: session.user.id,
        item_id: itemId,
        rating: rating,
        title: title || null,
        content: content || null,
        is_approved: true,
        is_hidden: false
    });

    if (error) {
        errEl.textContent = error.message;
        return;
    }

    // Success — reload reviews
    loadItemReviews(itemId, itemName);
}

// Helpers
function formatReviewDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now - d) / 86400);
    if (diff < 1) return 'Today';
    if (diff < 7) return diff + 'd ago';
    if (diff < 30) return Math.floor(diff / 7) + 'w ago';
    return d.toLocaleDateString();
}

function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
