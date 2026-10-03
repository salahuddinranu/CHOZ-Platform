// ============================================================
// CHOZ BLIND COMPARISON ENGINE
// ============================================================

let currentComparison = {
    categoryId: null,
    sessionToken: null,
    options: [],
    priorities: []
};

// Start comparison for a category
async function startComparison(categoryId) {
    if (!currentUser) {
        openAuthModal();
        showToast('Please sign in to start comparing.', 'info');
        return;
    }

    currentComparison.categoryId = categoryId;

    // Fetch items for category
    const { data: items, error } = await supabase
        .from('items')
        .select('*, item_attributes(*, attribute_definitions(*))')
        .eq('category_id', categoryId)
        .eq('is_active', true)
        .limit(3);

    if (error || !items || items.length < 2) {
        showToast('Not enough items in this category yet.', 'error');
        return;
    }

    // Create comparison record
    const { data: comparison, error: compError } = await supabase
        .from('comparisons')
        .insert({
            user_id: currentUser.id,
            category_id: categoryId,
            title: 'Blind Comparison',
            status: 'active'
        })
        .select()
        .single();

    if (compError) { showToast(compError.message, 'error'); return; }

    // Create blind session (server-side mapping)
    const sessionToken = crypto.randomUUID();
    const optionMapping = {};
    const labels = ['A', 'B', 'C'];

    // Shuffle items client-side for UI (server re-validates)
    const shuffled = [...items].sort(() => Math.random() - 0.5).slice(0, 3);
    shuffled.forEach((item, i) => {
        optionMapping[labels[i]] = item.id;
    });

    const { error: sessionError } = await supabase
        .from('comparison_sessions')
        .insert({
            comparison_id: comparison.id,
            user_id: currentUser.id,
            session_token: sessionToken,
            option_mapping: optionMapping,
            priorities: [],
            is_revealed: false
        });

    if (sessionError) { showToast(sessionError.message, 'error'); return; }

    currentComparison.sessionToken = sessionToken;
    currentComparison.options = shuffled;

    // Render blind options (no brand names!)
    renderBlindOptions(shuffled, labels);
    renderPriorities(shuffled[0]);

    document.getElementById('comparison-flow').classList.remove('hidden');
    document.getElementById('comparison-flow').scrollIntoView({ behavior: 'smooth' });
}

function renderBlindOptions(items, labels) {
    const grid = document.getElementById('options-grid');
    grid.innerHTML = '';
    items.forEach((item, i) => {
        const attrs = item.item_attributes || [];
        const card = document.createElement('div');
        card.className = 'option-card';
        card.innerHTML = `
            <h3>Option ${labels[i]}</h3>
            ${attrs.map(a => `
                <div class="attr-row">
                    <span class="label">${a.attribute_definitions?.name || ''}</span>
                    <span class="value">${a.value || a.numeric_value || '—'}</span>
                </div>
            `).join('')}
        `;
        grid.appendChild(card);
    });
}

function renderPriorities(item) {
    const list = document.getElementById('priority-list');
    list.innerHTML = '';
    const attrs = (item.item_attributes || []).filter(a => a.attribute_definitions?.is_priority_eligible);
    attrs.forEach((a, i) => {
        const div = document.createElement('div');
        div.className = 'priority-item';
        div.draggable = true;
        div.dataset.attributeId = a.attribute_id;
        div.innerHTML = `
            <span>${a.attribute_definitions.name}</span>
            <span class="drag-handle">☰</span>
        `;
        list.appendChild(div);
    });
    // Simple drag-and-drop
    let dragged;
    list.addEventListener('dragstart', e => { dragged = e.target; });
    list.addEventListener('dragover', e => e.preventDefault());
    list.addEventListener('drop', e => {
        e.preventDefault();
        if (e.target.classList.contains('priority-item') && dragged !== e.target) {
            const items = [...list.children];
            const fromIdx = items.indexOf(dragged);
            const toIdx = items.indexOf(e.target);
            if (fromIdx < toIdx) e.target.after(dragged);
            else e.target.before(dragged);
        }
    });
}

async function lockChoice() {
    if (!currentComparison.sessionToken) return;

    // Get priorities order
    const priorityItems = [...document.querySelectorAll('.priority-item')];
    const priorities = priorityItems.map((el, i) => ({
        attribute_id: el.dataset.attributeId,
        rank: i + 1
    }));

    // Update session with priorities
    await supabase
        .from('comparison_sessions')
        .update({ priorities })
        .eq('session_token', currentComparison.sessionToken);

    // For demo: auto-select first option (in real app, user selects)
    const chosenLabel = 'A';

    await supabase
        .from('comparison_choices')
        .insert({
            session_id: (await supabase.from('comparison_sessions')
                .select('id').eq('session_token', currentComparison.sessionToken).single()).data.id,
            chosen_option_label: chosenLabel,
            is_locked: true
        });

    // Reveal
    await revealResult(chosenLabel);
}

async function revealResult(label) {
    const { data: session } = await supabase
        .from('comparison_sessions')
        .select('*')
        .eq('session_token', currentComparison.sessionToken)
        .single();

    if (!session) return;

    const itemId = session.option_mapping[label];
    const { data: item } = await supabase
        .from('items')
        .select('*, brands(*), item_attributes(*, attribute_definitions(*))')
        .eq('id', itemId)
        .single();

    const revealContent = document.getElementById('reveal-content');
    revealContent.innerHTML = `
        <h3 style="font-size:1.5rem;margin-bottom:0.5rem;">${item.name}</h3>
        <p style="opacity:0.9;">Brand: ${item.brands?.name || 'Unknown'}</p>
        <p style="font-size:1.2rem;margin-top:1rem;">${item.currency} ${item.base_price?.toLocaleString() || '—'}</p>
    `;

    // Why I Chose
    const whySection = document.getElementById('why-i-chose');
    whySection.innerHTML = `
        <h4>Why I Chose This</h4>
        <p>You prioritized ${session.priorities?.map(p => p.attribute_id).join(', ') || 'key attributes'}.</p>
        <p>Your selected option performed strongly in these areas.</p>
    `;

    document.getElementById('reveal-section').classList.remove('hidden');
    document.getElementById('reveal-section').scrollIntoView({ behavior: 'smooth' });
}

async function saveDecision() {
    if (!currentUser) { openAuthModal(); return; }
    const { data: session } = await supabase
        .from('comparison_sessions')
        .select('*')
        .eq('session_token', currentComparison.sessionToken)
        .single();
    if (!session) return;

    await supabase.from('decision_memories').insert({
        user_id: currentUser.id,
        comparison_id: session.comparison_id,
        category_id: currentComparison.categoryId,
        title: 'My Decision',
        note: '',
        priorities: session.priorities
    });
    showToast('Decision saved to Memory!', 'success');
}

function shareResult() {
    const url = window.location.href;
    if (navigator.share) {
        navigator.share({ title: 'My CHOZ Decision', url });
    } else {
        navigator.clipboard.writeText(url);
        showToast('Link copied!', 'success');
    }
}

// Category click handler
document.getElementById('category-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.category-card');
    if (card) startComparison(card.dataset.categoryId);
});

// Load categories
async function loadCategories() {
    const { data } = await supabase.from('categories').select('*').eq('is_active', true).order('sort_order');
    const grid = document.getElementById('category-grid');
    if (!data) return;
    grid.innerHTML = data.map(c => `
        <div class="category-card" data-category-id="${c.id}">
            <span class="icon">${c.icon || '📦'}</span>
            <span class="name">${c.name}</span>
        </div>
    `).join('');
}

loadCategories();
