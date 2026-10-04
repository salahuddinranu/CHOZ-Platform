// ============================================================
// CHOZ BLIND COMPARISON ENGINE — v3 with Custom Option + Toast
// ============================================================

let currentComparison = {
    categoryId: null,
    options: [],
    labels: [],
    priorities: [],
    priorityNames: [],
    choice: null,
    step: 'select',
    attributeDefs: [],
    customCounter: 0
};

// ============================================================
// START COMPARISON
// ============================================================
async function startComparison(categoryId) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { openAuth(); return; }

    currentComparison.categoryId = categoryId;
    currentComparison.step = 'select';
    currentComparison.choice = null;
    currentComparison.priorityNames = [];
    currentComparison.customCounter = 0;
    currentComparison.sessionToken = null;

    try {
        // Server-side session start (anti-cheat)
        const { data, error } = await sb.rpc('start_comparison_session', {
            p_category_id: categoryId
        });

        if (error) throw error;

        currentComparison.sessionToken = data.session_token;
        currentComparison.options = data.options.map(opt => ({
            label: opt.label,
            display_name: opt.display_name,
            base_price: opt.price_hint,
            currency: opt.currency,
            item_attributes: (opt.attributes || []).map(a => ({
                value: a.value,
                numeric_value: a.numeric_value,
                attribute_definitions: { name: a.name, unit: a.unit }
            }))
        }));
        currentComparison.labels = currentComparison.options.map(o => o.label);

        // Fetch attribute definitions for custom option form
        const { data: attrDefs } = await sb
            .from('attribute_definitions')
            .select('*')
            .eq('category_id', categoryId)
            .order('sort_order');
        currentComparison.attributeDefs = attrDefs || [];

        renderComparisonModal();
    } catch (err) {
        console.error('start comparison error:', err);
        toastError(err.message || 'Could not start comparison');
    }
}

// ============================================================
// BROWSE CATEGORY — Redirect to browse page
// ============================================================
function browseCategory(categoryId) {
    window.location.href = `/category.html?id=${encodeURIComponent(categoryId)}`;
}

