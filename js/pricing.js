/**
 * pricing.js — Dynamic pricing database CRUD + schema management
 *
 * The table columns, form fields, and import format are all driven by the
 * pricing_schema API so administrators can add/edit/rename/remove fields
 * at runtime without touching code.
 */

let _editingPricingId = null;
let _pricingCurrentPage = 1;
let _pricingPageSize = 25;
let _pricingTotalRecords = 0;

/** Cached schema fields (populated by _loadSchema) */
let _pricingSchema = [];
let _pricingSchemaVersion = 0;

// ──────────────────────────────────────────────────────────────────────────────
// Schema loader
// ──────────────────────────────────────────────────────────────────────────────

async function _loadSchema() {
  try {
    const data = await adminFetch('/pricing/schema');
    _pricingSchema = data.fields || [];
    _pricingSchemaVersion = data.schema_version || 0;
  } catch (err) {
    console.warn('Failed to load pricing schema, using fallback:', err);
    _pricingSchema = [
      { name: 'product_name', display_label: 'Product Name', data_type: 'text', is_required: true, format_hint: null, sort_order: 1 },
      { name: 'sku', display_label: 'SKU', data_type: 'text', is_required: false, format_hint: null, sort_order: 2 },
      { name: 'price', display_label: 'Price', data_type: 'real', is_required: true, format_hint: 'currency', sort_order: 3 },
      { name: 'currency', display_label: 'Currency', data_type: 'text', is_required: false, format_hint: null, default_value: 'IDR', sort_order: 4 },
      { name: 'unit', display_label: 'Unit', data_type: 'text', is_required: false, format_hint: null, default_value: 'unit', sort_order: 5 },
      { name: 'category', display_label: 'Category', data_type: 'text', is_required: false, format_hint: 'badge', sort_order: 6 },
      { name: 'description', display_label: 'Description', data_type: 'text', is_required: false, format_hint: 'textarea', sort_order: 7 },
    ];
    _pricingSchemaVersion = 0;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Build a JSON sample string from current schema */
function _buildJsonSample() {
  const obj = {};
  _pricingSchema.forEach(f => {
    if (f.data_type === 'real' || f.data_type === 'integer') {
      obj[f.name] = f.is_required ? 100000 : 0;
    } else if (f.data_type === 'boolean') {
      obj[f.name] = false;
    } else {
      obj[f.name] = f.default_value || (f.is_required ? f.display_label : '');
    }
  });
  return JSON.stringify([obj], null, 2);
}

/** Format a cell value for table display */
function _formatCell(field, value) {
  if (value === null || value === undefined || value === '') return '<span class="text-muted">—</span>';
  const hint = field.format_hint;
  switch (field.data_type) {
    case 'real':
    case 'integer':
      if (hint === 'currency') {
        return `<strong>${Number(value).toLocaleString('id-ID')}</strong>`;
      }
      return esc(String(value));
    case 'boolean':
      return value ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-warning">No</span>';
    default:
      if (hint === 'badge') {
        return `<span class="badge badge-info">${esc(value)}</span>`;
      }
      if (hint === 'textarea') {
        const short = String(value).length > 80 ? String(value).slice(0, 80) + '…' : String(value);
        return esc(short);
      }
      return esc(String(value));
  }
}

/** Generate a form input for a schema field */
function _fieldInput(field, value) {
  const id = `pm-${field.name}`;
  const required = field.is_required ? 'required' : '';
  const val = value ?? field.default_value ?? '';
  const star = field.is_required ? ' <span style="color:var(--danger)">*</span>' : '';

  let input;
  switch (field.data_type) {
    case 'real':
      input = `<input class="form-control" id="${id}" type="number" step="0.01" placeholder="e.g. 250000000" value="${esc(val)}" ${required} />`;
      break;
    case 'integer':
      input = `<input class="form-control" id="${id}" type="number" step="1" placeholder="0" value="${esc(val)}" ${required} />`;
      break;
    case 'boolean':
      const checked = (val === true || val === 1 || val === '1' || val === 'true') ? 'checked' : '';
      input = `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" id="${id}" ${checked} /> ${esc(field.display_label)}</label>`;
      return `<div class="form-group">${input}</div>`;
    default:
      if (field.format_hint === 'textarea') {
        input = `<textarea class="form-control" id="${id}" rows="3" placeholder="${esc(field.display_label)}…" style="resize:vertical;" ${required}>${esc(val)}</textarea>`;
      } else {
        input = `<input class="form-control" id="${id}" placeholder="${esc(field.display_label)}" value="${esc(val)}" ${required} />`;
      }
  }
  return `<div class="form-group"><label class="form-label">${esc(field.display_label)}${star}</label>${input}</div>`;
}

/** Collect form values from dynamic modal fields */
function _collectFormValues() {
  const payload = {};
  for (const f of _pricingSchema) {
    const el = document.getElementById(`pm-${f.name}`);
    if (!el) continue;
    if (f.data_type === 'boolean') {
      payload[f.name] = el.checked ? 1 : 0;
    } else if (f.data_type === 'real') {
      const v = el.value.trim();
      payload[f.name] = v === '' ? null : parseFloat(v);
    } else if (f.data_type === 'integer') {
      const v = el.value.trim();
      payload[f.name] = v === '' ? null : parseInt(v, 10);
    } else {
      payload[f.name] = el.value.trim() || null;
    }
  }
  return payload;
}

function _initPricingRoleButtons() {
  try {
    const user = JSON.parse(sessionStorage.getItem('admin_user') || '{}');
    if (user.role === 'superadmin') {
      const vdbBtn = document.getElementById('btnPricingVectorViewer');
      if (vdbBtn) vdbBtn.style.display = '';
      const schemaBtn = document.getElementById('btnSchemaEditor');
      if (schemaBtn) schemaBtn.style.display = '';
    }
  } catch (_) {}
}

// ──────────────────────────────────────────────────────────────────────────────
// Main renderer
// ──────────────────────────────────────────────────────────────────────────────

async function renderPricing() {
  const body = document.getElementById('pageBody');
  await _loadSchema();

  const thCells = _pricingSchema.map(f => `<th>${esc(f.display_label)}</th>`).join('');
  const colSpan = _pricingSchema.length + 2;

  body.innerHTML = `
    <!-- Tabs Navigation -->
    <div class="card" style="margin-bottom:20px;">
      <div style="border-bottom:1px solid var(--border);padding:0;">
        <div style="display:flex;gap:0;">
          <button class="pricing-tab active" data-tab="records" onclick="_switchPricingTab('records')" style="
            padding:12px 20px;border:none;background:transparent;cursor:pointer;
            font-weight:600;font-size:14px;color:var(--primary,#0ea5e9);
            border-bottom:2px solid var(--primary,#0ea5e9);transition:all 0.2s;
          ">
            Records
          </button>
          <span style="color:var(--border);padding:12px 0;font-size:14px;">|</span>
          <button class="pricing-tab" data-tab="intent" onclick="_switchPricingTab('intent')" style="
            padding:12px 20px;border:none;background:transparent;cursor:pointer;
            font-weight:500;font-size:14px;color:var(--text-muted);
            border-bottom:2px solid transparent;transition:all 0.2s;
          ">
            Intent Rules
          </button>
        </div>
      </div>

      <!-- Tab: Records -->
      <div class="pricing-tab-content" data-tab="records" style="display:block;">
        <div class="card-header">
          <span class="card-title">Pricing Records <small style="color:var(--text-muted);font-weight:normal;font-size:12px;">schema v${_pricingSchemaVersion}</small></span>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <input class="form-control" type="text" id="pricingSearch" placeholder="Search…" style="width:180px;"
              oninput="debouncedPricingSearch()" />
            <select class="form-control" id="pricingCategory" style="width:150px;" onchange="resetPricingPage(); loadPricing()">
              <option value="">All categories</option>
            </select>
            <select class="form-control" id="pricingPageSize" style="width:100px;" onchange="resetPricingPage(); loadPricing()">
              <option value="25" selected>25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="150">150</option>
            </select>
            <button class="btn btn-primary btn-sm" onclick="openPricingModal()">＋ Add Record</button>
            <button class="btn btn-secondary btn-sm" onclick="openImportModal()">📥 Import</button>
            <button class="btn btn-secondary btn-sm" onclick="exportPricingData()">📤 Export</button>
            <button class="btn btn-secondary btn-sm" onclick="syncPricingVectorDB()">🔄 Sync VectorDB</button>
            <button class="btn btn-secondary btn-sm" onclick="openVectorDBViewer('pricing_database_kbc')" id="btnPricingVectorViewer" style="display:none;">🔍 View VectorDB</button>
            <button class="btn btn-secondary btn-sm" id="btnSchemaEditor" style="display:none;" onclick="window._pricingSchemaEditor && window._pricingSchemaEditor.open()">⚙️ Schema</button>
            <button class="btn btn-secondary btn-sm" onclick="loadPricing()">🔄 Refresh</button>
            <button class="btn btn-danger btn-sm" onclick="truncatePricingTable()">🗑️ Empty database</button>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                ${thCells}
                <th>Sync</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="pricingTableBody">
              <tr><td colspan="${colSpan}" style="text-align:center;padding:24px;color:var(--text-muted);">Loading…</td></tr>
            </tbody>
          </table>
        </div>
        <div style="padding:12px 16px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div style="font-size:12px;color:var(--text-muted);" id="pricingFooter"></div>
          <div id="pricingPagination" style="display:flex;gap:4px;align-items:center;"></div>
        </div>
      </div>

      <!-- Tab: Intent Rules -->
      <div class="pricing-tab-content" data-tab="intent" style="display:none;">
        <div class="card-header">
          <span class="card-title">Pricing — Intent Trigger Rules</span>
        </div>
        <div class="card-body" id="pricingIntentRulesContainer"></div>
      </div>
    </div>

    <!-- Pricing Modal (dynamic fields) -->
    <div class="modal-overlay hidden" id="pricingModal">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title" id="pricingModalTitle">Add Pricing Record</span>
          <button class="modal-close" onclick="closePricingModal()">×</button>
        </div>
        <div class="modal-body" id="pricingModalBody">
          <!-- populated dynamically by openPricingModal -->
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closePricingModal()">Cancel</button>
          <button class="btn btn-primary" id="pricingModalSaveBtn" onclick="savePricingRecord()">Save Record</button>
        </div>
      </div>
    </div>

    <!-- Import Modal -->
    <div class="modal-overlay hidden" id="importModal">
      <div class="modal" style="max-width:700px;">
        <div class="modal-header">
          <span class="modal-title">📥 Import Pricing Data</span>
          <button class="modal-close" onclick="closeImportModal()">×</button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom:16px;">
            <div style="display:flex;gap:8px;margin-bottom:12px;">
              <button class="btn btn-secondary btn-sm" id="importTabFile" onclick="switchImportTab('file')" style="flex:1;">File Upload</button>
              <button class="btn btn-secondary btn-sm" id="importTabText" onclick="switchImportTab('text')" style="flex:1;">Paste JSON</button>
            </div>
          </div>

          <!-- File Upload Tab -->
          <div id="importFileTab">
            <div class="form-group">
              <label class="form-label">Upload JSON File</label>
              <input type="file" class="form-control" id="jsonFileInput" accept=".json" />
              <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">
                Select a .json file containing an array of pricing records
              </div>
            </div>
          </div>

          <!-- Text Area Tab -->
          <div id="importTextTab" class="hidden">
            <div class="form-group">
              <label class="form-label">Paste JSON Data</label>
              <textarea class="form-control" id="jsonTextInput" rows="12" placeholder="" style="font-family:monospace;font-size:12px;resize:vertical;"></textarea>
              <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">
                Required fields: ${_pricingSchema.filter(f => f.is_required).map(f => '<code>' + f.name + '</code>').join(', ') || 'none'}
              </div>
            </div>
          </div>

          <div class="form-group">
            <details style="font-size:13px;color:var(--text-muted);">
              <summary style="cursor:pointer;margin-bottom:8px;font-weight:500;">Expected JSON Format</summary>
              <pre style="background:var(--bg-secondary);padding:12px;border-radius:4px;overflow-x:auto;"><code>${esc(_buildJsonSample())}</code></pre>
            </details>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeImportModal()">Cancel</button>
          <button class="btn btn-primary" id="importBtn" onclick="importJSON()">Import</button>
        </div>
      </div>
    </div>

    <!-- Schema Editor Modals (injected by SchemaEditor class) -->
  `;

  // Initialize shared schema editor (if not already created)
  if (!window._pricingSchemaEditor) {
    window._pricingSchemaEditor = new SchemaEditor({
      id:               'pricing',
      apiPrefix:        'pricing',
      entityLabel:      'Pricing',
      entityIcon:       '💰',
      getSchema:        () => _pricingSchema,
      getSchemaVersion: () => _pricingSchemaVersion,
      loadSchema:       _loadSchema,
      onClose:          () => renderPricing(),
      formatHintOptions: [
        { value: '',         label: '(default)' },
        { value: 'currency', label: 'currency — bold locale-formatted number' },
        { value: 'badge',    label: 'badge — coloured tag pill' },
        { value: 'textarea', label: 'textarea — multiline text input' },
      ],
    });
  }
  window._pricingSchemaEditor.injectModals(document.body);

  // Set dynamic import placeholder
  const jsonTextInput = document.getElementById('jsonTextInput');
  if (jsonTextInput) jsonTextInput.placeholder = _buildJsonSample();

  // Render intent rules in its container
  const intentContainer = document.getElementById('pricingIntentRulesContainer');
  if (intentContainer) {
    intentContainer.innerHTML = `
      <p style="font-size:13px;color:var(--text-muted);margin:0 0 12px;">
        These keywords guide the AI intent classifier to recognise
        <strong>pricing</strong>-related queries.
        Click <strong>×</strong> on a tag to remove it. Type a keyword below and press
        <kbd style="font-size:11px;padding:1px 5px;border:1px solid var(--border);border-radius:3px;">Enter</kbd>
        or <kbd style="font-size:11px;padding:1px 5px;border:1px solid var(--border);border-radius:3px;">,</kbd>
        to add. Changes take effect immediately — no restart required.
      </p>

      <div id="intentChips_pricing" onclick="_intentFocusInput('intentKwInput_pricing')" style="
        display:flex;flex-wrap:wrap;gap:6px;align-items:center;
        min-height:44px;padding:8px 10px;
        border:1px solid var(--border);border-radius:8px;
        background:var(--card-bg,#fff);cursor:text;
      ">
        <input
          id="intentKwInput_pricing"
          type="text"
          placeholder="Add keyword…"
          autocomplete="off"
          style="
            border:none;outline:none;background:transparent;
            font-size:13px;min-width:140px;flex:1;padding:2px 4px;
            color:var(--text-primary);
          "
          onkeydown="_intentInputKeydown(event,'pricing','intentChips_pricing','intentKwInput_pricing')"
          onblur="_intentInputBlur('pricing','intentChips_pricing','intentKwInput_pricing')"
        />
      </div>
      <small style="color:var(--text-muted);font-size:12px;margin-top:4px;display:block;">
        Press <strong>Enter</strong> or <strong>,</strong> to confirm. Backspace on empty input removes the last tag.
      </small>

      <div style="display:flex;align-items:center;gap:12px;margin-top:14px;">
        <button class="btn btn-primary btn-sm" onclick="_saveIntentRules('pricing','intentRulesStatus_pricing')">
          💾 Save Keywords
        </button>
        <button class="btn btn-secondary btn-sm" onclick="_resetIntentRules('pricing','intentChips_pricing','intentKwInput_pricing','intentRulesStatus_pricing')">
          ↩ Reset to Default
        </button>
        <span id="intentRulesStatus_pricing" style="font-size:12px;color:var(--text-muted);"></span>
      </div>
    `;
    _loadIntentRules('pricing', 'intentChips_pricing', 'intentKwInput_pricing');
  }

  await Promise.all([loadPricingCategories(), loadPricing()]);
  _initPricingRoleButtons();
}

// ──────────────────────────────────────────────────────────────────────────────
// Search, Pagination, Categories
// ──────────────────────────────────────────────────────────────────────────────

let _pricingSearchTimer;
function debouncedPricingSearch() {
  clearTimeout(_pricingSearchTimer);
  _pricingSearchTimer = setTimeout(() => { resetPricingPage(); loadPricing(); }, 300);
}

function resetPricingPage() { _pricingCurrentPage = 1; }

async function loadPricingCategories() {
  try {
    const data = await apiFetch('/pricing/categories');
    const sel = document.getElementById('pricingCategory');
    if (!sel) return;
    (data.categories || []).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      sel.appendChild(opt);
    });
  } catch (_) {}
}

