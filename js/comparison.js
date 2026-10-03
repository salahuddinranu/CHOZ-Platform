// ============================================================
// CHOZ BLIND COMPARISON ENGINE
// ============================================================

let currentComparison = { categoryId: null, options: [], labels: [], priorities: [], choice: null };

async function startComparison(categoryId) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { openAuth(); return; }

  currentComparison.categoryId = categoryId;

  // Fetch items with attributes
  const { data: items, error } = await sb
    .from('items')
    .select('*, brands(name), item_attributes(*, attribute_definitions(name, slug, unit))')
    .eq('category_id', categoryId)
    .eq('is_active', true);

  if (error || !items || items.length < 2) {
    alert('Not enough items in this category yet.');
    return;
  }

  // Shuffle and pick 3
  const shuffled = [...items].sort(() => Math.random() - 0.5).slice(0, 3);
  const labels = ['A', 'B', 'C'];
  currentComparison.options = shuffled;
  currentComparison.labels = labels;
  currentComparison.choice = null;
  currentComparison.priorities = [];

  renderComparisonModal();
}

function renderComparisonModal() {
  const modal = document.getElementById('compModal');
  const content = document.getElementById('compContent');
  const { options, labels } = currentComparison;
  const categoryName = options[0]?.category_id?.replace('cat-', '') || 'Comparison';

  content.innerHTML = `
    <div class="comp-header">
      <h3 style="font-family:'Bricolage Grotesque';font-size:22px">Blind Comparison</h3>
      <span class="badge">${options.length} anonymous options</span>
    </div>
    <p style="color:var(--mute);font-size:14px;margin-bottom:16px">
      Brand names are hidden. Pick the option that matches your priorities.
    </p>
    <div class="options-grid" id="optionsGrid">
      ${options.map((item, i) => {
        const attrs = (item.item_attributes || []).slice(0, 5);
        return `
          <div class="option-card" data-idx="${i}" onclick="selectOption(${i})">
            <h3>Option ${labels[i]}</h3>
            ${attrs.map(a => `
              <div class="attr-row">
                <span class="label">${a.attribute_definitions?.name || ''}</span>
                <span class="value">${a.value || a.numeric_value || '—'}${a.attribute_definitions?.unit ? ' ' + a.attribute_definitions.unit : ''}</span>
              </div>
            `).join('') || '<p style="color:var(--mute);font-size:13px">No attributes available</p>'}
          </div>
        `;
      }).join('')}
    </div>
    <button class="btn p" style="width:100%;padding:14px" id="lockBtn" onclick="lockChoice()" disabled>
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
  lockBtn.textContent = 'Lock choice & reveal';
}

async function lockChoice() {
  if (currentComparison.choice === null) return;

  const chosenIdx = currentComparison.choice;
  const chosenItem = currentComparison.options[chosenIdx];
  const chosenLabel = currentComparison.labels[chosenIdx];

  // Fetch full details of chosen item
  const { data: fullItem } = await sb
    .from('items')
    .select('*, brands(*), item_attributes(*, attribute_definitions(*))')
    .eq('id', chosenItem.id)
    .single();

  // Save comparison to database
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    await sb.from('comparisons').insert({
      user_id: session.user.id,
      category_id: currentComparison.categoryId,
      title: 'Comparison',
      status: 'completed',
      completed_at: new Date().toISOString()
    });
  }

  renderReveal(fullItem, chosenLabel);
}

function renderReveal(item, label) {
  const content = document.getElementById('compContent');
  const attrs = item.item_attributes || [];

  content.innerHTML = `
    <div class="reveal-card">
      <h2>🎉 Revealed</h2>
      <p style="opacity:0.9">You chose Option ${label}</p>
      <div class="item-name">${item.name}</div>
      <div class="brand-name">${item.brands?.name || 'Unknown brand'}</div>
      <div class="price">${item.currency} ${item.base_price?.toLocaleString() || '—'}</div>
    </div>

    <div class="why-section" style="background:var(--acbg);color:var(--ink)">
      <h4>Why I Chose This</h4>
      <p>You selected this option from ${currentComparison.options.length} anonymous choices.</p>
      <p><strong>Key attributes of your choice:</strong></p>
      <ul>
        ${attrs.slice(0, 6).map(a => `
          <li><strong>${a.attribute_definitions?.name}:</strong> ${a.value || a.numeric_value || '—'}${a.attribute_definitions?.unit ? ' ' + a.attribute_definitions.unit : ''}</li>
        `).join('')}
      </ul>
      <p style="margin-top:12px;font-size:13px;color:var(--mute)">
        <em>Note: This explanation is generated from stored data. No AI fabrication.</em>
      </p>
    </div>

    <div class="reveal-actions">
      <button class="btn p" onclick="saveDecision('${item.id}')">💾 Save Decision Memory</button>
      <button class="btn" onclick="shareResult()">🔗 Share Result</button>
      <button class="btn" onclick="closeCompModal()">Close</button>
    </div>
  `;
}

async function saveDecision(itemId) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { openAuth(); return; }

  const item = currentComparison.options[currentComparison.choice];
  await sb.from('decision_memories').insert({
    user_id: session.user.id,
    category_id: currentComparison.categoryId,
    chosen_item_id: itemId,
    title: `I chose ${item.name}`,
    note: '',
    priorities: currentComparison.priorities || []
  });

  alert('Decision saved to your memory!');
}

function shareResult() {
  const url = window.location.href;
  if (navigator.share) {
    navigator.share({ title: 'My CHOZ Decision', url });
  } else {
    navigator.clipboard.writeText(url);
    alert('Link copied!');
  }
}

function closeCompModal() {
  document.getElementById('compModal').classList.add('hidden');
  currentComparison = { categoryId: null, options: [], labels: [], priorities: [], choice: null };
}

// Load categories on page
async function loadCategories() {
  const grid = document.getElementById('catGrid');
  const { data: cats, error } = await sb.from('categories').select('*').eq('is_active', true).order('sort_order');

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

// Bind modal close
document.addEventListener('DOMContentLoaded', () => {
  const compModal = document.getElementById('compModal');
  const closeComp = document.getElementById('closeComp');
  if (closeComp) closeComp.onclick = closeCompModal;
  if (compModal) compModal.addEventListener('click', (e) => {
    if (e.target.id === 'compModal') closeCompModal();
  });
});