// ============================================================
// STEP 1: RENDER OPTIONS (with Custom Option Button)
// ============================================================
function renderComparisonModal() {
    const modal = document.getElementById('compModal');
    const content = document.getElementById('compContent');
    const { options, labels } = currentComparison;

    content.innerHTML = `
        <div class="comp-header">
            <h3>Blind Comparison</h3>
            <span class="badge">Step 1 of 3: Pick an option</span>
        </div>
        <p style="color:var(--mute);font-size:14px;margin-bottom:16px;line-height:1.6">
            <strong style="color:var(--ink)">Brand names are hidden.</strong><br>
            Review the specs and pick the option that feels right to you.
        </p>
        <div class="options-grid" id="optionsGrid">
            ${options.map((item, i) => {
                const attrs = (item.item_attributes || []).slice(0, 6);
                const customTag = item.is_custom
                    ? '<span style="font-size:10px;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:10px;margin-left:6px;vertical-align:middle">YOUR OPTION</span>'
                    : '';
                return `
                    <div class="option-card" data-idx="${i}" style="cursor:pointer">
                        <h3>Option ${labels[i]}${customTag}</h3>
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

        ${currentComparison.customCounter < 3 ? `
            <button type="button" class="btn" style="width:100%;padding:12px;margin-bottom:8px;border-style:dashed;color:var(--ac);border-color:var(--ac)"
                    id="addCustomBtn">
                ➕ Add your own option to compare
            </button>
        ` : ''}

        <button type="button" class="btn p" style="width:100%;padding:14px" id="lockBtn" disabled>
            Select an option first
        </button>
        <a href="/category.html?id=${currentComparison.categoryId}" 
   style="display:block;text-align:center;margin-top:12px;font-size:13px;color:var(--ac);text-decoration:underline">
   Or browse all items in this category →
</a>
    `;

    content.querySelectorAll('.option-card').forEach(card => {
        card.addEventListener('click', () => {
            const idx = parseInt(card.dataset.idx);
            selectOption(idx);
        });
    });

    const addBtn = document.getElementById('addCustomBtn');
    if (addBtn) addBtn.addEventListener('click', showCustomOptionForm);

    document.getElementById('lockBtn').addEventListener('click', goToPriorities);

    modal.classList.remove('hidden');
}

function selectOption(idx) {
    currentComparison.choice = idx;
    document.querySelectorAll('.option-card').forEach((el, i) => {
        el.classList.toggle('selected', i === idx);
    });
    const lockBtn = document.getElementById('lockBtn');
    if (lockBtn) {
        lockBtn.disabled = false;
        lockBtn.textContent = 'Next: Set Your Priorities →';
    }
}

function goToPriorities() {
    if (currentComparison.choice === null) return;
    currentComparison.step = 'priorities';
    renderPrioritiesStep();
}

// ============================================================
// CUSTOM OPTION FORM
// ============================================================
function showCustomOptionForm() {
    const content = document.getElementById('compContent');
    const attrsArray = currentComparison.attributeDefs || [];

    content.innerHTML = `
        <div class="comp-header">
            <h3>Add Your Own Option</h3>
            <button class="modal-close" style="position:static;font-size:20px" onclick="renderComparisonModal()">×</button>
        </div>
        <p style="color:var(--mute);font-size:14px;margin-bottom:16px;line-height:1.6">
            Enter your own product to compare against the anonymous options.
            This option appears as a regular choice — your entry stays private.
        </p>

        <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px">Name <span style="color:#ef4444">*</span></label>
        <input type="text" id="customName" placeholder="e.g. My Current Phone" maxlength="80"
               style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font-family:inherit;font-size:14px;margin-bottom:14px">

        <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px">Price (optional)</label>
        <input type="number" id="customPrice" placeholder="e.g. 50000" min="0"
               style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font-family:inherit;font-size:14px;margin-bottom:16px">

        <div style="border-top:1px solid var(--line);padding-top:16px;margin-bottom:8px">
            <strong style="font-size:13px;color:var(--ink)">Specifications</strong>
            <p style="font-size:12px;color:var(--mute);margin-top:4px;margin-bottom:12px">
                Fill in what you know. Empty fields will be skipped.
            </p>
        </div>

        <div id="customAttrs" style="max-height:280px;overflow-y:auto;padding-right:4px">
            ${attrsArray.length === 0 ? `
                <p style="color:var(--mute);font-size:13px">No predefined attributes for this category.</p>
            ` : attrsArray.map(a => `
                <div style="margin-bottom:12px">
                    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px">
                        ${a.name}${a.unit ? ' <span style="color:var(--mute);font-weight:400">(' + a.unit + ')</span>' : ''}
                    </label>
                    <input type="text" class="custom-attr-input"
                           data-attr-id="${a.id}"
                           data-attr-name="${a.name}"
                           data-attr-unit="${a.unit || ''}"
                           data-attr-type="${a.data_type}"
                           placeholder="Enter value"
                           style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font-family:inherit;font-size:14px">
                </div>
            `).join('')}
        </div>

        <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn p" style="flex:1;padding:14px" id="customSaveBtn">Add to Comparison</button>
            <button class="btn" id="customCancelBtn">Cancel</button>
        </div>
    `;

    document.getElementById('customSaveBtn').addEventListener('click', saveCustomOption);
    document.getElementById('customCancelBtn').addEventListener('click', renderComparisonModal);
}

function saveCustomOption() {
    const nameEl = document.getElementById('customName');
    const priceEl = document.getElementById('customPrice');
    if (!nameEl) return;

    const name = nameEl.value.trim();
    const price = priceEl ? priceEl.value : '';

    if (!name) {
        toastWarning('Please enter a name for your option.');
        nameEl.focus();
        return;
    }

    const item_attributes = [];
    document.querySelectorAll('.custom-attr-input').forEach(input => {
        const val = input.value.trim();
        if (val) {
            const numVal = parseFloat(val);
            item_attributes.push({
                attribute_definitions: {
                    id: input.dataset.attrId,
                    name: input.dataset.attrName,
                    unit: input.dataset.attrUnit,
                    data_type: input.dataset.attrType
                },
                value: val,
                numeric_value: isNaN(numVal) ? null : numVal
            });
        }
    });

    currentComparison.customCounter = (currentComparison.customCounter || 0) + 1;
    const customLabel = String.fromCharCode(65 + currentComparison.options.length);

    const customOption = {
        id: 'custom-' + Date.now(),
        name: name,
        base_price: price ? parseFloat(price) : null,
        currency: 'PKR',
        is_custom: true,
        item_attributes: item_attributes
    };

    currentComparison.options.push(customOption);
    currentComparison.labels.push(customLabel);

    toastSuccess('Your option added to comparison');
    renderComparisonModal();
}

// ============================================================
// STEP 2: RENDER PRIORITIES (checkbox based)
// ============================================================
function renderPrioritiesStep() {
    const content = document.getElementById('compContent');
    const attrsArray = currentComparison.attributeDefs || [];

    if (attrsArray.length === 0) {
        const allAttrs = new Map();
        currentComparison.options.forEach(item => {
            (item.item_attributes || []).forEach(a => {
                if (a.attribute_definitions && !allAttrs.has(a.attribute_definitions.id)) {
                    allAttrs.set(a.attribute_definitions.id, a.attribute_definitions);
                }
            });
        });
        currentComparison.attributeDefs = [...allAttrs.values()];
    }

    const list = currentComparison.attributeDefs;

    currentComparison.priorities = list.map(a => a.id);
    currentComparison.priorityNames = list.map(a => a.name);

    content.innerHTML = `
        <div class="comp-header">
            <h3>Your Priorities</h3>
            <span class="badge">Step 2 of 3: Select priorities</span>
        </div>
        <p style="color:var(--mute);font-size:14px;margin-bottom:8px;line-height:1.6">
            <strong style="color:var(--ink)">Tick what matters to you.</strong>
            Use ↑ ↓ to rank the order.
        </p>
        <p style="color:var(--mute);font-size:12px;margin-bottom:12px">
            First tick = highest priority. Unticked items are ignored.
        </p>

        <div id="priorityList" style="max-height:400px;overflow-y:auto;padding-right:4px">
            ${list.map((a, i) => `
                <div class="priority-item"
                     data-attr-id="${a.id}"
                     data-attr-name="${a.name}"
                     style="cursor:default;margin-bottom:6px">
                    <label style="display:flex;align-items:center;gap:12px;flex:1;cursor:pointer;margin:0">
                        <input type="checkbox" class="pri-check" checked
                               style="width:18px;height:18px;cursor:pointer;flex-shrink:0;accent-color:var(--ac)">
                        <span class="rank-badge"
                              style="background:var(--ac-soft);color:var(--ac);min-width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:12px;flex-shrink:0">
                            ${i + 1}
                        </span>
                        <span style="font-size:14px">${a.name}${a.unit ? ' (' + a.unit + ')' : ''}</span>
                    </label>
                    <div style="display:flex;gap:4px">
                        <button type="button" class="btn pri-up" style="padding:6px 14px;font-size:14px;font-weight:700">↑</button>
                        <button type="button" class="btn pri-down" style="padding:6px 14px;font-size:14px;font-weight:700">↓</button>
                    </div>
                </div>
            `).join('')}
        </div>

        <div id="prioritySummary" style="margin-top:12px;padding:12px;background:var(--ac-soft);border-radius:10px;font-size:13px;color:var(--ac)">
            All priorities selected
        </div>

        <button type="button" class="btn p" style="width:100%;padding:14px;margin-top:16px" id="lockChoiceBtn">
            🔒 Lock Choice & Reveal
        </button>
        <button type="button" class="btn" style="width:100%;margin-top:8px;" id="backBtn">
            ← Back to options
        </button>
    `;

    const listEl = document.getElementById('priorityList');

    listEl.querySelectorAll('.pri-check').forEach(cb => {
        cb.addEventListener('change', updateSelectedPriorities);
    });

    listEl.querySelectorAll('.priority-item').forEach(item => {
        const upBtn = item.querySelector('.pri-up');
        const downBtn = item.querySelector('.pri-down');

        upBtn.addEventListener('click', () => {
            const items = [...listEl.children];
            const idx = items.indexOf(item);
            if (idx > 0) {
                items[idx - 1].before(item);
                updateSelectedPriorities();
            }
        });

        downBtn.addEventListener('click', () => {
            const items = [...listEl.children];
            const idx = items.indexOf(item);
            if (idx < items.length - 1) {
                items[idx + 1].after(item);
                updateSelectedPriorities();
            }
        });
    });

    updateSelectedPriorities();

    document.getElementById('lockChoiceBtn').addEventListener('click', lockChoice);
    document.getElementById('backBtn').addEventListener('click', backToSelect);
}

function updateSelectedPriorities() {
    const items = document.querySelectorAll('#priorityList .priority-item');
    const selected = [];
    const names = [];
    let rank = 1;

    items.forEach(item => {
        const cb = item.querySelector('.pri-check');
        const badge = item.querySelector('.rank-badge');

        if (cb.checked) {
            selected.push(item.dataset.attrId);
            names.push(item.dataset.attrName);
            badge.textContent = rank++;
            badge.style.background = 'var(--ac-soft)';
            badge.style.color = 'var(--ac)';
            badge.style.opacity = '1';
            item.style.opacity = '1';
        } else {
            badge.textContent = '–';
            badge.style.background = 'var(--line)';
            badge.style.color = 'var(--mute)';
            badge.style.opacity = '0.6';
            item.style.opacity = '0.55';
        }
    });

    currentComparison.priorities = selected;
    currentComparison.priorityNames = names;

    const summary = document.getElementById('prioritySummary');
    if (summary) {
        if (selected.length === 0) {
            summary.textContent = '⚠️ Tick at least one priority';
            summary.style.background = '#fee2e2';
            summary.style.color = '#991b1b';
        } else if (selected.length === items.length) {
            summary.textContent = 'All ' + selected.length + ' priorities selected';
            summary.style.background = 'var(--ac-soft)';
            summary.style.color = 'var(--ac)';
        } else {
            summary.textContent = selected.length + ' of ' + items.length + ' selected';
            summary.style.background = 'var(--ac-soft)';
            summary.style.color = 'var(--ac)';
        }
    }
}

function backToSelect() {
    currentComparison.step = 'select';
    renderComparisonModal();
    if (currentComparison.choice !== null) {
        const cards = document.querySelectorAll('.option-card');
        if (cards[currentComparison.choice]) {
            cards[currentComparison.choice].classList.add('selected');
        }
        const lockBtn = document.getElementById('lockBtn');
        if (lockBtn) {
            lockBtn.disabled = false;
            lockBtn.textContent = 'Next: Set Your Priorities →';
        }
    }
}

// ============================================================
// STEP 3: LOCK CHOICE + REVEAL
// ============================================================
async function lockChoice() {
    if (currentComparison.choice === null) return;

    if (document.getElementById('priorityList')) {
        updateSelectedPriorities();
    }

    if (!currentComparison.priorities || currentComparison.priorities.length === 0) {
        toastWarning('Please tick at least one priority.');
        return;
    }

    const chosenItem = currentComparison.options[currentComparison.choice];
    const chosenLabel = currentComparison.labels[currentComparison.choice];

    // Custom option — no server lock needed
    if (chosenItem.is_custom) {
        currentComparison.step = 'revealed';
        renderReveal({
            id: chosenItem.id,
            name: chosenItem.name,
            base_price: chosenItem.base_price,
            currency: chosenItem.currency,
            brands: null,
            categories: { name: 'Custom' },
            item_attributes: chosenItem.item_attributes,
            is_custom: true
        }, chosenLabel);
        return;
    }

    try {
        // Send to server — server validates + freezes
        const { error } = await sb.rpc('lock_comparison_choice', {
            p_session_token: currentComparison.sessionToken,
            p_chosen_label: chosenLabel,
            p_priorities: currentComparison.priorities
        });

        if (error) throw error;

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

        // Server returns reveal (server decides what to show)
        const { data: revealData, error: revealErr } = await sb.rpc('reveal_comparison_choice', {
            p_session_token: currentComparison.sessionToken
        });

        if (revealErr) throw revealErr;

        currentComparison.step = 'revealed';
        renderRevealFromServer(revealData.item, revealData.chosen_label);

    } catch (err) {
        console.error('Lock error:', err);
        toastError(err.message || 'Could not lock choice');
    }
}

// ============================================================
// REVEAL
// ============================================================
function renderReveal(item, label) {
    const content = document.getElementById('compContent');
    const attrs = item.item_attributes || [];
    const priorities = currentComparison.priorities || [];

    const priorityExplanations = priorities.slice(0, 5).map((attrId, idx) => {
        const attr = attrs.find(a => a.attribute_definitions?.id === attrId);
        if (!attr) return null;
        return {
            rank: idx + 1,
            name: attr.attribute_definitions?.name || 'Unknown',
            value: `${attr.value || attr.numeric_value || '—'}${attr.attribute_definitions?.unit ? ' ' + attr.attribute_definitions.unit : ''}`
        };
    }).filter(Boolean);

    const isCustom = item.is_custom === true;

    content.innerHTML = `
        <div class="comp-header">
            <h3>Your Result</h3>
            <span class="badge" style="background:#dcfce7;color:#166534">Step 3 of 3: Result</span>
        </div>

        <div class="reveal-card">
            <h2>🎉 Revealed</h2>
            <p style="opacity:0.9">You chose Option ${label}</p>
            <div class="item-name">${item.name}</div>
            ${!isCustom ? `<div class="brand-name">${item.brands?.name || 'Unknown brand'}</div>` : `<div class="brand-name" style="opacity:0.7">Your custom entry</div>`}
            ${item.base_price ? `<div class="price">${item.currency} ${item.base_price.toLocaleString()}</div>` : ''}
        </div>

        <div class="why-section-box">
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
                    ${!isCustom ? 'Brand names were hidden during your decision.' : ''}
                </p>
            ` : `
                <p style="font-size:14px">You selected this option from ${currentComparison.options.length} anonymous choices.</p>
            `}
        </div>

        <div class="reveal-actions">
            <button class="btn p" onclick="saveDecision('${item.id}')">💾 Save to Memory</button>
            ${!isCustom ? `
                <button class="btn" onclick="bookmarkComparison('${item.id}', \`${item.name.replace(/`/g, '\\`')}\`)">🔖 Bookmark</button>
                <button class="btn" onclick="openReviewModal('${item.id}', \`${item.name.replace(/`/g, '\\`')}\`)">⭐ Write Review</button>
            ` : ''}
            <button class="btn" onclick="shareResult()">🔗 Share</button>
            <button class="btn" onclick="showWhereToBuy('${item.id}', \`${item.name.replace(/`/g, '\\`')}\`, '${currentComparison.categoryId}')">🛒 Where to Buy</button>
            <button class="btn" onclick="closeCompModal()">Close</button>
        </div>

        ${!isCustom ? `
            <div id="reviewsSection" style="margin-top:20px"></div>
        ` : ''}
        <div id="buySection" style="margin-top:20px"></div>
    `;

    if (!isCustom) {
        setTimeout(() => {
            if (typeof loadItemReviews === 'function') {
                loadItemReviews(item.id, item.name);
            }
        }, 100);
    }
}