// ──────────────────────────────────────────────────────────────────────────────
// Load pricing data (dynamic columns)
// ──────────────────────────────────────────────────────────────────────────────

async function loadPricing() {
  const cols = _pricingSchema;
  const colSpan = cols.length + 2;
  const tbody = document.getElementById('pricingTableBody');
  const footer = document.getElementById('pricingFooter');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center;padding:24px;color:var(--text-muted);">Loading…</td></tr>`;

  try {
    const query = document.getElementById('pricingSearch')?.value.trim() || '';
    const cat = document.getElementById('pricingCategory')?.value || '';
    const pageSizeSelect = document.getElementById('pricingPageSize');
    _pricingPageSize = pageSizeSelect ? parseInt(pageSizeSelect.value) : 25;

    let data;
    if (query) {
      data = await apiFetch('/pricing/search', {
        method: 'POST',
        body: JSON.stringify({ query, category: cat || undefined, limit: 1000 }),
      });
      data.records = data.results || [];
    } else {
      const params = new URLSearchParams({ limit: 10000 });
      if (cat) params.set('category', cat);
      data = await apiFetch(`/pricing?${params}`);
    }

    const allRecords = data.records || [];
    _pricingTotalRecords = allRecords.length;
    const totalPages = Math.ceil(_pricingTotalRecords / _pricingPageSize);
    if (_pricingCurrentPage > totalPages && totalPages > 0) _pricingCurrentPage = totalPages;

    const startIdx = (_pricingCurrentPage - 1) * _pricingPageSize;
    const endIdx = startIdx + _pricingPageSize;
    const records = allRecords.slice(startIdx, endIdx);

    if (footer) {
      const start = _pricingTotalRecords === 0 ? 0 : startIdx + 1;
      const end = Math.min(endIdx, _pricingTotalRecords);
      footer.textContent = `Showing ${start}-${end} of ${_pricingTotalRecords} record${_pricingTotalRecords !== 1 ? 's' : ''}`;
    }
    renderPricingPagination(totalPages);

    if (!records.length) {
      tbody.innerHTML = `<tr><td colspan="${colSpan}"><div class="empty-state"><div class="empty-icon">❌</div><p>No pricing records found.</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = records.map(r => {
      const cells = cols.map(f => `<td>${_formatCell(f, r[f.name])}</td>`).join('');
      const syncBadge = r.vectordb_synced
        ? '<span class="badge badge-success" style="font-size:10px;">✓ Synced</span>'
        : '<span class="badge badge-warning" style="font-size:10px;">⏳ Pending</span>';
      const displayName = r[cols[0]?.name] || r.id;
      return `<tr>${cells}<td>${syncBadge}</td><td><div class="td-actions">
        <button class="btn btn-secondary btn-sm btn-icon" title="Edit" onclick="editPricingRecord(${r.id})">✏️</button>
        <button class="btn btn-danger btn-sm btn-icon" title="Delete" onclick="deletePricingRecord(${r.id}, '${esc(displayName)}')">🗑️</button>
      </div></td></tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="${colSpan}" style="color:var(--danger);padding:16px;">${err.message}</td></tr>`;
    showToast(err.message, 'error');
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// CRUD Modal (dynamic form)
// ──────────────────────────────────────────────────────────────────────────────

function openPricingModal(record = null) {
  _editingPricingId = record?.id ?? null;
  document.getElementById('pricingModalTitle').textContent = record ? 'Edit Pricing Record' : 'Add Pricing Record';

  const modalBody = document.getElementById('pricingModalBody');
  let html = '';
  let row = [];
  for (const f of _pricingSchema) {
    const isLong = f.format_hint === 'textarea' || f.data_type === 'boolean';
    if (isLong) {
      if (row.length) { html += `<div class="form-row">${row.join('')}</div>`; row = []; }
      html += _fieldInput(f, record?.[f.name]);
    } else {
      row.push(_fieldInput(f, record?.[f.name]));
      if (row.length === 2) { html += `<div class="form-row">${row.join('')}</div>`; row = []; }
    }
  }
  if (row.length) html += `<div class="form-row">${row.join('')}</div>`;
  modalBody.innerHTML = html;
  document.getElementById('pricingModal').classList.remove('hidden');
}

function closePricingModal() {
  document.getElementById('pricingModal').classList.add('hidden');
  _editingPricingId = null;
}

async function editPricingRecord(id) {
  try {
    const data = await apiFetch(`/pricing/${id}`);
    openPricingModal(data.record || data);
  } catch (err) { showToast(err.message, 'error'); }
}

async function savePricingRecord() {
  const payload = _collectFormValues();
  for (const f of _pricingSchema) {
    if (f.is_required) {
      const v = payload[f.name];
      if (v === null || v === undefined || v === '' || (typeof v === 'number' && isNaN(v))) {
        showToast(`${f.display_label} is required`, 'warning');
        return;
      }
    }
  }

  const btn = document.getElementById('pricingModalSaveBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    if (_editingPricingId) {
      await apiFetch(`/pricing/${_editingPricingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Record updated', 'success');
    } else {
      await apiFetch('/pricing', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Record created', 'success');
    }
    closePricingModal();
    await loadPricing();
  } catch (err) { showToast(err.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Save Record'; }
}

async function deletePricingRecord(id, name) {
  if (!confirm(`Delete pricing record "${name}"?`)) return;
  try {
    await apiFetch(`/pricing/${id}`, { method: 'DELETE' });
    showToast('Record deleted', 'success');
    await loadPricing();
  } catch (err) { showToast(err.message, 'error'); }
}

// ──────────────────────────────────────────────────────────────────────────────
// Import
// ──────────────────────────────────────────────────────────────────────────────

function openImportModal() {
  document.getElementById('importModal').classList.remove('hidden');
  switchImportTab('file');
}

function closeImportModal() {
  document.getElementById('importModal').classList.add('hidden');
  const fi = document.getElementById('jsonFileInput'); if (fi) fi.value = '';
  const ti = document.getElementById('jsonTextInput'); if (ti) ti.value = '';
}

function switchImportTab(tab) {
  const fileTab = document.getElementById('importFileTab');
  const textTab = document.getElementById('importTextTab');
  const fileBtn = document.getElementById('importTabFile');
  const textBtn = document.getElementById('importTabText');
  if (tab === 'file') {
    fileTab.classList.remove('hidden'); textTab.classList.add('hidden');
    fileBtn.classList.add('btn-primary'); fileBtn.classList.remove('btn-secondary');
    textBtn.classList.remove('btn-primary'); textBtn.classList.add('btn-secondary');
  } else {
    fileTab.classList.add('hidden'); textTab.classList.remove('hidden');
    textBtn.classList.add('btn-primary'); textBtn.classList.remove('btn-secondary');
    fileBtn.classList.remove('btn-primary'); fileBtn.classList.add('btn-secondary');
  }
}

async function importJSON() {
  const fileInput = document.getElementById('jsonFileInput');
  const textInput = document.getElementById('jsonTextInput');
  const btn = document.getElementById('importBtn');
  let jsonData;
  try {
    if (!document.getElementById('importFileTab').classList.contains('hidden')) {
      if (!fileInput.files.length) { showToast('Please select a JSON file', 'warning'); return; }
      jsonData = JSON.parse(await fileInput.files[0].text());
    } else {
      const text = textInput.value.trim();
      if (!text) { showToast('Please paste JSON data', 'warning'); return; }
      jsonData = JSON.parse(text);
    }
    // Accept both plain array and wrapped envelope {_schema_version, records:[...]}
    const isEnvelope = jsonData && !Array.isArray(jsonData) && Array.isArray(jsonData.records);
    const recordCount = isEnvelope ? jsonData.records.length : (Array.isArray(jsonData) ? jsonData.length : 0);
    if (!recordCount) { showToast('No records found in JSON data', 'warning'); return; }
    if (!confirm(`Import ${recordCount} record(s)?`)) return;

    btn.disabled = true; btn.textContent = 'Importing…';
    const response = await apiFetch('/pricing/import-json', { method: 'POST', body: JSON.stringify(jsonData) });
    let msg = response.message || 'Import successful';
    if (response.version_mismatch) msg += ' ⚠️ Schema version mismatch — matched fields only.';
    if (response.ignored_fields && response.ignored_fields.length) msg += ` Ignored: ${response.ignored_fields.join(', ')}.`;
    showToast(msg, response.version_mismatch ? 'warning' : 'success');
    closeImportModal();
    await loadPricing();
  } catch (err) {
    showToast(err instanceof SyntaxError ? 'Invalid JSON format' : (err.message || 'Import failed'), 'error');
  } finally { btn.disabled = false; btn.textContent = 'Import'; }
}

// ──────────────────────────────────────────────────────────────────────────────
// Pagination
// ──────────────────────────────────────────────────────────────────────────────

function renderPricingPagination(totalPages) {
  const pagination = document.getElementById('pricingPagination');
  if (!pagination) return;
  if (totalPages <= 1) { pagination.innerHTML = ''; return; }

  let html = `
    <button class="btn btn-secondary btn-sm" onclick="changePricingPage(1)" ${_pricingCurrentPage === 1 ? 'disabled' : ''}>«</button>
    <button class="btn btn-secondary btn-sm" onclick="changePricingPage(${_pricingCurrentPage - 1})" ${_pricingCurrentPage === 1 ? 'disabled' : ''}>‹</button>
  `;
  const maxBtns = 5;
  let sp = Math.max(1, _pricingCurrentPage - Math.floor(maxBtns / 2));
  let ep = Math.min(totalPages, sp + maxBtns - 1);
  if (ep - sp < maxBtns - 1) sp = Math.max(1, ep - maxBtns + 1);
  if (sp > 1) { html += `<button class="btn btn-secondary btn-sm" onclick="changePricingPage(1)">1</button>`; if (sp > 2) html += '<span style="padding:0 4px;color:var(--text-muted);">…</span>'; }
  for (let i = sp; i <= ep; i++) html += `<button class="btn btn-${i === _pricingCurrentPage ? 'primary' : 'secondary'} btn-sm" onclick="changePricingPage(${i})">${i}</button>`;
  if (ep < totalPages) { if (ep < totalPages - 1) html += '<span style="padding:0 4px;color:var(--text-muted);">…</span>'; html += `<button class="btn btn-secondary btn-sm" onclick="changePricingPage(${totalPages})">${totalPages}</button>`; }
  html += `
    <button class="btn btn-secondary btn-sm" onclick="changePricingPage(${_pricingCurrentPage + 1})" ${_pricingCurrentPage === totalPages ? 'disabled' : ''}>›</button>
    <button class="btn btn-secondary btn-sm" onclick="changePricingPage(${totalPages})" ${_pricingCurrentPage === totalPages ? 'disabled' : ''}>»</button>
  `;
  pagination.innerHTML = html;
}

function changePricingPage(page) {
  const totalPages = Math.ceil(_pricingTotalRecords / _pricingPageSize);
  if (page < 1 || page > totalPages) return;
  _pricingCurrentPage = page;
  loadPricing();
}

// ──────────────────────────────────────────────────────────────────────────────
// Truncate / Export / Sync VectorDB
// ──────────────────────────────────────────────────────────────────────────────

async function truncatePricingTable() {
  if (!confirm('⚠️ WARNING: This will DELETE ALL pricing records.\n\nThis action CANNOT be undone.')) return;
  if (!confirm('⚠️ FINAL CONFIRMATION\n\nClick OK to permanently delete ALL pricing data.')) return;
  try {
    const response = await apiFetch('/pricing/truncate', { method: 'DELETE' });
    showToast(response.message || 'All pricing records deleted', 'success');
    resetPricingPage(); await loadPricing();
  } catch (err) { showToast(err.message || 'Failed to clear pricing table', 'error'); }
}

async function exportPricingData() {
  try {
    showToast('Exporting pricing data...', 'info');
    const data = await apiFetch('/pricing/export?limit=10000');
    if (!data.records || !data.records.length) { showToast('No pricing records to export', 'warning'); return; }
    // The envelope already contains _schema_version, _exported_at, _field_names
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pricing-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast(`Exported ${data.records.length} records (schema v${data._schema_version})`, 'success');
  } catch (err) { showToast(err.message || 'Failed to export pricing data', 'error'); }
}

async function syncPricingVectorDB() {
  if (!confirm('Sync all pricing records to VectorDB?\n\nExisting pricing vectors will be replaced.')) return;
  try {
    showToast('Syncing to VectorDB…', 'info');
    const response = await apiFetch('/pricing/sync-vectordb', { method: 'POST' });
    showToast(response.message || `Synced ${response.records_synced} records`, 'success');
    loadPricing();
  } catch (err) { showToast(err.message || 'VectorDB sync failed', 'error'); }
}

// ══════════════════════════════════════════════════════════════════════════════
// Schema Editor — moved to pricing-schema.js
// Functions openSchemaEditor, closeSchemaEditor, openAddFieldModal,
// openEditFieldModal, closeFieldModal, saveField, openRenameFieldModal,
// closeRenameFieldModal, saveRenameField, removeField are defined there.
// ══════════════════════════════════════════════════════════════════════════════

async function _renderRoutingBanner(bannerId, badgeSpanId, settingKey, label, offDescription) {
  try {
    const data = await adminFetch('/settings/llm');
    const enabled = data[settingKey] !== false;

    // Small inline badge in card header
    const span = document.getElementById(badgeSpanId);
    if (span) {
      span.innerHTML = enabled
        ? '<span style="display:inline-flex;align-items:center;gap:4px;background:#dcfce7;color:#16a34a;font-weight:700;font-size:11px;padding:3px 10px;border-radius:8px;border:1px solid #86efac;">&#x2705; Routing: ON</span>'
        : '<span style="display:inline-flex;align-items:center;gap:4px;background:#fee2e2;color:#dc2626;font-weight:700;font-size:11px;padding:3px 10px;border-radius:8px;border:1px solid #fca5a5;">&#x26D4; Routing: OFF</span>';
    }

    // Full banner above the card
    const banner = document.getElementById(bannerId);
    if (!banner) return;
    if (enabled) {
      banner.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:10px 16px;margin-bottom:14px;">
          <span style="font-size:20px;">&#x2705;</span>
          <div style="flex:1;">
            <strong style="color:#15803d;">${label} routing is <u>enabled</u></strong>
            <span style="color:#166534;font-size:13px;margin-left:6px;">— queries are being routed to this data source.</span>
          </div>
          <button class="btn btn-sm" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;font-weight:600;"
            onclick="_toggleRoutingFromBanner('${bannerId}','${badgeSpanId}','${settingKey}','${label}','${offDescription}')">&#x23FD; Disable</button>
        </div>`;
    } else {
      banner.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;background:#fef2f2;border:1.5px solid #fca5a5;border-radius:10px;padding:10px 16px;margin-bottom:14px;">
          <span style="font-size:20px;">&#x26D4;</span>
          <div style="flex:1;">
            <strong style="color:#dc2626;">${label} routing is <u>disabled</u></strong>
            <span style="color:#991b1b;font-size:13px;margin-left:6px;">— ${offDescription}</span>
          </div>
          <button class="btn btn-sm" style="background:#dcfce7;color:#16a34a;border:1px solid #86efac;font-weight:600;"
            onclick="_toggleRoutingFromBanner('${bannerId}','${badgeSpanId}','${settingKey}','${label}','${offDescription}')">&#x25B6; Enable</button>
        </div>`;
    }
  } catch (_) {}
}

async function _toggleRoutingFromBanner(bannerId, badgeSpanId, settingKey, label, offDescription) {
  try {
    const data = await adminFetch('/settings/llm');
    const current = data[settingKey] !== false;
    const payload = {};
    payload[settingKey] = !current;
    await adminFetch('/settings/llm', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    await _renderRoutingBanner(bannerId, badgeSpanId, settingKey, label, offDescription);
  } catch (e) {
    alert('Failed to update routing setting: ' + e.message);
  }
}

// ── Tab switching ─────────────────────────────────────────────────────────────

function _switchPricingTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.pricing-tab').forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active');
      btn.style.color = 'var(--primary,#0ea5e9)';
      btn.style.borderBottomColor = 'var(--primary,#0ea5e9)';
      btn.style.fontWeight = '600';
    } else {
      btn.classList.remove('active');
      btn.style.color = 'var(--text-muted)';
      btn.style.borderBottomColor = 'transparent';
      btn.style.fontWeight = '500';
    }
  });

  // Update tab content visibility
  document.querySelectorAll('.pricing-tab-content').forEach(content => {
    content.style.display = content.dataset.tab === tabName ? 'block' : 'none';
  });
}