// ============================================================
// SAVE DECISION
// ============================================================
async function saveDecision(itemId) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { openAuth(); return; }

    const item = currentComparison.options[currentComparison.choice];

    const { error } = await sb.from('decision_memories').insert({
        user_id: session.user.id,
        category_id: currentComparison.categoryId,
        chosen_item_id: item.is_custom ? null : itemId,
        title: `I chose ${item.name}`,
        note: item.is_custom ? 'Custom option entered by me' : '',
        priorities: currentComparison.priorities || []
    });

    if (error) {
        toastError('Could not save: ' + error.message);
        return;
    }

    const btn = event?.target;
    if (btn) {
        btn.textContent = '✅ Saved!';
        btn.disabled = true;
        setTimeout(() => {
            btn.textContent = '💾 Save to Memory';
            btn.disabled = false;
        }, 2000);
    }
    toastSuccess('Saved to your Decision Memory');
}

// ============================================================
// BOOKMARK
// ============================================================
async function bookmarkComparison(itemId, itemName) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { openAuth(); return; }

    if (String(itemId).startsWith('custom-')) {
        toastWarning('Custom entries cannot be bookmarked.');
        return;
    }

    const { data: existing } = await sb
        .from('saved_comparisons')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('item_id', itemId)
        .maybeSingle();

    if (existing) {
        const { error } = await sb.from('saved_comparisons').delete().eq('id', existing.id);
        if (error) { toastError('Could not remove: ' + error.message); return; }
        if (event?.target) {
            event.target.textContent = '🔖 Bookmark';
            event.target.style.background = '';
            event.target.style.color = '';
        }
        toastInfo('Bookmark removed');
        return;
    }

    const { error } = await sb.from('saved_comparisons').insert({
        user_id: session.user.id,
        category_id: currentComparison.categoryId,
        item_id: itemId,
        item_name: itemName,
        label: `Saved from ${currentComparison.options.length}-option comparison`
    });

    if (error) { toastError('Could not save: ' + error.message); return; }

    if (event?.target) {
        event.target.textContent = '✅ Bookmarked';
        event.target.style.background = 'var(--ac)';
        event.target.style.color = 'white';
    }
    toastSuccess('Added to Saved');
}

// ============================================================
// SHARE RESULT
// ============================================================
async function shareResult() {
    const item = currentComparison.options[currentComparison.choice];
    if (!item) return;

    if (item.is_custom) {
        showShareModal({
            id: item.id,
            name: item.name,
            base_price: item.base_price,
            currency: item.currency,
            brands: null,
            categories: { name: 'Custom' }
        });
        return;
    }

    const { data: fullItem } = await sb
        .from('items')
        .select('*, brands(name), categories(name)')
        .eq('id', item.id)
        .single();

    if (!fullItem) {
        toastError('Could not load item details.');
        return;
    }

    showShareModal(fullItem);
}

function showShareModal(item) {
    const content = document.getElementById('compContent');

    const categoryName = item.categories?.name || 'Comparison';
    const brandName = item.brands?.name || 'Custom Option';
    const price = item.base_price ? `${item.currency} ${item.base_price.toLocaleString()}` : 'Price unavailable';

    const priorityNames = (currentComparison.priorityNames || []).slice(0, 5);

    content.innerHTML = `
        <div class="comp-header">
            <h3>Share Your Decision</h3>
            <button class="modal-close" style="position:static;font-size:20px" onclick="closeCompModal()">×</button>
        </div>

        <div id="sharePreview" style="background: linear-gradient(135deg, #3A3FD9 0%, #7C3AED 100%);border-radius: 20px;padding: 32px;color: white;text-align: center;margin: 20px 0;box-shadow: 0 20px 60px rgba(58,63,217,0.3);">
            <div style="font-family:'Bricolage Grotesque';font-size:14px;letter-spacing:3px;opacity:0.85;margin-bottom:20px">CHOZ</div>
            <div style="font-family:'Bricolage Grotesque';font-size:28px;font-weight:700;line-height:1.2;margin-bottom:8px">I chose this.</div>
            <div style="font-size:13px;opacity:0.8;margin-bottom:24px">Choose without the noise.</div>

            <div style="background:rgba(255,255,255,0.15);border-radius:14px;padding:20px;margin-bottom:20px;backdrop-filter:blur(10px)">
                <div style="font-size:11px;letter-spacing:2px;opacity:0.7;text-transform:uppercase;margin-bottom:8px">${escapeHtml(categoryName)}</div>
                <div style="font-size:20px;font-family:'Bricolage Grotesque';font-weight:700;margin-bottom:4px">${escapeHtml(item.name)}</div>
                <div style="font-size:13px;opacity:0.85;margin-bottom:8px">${escapeHtml(brandName)}</div>
                <div style="font-size:16px;font-weight:600">${price}</div>
            </div>

            ${priorityNames.length > 0 ? `
                <div style="margin-bottom:20px">
                    <div style="font-size:11px;letter-spacing:2px;opacity:0.7;text-transform:uppercase;margin-bottom:10px">My priorities were</div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center">
                        ${priorityNames.map(p => `<span style="background:rgba(255,255,255,0.2);padding:6px 12px;border-radius:20px;font-size:12px;font-weight:500">${escapeHtml(p)}</span>`).join('')}
                    </div>
                </div>
            ` : ''}

            <div style="font-size:11px;opacity:0.6;margin-top:24px">choz-platform.pages.dev</div>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
            <button class="btn p" style="width:100%;padding:14px" onclick="downloadShareCard('${item.id}')">📥 Download Card (PNG)</button>
            <button class="btn" style="width:100%;padding:14px" onclick="shareNative('${item.id}')">📱 Share via Device</button>
            <button class="btn" style="width:100%;padding:14px" onclick="copyShareText('${item.id}')">📋 Copy Text</button>
            <button class="btn" style="width:100%;padding:14px" onclick="closeCompModal()">Close</button>
        </div>

        <p style="font-size:11px;color:var(--mute);text-align:center;margin-top:16px">Your share card shows no personal data.</p>
    `;
}

async function downloadShareCard(itemId) {
    let fullItem;
    const item = currentComparison.options[currentComparison.choice];

    if (item.is_custom) {
        fullItem = {
            id: item.id,
            name: item.name,
            base_price: item.base_price,
            currency: item.currency,
            brands: { name: 'Custom' },
            categories: { name: 'Custom' }
        };
    } else {
        const { data } = await sb.from('items').select('*, brands(name), categories(name)').eq('id', itemId).single();
        fullItem = data;
    }

    if (!fullItem) { toastError('Load failed'); return; }

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 1080, 1350);
    grad.addColorStop(0, '#3A3FD9');
    grad.addColorStop(1, '#7C3AED');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1350);

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 42px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('CHOZ', 540, 130);

    ctx.font = '22px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('Choose without the noise.', 540, 175);

    ctx.font = 'bold 72px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('I chose this.', 540, 320);

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(ctx, 90, 420, 900, 360, 32);
    ctx.fill();

    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText((fullItem.categories?.name || 'Comparison').toUpperCase(), 540, 500);

    ctx.font = 'bold 48px Arial';
    ctx.fillStyle = '#FFFFFF';
    wrapText(ctx, fullItem.name, 540, 580, 800, 56);

    ctx.font = '26px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(fullItem.brands?.name || '', 540, 680);

    ctx.font = 'bold 40px Arial';
    ctx.fillStyle = '#FFD25A';
    const priceText = fullItem.base_price ? `${fullItem.currency} ${fullItem.base_price.toLocaleString()}` : '';
    ctx.fillText(priceText, 540, 740);

    const priorityNames = (currentComparison.priorityNames || []).slice(0, 5);

    if (priorityNames.length > 0) {
        ctx.font = 'bold 22px Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('MY PRIORITIES', 540, 870);

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

    ctx.font = '22px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'center';
    ctx.fillText('choz-platform.pages.dev', 540, 1270);

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

async function shareNative(itemId) {
    const item = currentComparison.options[currentComparison.choice];
    let name = item.name;

    if (!item.is_custom) {
        const { data } = await sb.from('items').select('name').eq('id', itemId).single();
        if (data) name = data.name;
    }

    const text = `I just chose "${name}" on CHOZ — blind comparison, real priorities. Choose without the noise.`;
    const url = window.location.origin;

    if (navigator.share) {
        try {
            await navigator.share({ title: 'My CHOZ Decision', text, url });
        } catch (err) {
            if (err.name !== 'AbortError') console.warn('Share failed:', err);
        }
    } else {
        copyShareText(itemId);
    }
}

async function copyShareText(itemId) {
    const item = currentComparison.options[currentComparison.choice];
    let name = item.name;
    let brand = '';

    if (!item.is_custom) {
        const { data } = await sb.from('items').select('name, brands(name)').eq('id', itemId).single();
        if (data) {
            name = data.name;
            brand = data.brands?.name || '';
        }
    }

    const text = `I just chose "${name}"${brand ? ' (' + brand + ')' : ''} on CHOZ — blind comparison, real priorities. Choose without the noise.\n\nhttps://choz-platform.pages.dev`;

    try {
        await navigator.clipboard.writeText(text);
        const btn = event?.target;
        if (btn) {
            const original = btn.textContent;
            btn.textContent = '✓ Copied!';
            setTimeout(() => { btn.textContent = original; }, 2000);
        }
        toastSuccess('Copied to clipboard');
    } catch (err) {
        toastInfo('Text: ' + text);
    }
}

// ============================================================
// WHERE TO BUY
// ============================================================
const SEARCH_PROVIDERS = {
    'cat-phone': [
        { name: 'Daraz', icon: '🛍️', url: q => `https://www.daraz.pk/catalog/?q=${q}` },
        { name: 'PriceOye', icon: '💰', url: q => `https://priceoye.pk/search?q=${q}` },
        { name: 'OLX Pakistan', icon: '📦', url: q => `https://www.olx.com.pk/items/q-${q.replace(/%20/g, '-')}` },
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
    if (!section) return;

    section.innerHTML = '<p style="text-align:center;color:var(--mute);font-size:14px;padding:16px">Loading buy options...</p>';

    const isCustom = String(itemId).startsWith('custom-');

    let adminLinks = null;
    if (!isCustom) {
        const { data } = await sb
            .from('affiliate_links')
            .select('*')
            .eq('item_id', itemId)
            .eq('is_active', true)
            .order('created_at');
        adminLinks = data;
    }

    let html = `
        <div style="background:var(--sf);border:1px solid var(--line);border-radius:14px;padding:20px">
            <h4 style="font-family:'Bricolage Grotesque';font-size:17px;margin-bottom:6px">🛒 Where to Buy</h4>
            <p style="color:var(--mute);font-size:12px;margin-bottom:16px">
                Find this product on trusted platforms.
            </p>
    `;

    if (adminLinks && adminLinks.length > 0) {
        html += `<p style="color:var(--mute);font-size:13px;margin-bottom:12px;padding:10px;background:var(--ac-soft);border-radius:8px">
            ⓘ Some links below are affiliate links. We may earn a commission — this never affects your comparison result.
        </p>`;
        html += `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">`;
        adminLinks.forEach(l => {
            const safeLabel = (l.label || l.provider || 'Open store').replace(/'/g, "\\'");
            html += `
                <a href="${l.url}" target="_blank" rel="noopener noreferrer nofollow sponsored"
                   onclick="trackAffiliateClick('${l.id}', '${itemId}')"
                   style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:var(--ac-soft);color:var(--ink);border-radius:10px;text-decoration:none;font-weight:500">
                    <span>${safeLabel}</span>
                    <span style="color:var(--ac);font-size:13px">Visit →</span>
                </a>
            `;
        });
        html += `</div>`;
    }

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
    </p>`;

    html += `</div>`;
    section.innerHTML = html;
}

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
// REVIEWS
// ============================================================
async function loadItemReviews(itemId, itemName) {
    const section = document.getElementById('reviewsSection');
    if (!section) return;

    const { data: reviews } = await sb
        .from('user_reviews')
        .select('*')
        .eq('item_id', itemId)
        .eq('is_approved', true)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
        .limit(3);

    if (!reviews || reviews.length === 0) {
        section.innerHTML = `
            <div style="background:var(--sf);border:1px solid var(--line);border-radius:14px;padding:18px">
                <p style="color:var(--mute);font-size:13px;text-align:center">No reviews yet. Be the first to share your experience.</p>
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

function openReviewModal(itemId, itemName) {
    const section = document.getElementById('reviewsSection');
    if (!section) return;

    if (String(itemId).startsWith('custom-')) {
        toastWarning('Custom entries cannot be reviewed.');
        return;
    }

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
                <button class="btn p" style="flex:1" id="submitReviewBtn">Submit Review</button>
                <button class="btn" id="cancelReviewBtn">Cancel</button>
            </div>
            <p id="reviewError" style="color:#ef4444;font-size:13px;margin-top:10px;text-align:center"></p>
        </div>
    `;

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
        });
    });
    section.querySelector('#starPicker').addEventListener('mouseleave', () => {
        stars.forEach(s => {
            s.style.color = parseInt(s.dataset.star) <= selectedRating ? 'var(--hl)' : 'var(--line)';
        });
    });

    document.getElementById('submitReviewBtn').addEventListener('click', () => {
        submitReview(itemId, itemName, selectedRating);
    });
    document.getElementById('cancelReviewBtn').addEventListener('click', () => {
        loadItemReviews(itemId, itemName);
    });
}

async function submitReview(itemId, itemName, rating) {
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
        rating,
        title: title || null,
        content: content || null,
        is_approved: true,
        is_hidden: false
    });

    if (error) {
        errEl.textContent = error.message;
        return;
    }

    toastSuccess('Review submitted!');
    loadItemReviews(itemId, itemName);
}

function formatReviewDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now - d) / 86400000);
    if (diff < 1) return 'Today';
    if (diff < 7) return diff + 'd ago';
    if (diff < 30) return Math.floor(diff / 7) + 'w ago';
    return d.toLocaleDateString();
}

function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ============================================================
// CLOSE MODAL
// ============================================================
function closeCompModal() {
    document.getElementById('compModal').classList.add('hidden');
    currentComparison = {
        categoryId: null, options: [], labels: [],
        priorities: [], priorityNames: [], choice: null, step: 'select',
        attributeDefs: [], customCounter: 0
    };
}

// ============================================================
// LOAD CATEGORIES — Browse page link
// ============================================================
async function loadCategories() {
    const grid = document.getElementById('catGrid');
    if (!grid) return;

    const { data: cats, error } = await sb
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

    if (error || !cats || cats.length === 0) {
        grid.innerHTML = '<p style="color:var(--mute);text-align:center;padding:40px">No categories available.</p>';
        return;
    }

    const hints = {
        'cat-phone': 'Battery • Camera • Display',
        'cat-bike': 'Engine • Mileage • Comfort',
        'cat-hotel': 'Location • Rating • Price',
        'cat-laptop': 'CPU • Battery • Weight',
        'cat-headphone': 'Sound • ANC • Battery',
        'cat-car': 'Fuel • Safety • Seating',
        'cat-tablet': 'Screen • Battery • Storage',
        'cat-smartwatch': 'Health • Battery • Display',
        'cat-speaker': 'Power • Battery • Waterproof',
        'cat-tv': 'Resolution • Size • Smart OS',
        'cat-camera': 'Sensor • Video • Megapixels',
        'cat-console': 'Storage • Exclusives • Price',
        'cat-fridge': 'Capacity • Energy • Type',
        'cat-washing': 'Load • Energy • Speed',
        'cat-ac': 'Tonnage • Inverter • Rating',
        'cat-restaurant': 'Cuisine • Rating • Distance',
        'cat-internet': 'Speed • Price • Data',
        'cat-mobile-pkg': 'Data • Minutes • Price',
        'cat-course': 'Duration • Level • Price',
        'cat-software': 'Platform • Pricing • Support'
    };

    const { data: counts } = await sb
        .from('items')
        .select('category_id')
        .eq('is_active', true);

    const countMap = {};
    (counts || []).forEach(item => {
        countMap[item.category_id] = (countMap[item.category_id] || 0) + 1;
    });

    grid.innerHTML = cats.map(c => {
        const itemCount = countMap[c.id] || 0;
        const hasEnough = itemCount >= 2;
        const hint = hints[c.id] || c.description || 'Compare options';

        return `
            <a onclick="startComparison('${c.id}')" style="${!hasEnough ? 'opacity:0.6' : ''}">
                <span class="icon">${c.icon || '📦'}</span>
                <b>${c.name}</b>
                <small>${hint}</small>
                <div class="cat-footer">
                    <span class="cat-count">${itemCount} options</span>
                    <span class="cat-arrow"><span class="cat-arrow">Compare →</span> →</span>
                </div>
            </a>
        `;
    }).join('');
}

// ============================================================
// MODAL CLOSE HANDLERS
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const compModal = document.getElementById('compModal');
    const closeComp = document.getElementById('closeComp');
    if (closeComp) closeComp.onclick = closeCompModal;
    if (compModal) compModal.addEventListener('click', (e) => {
        if (e.target.id === 'compModal') closeCompModal();
    });
});
// ============================================================
// RENDER REVEAL FROM SERVER RESPONSE
// ============================================================
function renderRevealFromServer(item, label) {
    const content = document.getElementById('compContent');
    const attrs = (item.attributes || []).map(a => ({
        value: a.value,
        numeric_value: a.numeric_value,
        attribute_definitions: { name: a.name, unit: a.unit }
    }));
    const priorities = currentComparison.priorities || [];

    const priorityExplanations = priorities.slice(0, 5).map((attrId, idx) => {
        const attr = attrs.find(a => a.attribute_definitions?.name === attrId || a.attribute_definitions?.id === attrId);
        if (!attr) return null;
        return {
            rank: idx + 1,
            name: attr.attribute_definitions?.name || 'Unknown',
            value: `${attr.value || attr.numeric_value || '—'}${attr.attribute_definitions?.unit ? ' ' + attr.attribute_definitions.unit : ''}`
        };
    }).filter(Boolean);

    content.innerHTML = `
        <div class="comp-header">
            <h3>Your Result</h3>
            <span class="badge" style="background:#dcfce7;color:#166534">✓ Verified</span>
        </div>

        <div class="reveal-card">
            <h2>🎉 Revealed</h2>
            <p style="opacity:0.9">You chose Option ${label}</p>
            <div class="item-name">${item.name}</div>
            ${item.brand_name ? `<div class="brand-name">${item.brand_name}</div>` : ''}
            ${item.base_price ? `<div class="price">${item.currency} ${item.base_price.toLocaleString()}</div>` : ''}
        </div>

        <div class="why-section-box">
            <h4 style="font-family:'Bricolage Grotesque';font-size:18px;margin-bottom:12px">Why I Chose This</h4>
            ${priorityExplanations.length > 0 ? `
                <ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.8">
                    ${priorityExplanations.map(p => `
                        <li><strong>${p.name}</strong> <span style="color:var(--ac);font-weight:600">→ ${p.value}</span></li>
                    `).join('')}
                </ol>
                <p style="margin-top:14px;font-size:13px;color:var(--mute)">
                    🔒 Verified server-side. Brand names were hidden during your decision.
                </p>
            ` : `
                <p style="font-size:14px">You selected this option from ${currentComparison.options.length} anonymous choices.</p>
            `}
        </div>

        <div class="reveal-actions">
            <button class="btn p" onclick="saveDecision('${item.id}')">💾 Save to Memory</button>
            <button class="btn" onclick="bookmarkComparison('${item.id}', \`${item.name.replace(/`/g, '\\`')}\`)">🔖 Bookmark</button>
            <button class="btn" onclick="openReviewModal('${item.id}', \`${item.name.replace(/`/g, '\\`')}\`)">⭐ Write Review</button>
            <button class="btn" onclick="shareResult()">🔗 Share</button>
            <button class="btn" onclick="showWhereToBuy('${item.id}', \`${item.name.replace(/`/g, '\\`')}\`, '${currentComparison.categoryId}')">🛒 Where to Buy</button>
            <button class="btn" onclick="closeCompModal()">Close</button>
        </div>

        <div id="reviewsSection" style="margin-top:20px"></div>
        <div id="buySection" style="margin-top:20px"></div>
    `;

    setTimeout(() => {
        if (typeof loadItemReviews === 'function') {
            loadItemReviews(item.id, item.name);
        }
    }, 100);
}
