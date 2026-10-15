/**
 * productspecs.js — Schema-driven Product Specifications CRUD
 *
 * Table columns, form fields, JSON samples, and import format are all driven
 * by the product-specs schema API so administrators can add/edit/rename/remove
 * fields at runtime without touching code.
 *
 * Boolean fields with format_hint="boolean_badge" are aggregated into a single
 * "Features" summary column in the table, while non-boolean fields each get
 * their own column.
 */

/* global apiFetch, adminFetch, esc, showToast, SchemaEditor, openVectorDBViewer, closeVectorDBViewer, loadVectorDBRecords */

let _editingProductSpecId = null;
let _productSpecsCurrentPage = 1;
let _productSpecsPageSize = 25;
let _productSpecsTotalRecords = 0;
let _productSpecSelectedIds = new Set();

/** Cached schema fields (populated by _loadProductSpecSchema) */
let _productSpecSchema = [];
let _productSpecSchemaVersion = 0;

// Derived partitions — recomputed after every schema load
let _psDataFields = [];   // non-boolean fields → individual table columns
let _psBoolFields = [];   // format_hint=boolean_badge → aggregated Features column

// Active tab in the Add/Edit modal ('form' | 'json')
let _productSpecActiveTab = 'form';

// ══════════════════════════════════════════════════════════════════════════════
// Schema loader
// ══════════════════════════════════════════════════════════════════════════════

async function _loadProductSpecSchema() {
  try {
    const data = await adminFetch('/product-specs/schema');
    _productSpecSchema = data.fields || [];
    _productSpecSchemaVersion = data.schema_version || 0;
  } catch (err) {
    console.warn('Failed to load product spec schema, using fallback:', err);
    _productSpecSchema = [
      { name: 'brand', display_label: 'Brand', data_type: 'text', is_required: true, format_hint: null, sort_order: 1 },
      { name: 'model', display_label: 'Model', data_type: 'text', is_required: true, format_hint: null, sort_order: 2 },
      { name: 'variant', display_label: 'Variant', data_type: 'text', is_required: false, format_hint: null, sort_order: 3 },
      { name: 'year', display_label: 'Year', data_type: 'integer', is_required: false, format_hint: null, sort_order: 4 },
      { name: 'body_type', display_label: 'Body Type', data_type: 'text', is_required: false, format_hint: 'badge', sort_order: 5 },
      { name: 'transmission', display_label: 'Transmission', data_type: 'text', is_required: false, format_hint: 'badge', sort_order: 6 },
    ];
    _productSpecSchemaVersion = 0;
  }
  // Partition fields
  _psDataFields = _productSpecSchema.filter(f => f.format_hint !== 'boolean_badge');
  _psBoolFields = _productSpecSchema.filter(f => f.format_hint === 'boolean_badge');
}

// ══════════════════════════════════════════════════════════════════════════════
// Helpers — cell formatting, form inputs, value collection
// ══════════════════════════════════════════════════════════════════════════════

/** Format a cell value for table display based on schema field metadata */
function _psFormatCell(field, value) {
  if (value === null || value === undefined || value === '') return '<span class="text-muted">—</span>';
  const hint = field.format_hint;
  switch (field.data_type) {
    case 'real':
    case 'integer':
      if (hint === 'currency') return `<strong>${Number(value).toLocaleString('id-ID')}</strong>`;
      return esc(String(value));
    case 'boolean':
      return value ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-warning">No</span>';
    default:
      if (hint === 'badge') return `<span class="badge badge-info">${esc(value)}</span>`;
      if (hint === 'textarea') {
        const short = String(value).length > 80 ? String(value).slice(0, 80) + '…' : String(value);
        return esc(short);
      }
      return esc(String(value));
  }
}

/** Generate a form input element for a schema field */
function _psFieldInput(field, value) {
  const id = `csm-${field.name}`;
  const required = field.is_required ? 'required' : '';
  const val = value ?? field.default_value ?? '';
  const star = field.is_required ? ' <span style="color:var(--danger)">*</span>' : '';

  let input;
  switch (field.data_type) {
    case 'real':
      input = `<input class="form-control" id="${id}" type="number" step="0.01" placeholder="${esc(field.display_label)}" value="${esc(val)}" ${required} />`;
      break;
    case 'integer':
      input = `<input class="form-control" id="${id}" type="number" step="1" placeholder="${esc(field.display_label)}" value="${esc(val)}" ${required} />`;
      break;
    case 'boolean':
      const checked = (val === true || val === 1 || val === '1' || val === 'true') ? 'checked' : '';
      input = `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;">
        <input type="checkbox" id="${id}" ${checked} style="cursor:pointer;" /> ${esc(field.display_label)}
      </label>`;
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

/** Collect form values from dynamically rendered modal fields */
function _psCollectFormValues() {
  const payload = {};
  for (const f of _productSpecSchema) {
    const el = document.getElementById(`csm-${f.name}`);
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

/** Build a single-object JSON sample string from current schema */
function _psBuildJsonSample() {
  const obj = {};
  _productSpecSchema.forEach(f => {
    if (f.data_type === 'integer' || f.data_type === 'real') {
      obj[f.name] = f.is_required ? 2024 : 0;
    } else if (f.data_type === 'boolean') {
      obj[f.name] = false;
    } else {
      obj[f.name] = f.default_value || (f.is_required ? f.display_label : '');
    }
  });
  return JSON.stringify(obj, null, 2);
}

/** Build an array JSON sample for import placeholders */
function _psBuildImportSample() {
  const obj = {};
  _productSpecSchema.forEach(f => {
    if (f.data_type === 'integer' || f.data_type === 'real') {
      obj[f.name] = f.is_required ? 2024 : 0;
    } else if (f.data_type === 'boolean') {
      obj[f.name] = false;
    } else {
      obj[f.name] = f.default_value || (f.is_required ? f.display_label : '');
    }
  });
  return JSON.stringify([obj], null, 2);
}

function _initProductSpecRoleButtons() {
  try {
    const user = JSON.parse(sessionStorage.getItem('admin_user') || '{}');
    if (user.role === 'superadmin') {
      const vdbBtn = document.getElementById('btnProductSpecVectorViewer');
      if (vdbBtn) vdbBtn.style.display = '';
      const schemaBtn = document.getElementById('btnProductSpecSchemaEditor');
      if (schemaBtn) schemaBtn.style.display = '';
    }
  } catch (_) { /* ignore */ }
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab switching + Form ↔ JSON sync
// ══════════════════════════════════════════════════════════════════════════════

function switchProductSpecTab(tab) {
  _productSpecActiveTab = tab;
  const formPane = document.getElementById('csm-tab-form');
  const jsonPane = document.getElementById('csm-tab-json');
  const formBtn  = document.getElementById('csm-tabBtn-form');
  const jsonBtn  = document.getElementById('csm-tabBtn-json');
  if (!formPane || !jsonPane) return;

  if (tab === 'json') {
    formPane.classList.add('hidden');
    jsonPane.classList.remove('hidden');
    jsonBtn.classList.add('btn-primary');   jsonBtn.classList.remove('btn-secondary');
    formBtn.classList.remove('btn-primary'); formBtn.classList.add('btn-secondary');
    _syncJsonFromForm();
  } else {
    jsonPane.classList.add('hidden');
    formPane.classList.remove('hidden');
    formBtn.classList.add('btn-primary');   formBtn.classList.remove('btn-secondary');
    jsonBtn.classList.remove('btn-primary'); jsonBtn.classList.add('btn-secondary');
  }
}

/** Read current form values → serialize to JSON → put in textarea */
function _syncJsonFromForm() {
  const payload = _psCollectFormValues();
  const ta = document.getElementById('csm-json-input');
  if (ta) ta.value = JSON.stringify(payload, null, 2);
}

/** Parse JSON textarea → populate form fields */
function _syncFormFromJson() {
  const ta = document.getElementById('csm-json-input');
  if (!ta) return false;
  let obj;
  try { obj = JSON.parse(ta.value); } catch { showToast('Invalid JSON', 'error'); return false; }
  _productSpecSchema.forEach(f => {
    const el = document.getElementById(`csm-${f.name}`);
    if (!el) return;
    if (f.data_type === 'boolean') {
      el.checked = !!obj[f.name];
    } else {
      el.value = obj[f.name] ?? '';
    }
  });
  return true;
}

// ══════════════════════════════════════════════════════════════════════════════
// Main renderer
// ══════════════════════════════════════════════════════════════════════════════

async function renderProductSpecs() {
  const body = document.getElementById('pageBody');
  await _loadProductSpecSchema();

  // Table headers: each non-boolean field + (optional) Features summary + Sync + Actions
  const thCells = _psDataFields.map(f => `<th>${esc(f.display_label)}</th>`).join('');
  const hasBools = _psBoolFields.length > 0;
  const colSpan = _psDataFields.length + (hasBools ? 1 : 0) + 3;
  const reqFields = _productSpecSchema.filter(f => f.is_required).map(f => '<code>' + esc(f.name) + '</code>').join(', ') || 'none';

  body.innerHTML = `
    <!-- Tabs Navigation -->
    <div class="card" style="margin-bottom:20px;">
      <div style="border-bottom:1px solid var(--border);padding:0;">
        <div style="display:flex;gap:0;">
          <button class="productspecs-tab active" data-tab="records" onclick="_switchProductSpecsTab('records')" style="
            padding:12px 20px;border:none;background:transparent;cursor:pointer;
            font-weight:600;font-size:14px;color:var(--primary,#0ea5e9);
            border-bottom:2px solid var(--primary,#0ea5e9);transition:all 0.2s;
          ">
            Records
          </button>
          <span style="color:var(--border);padding:12px 0;font-size:14px;">|</span>
          <button class="productspecs-tab" data-tab="intent" onclick="_switchProductSpecsTab('intent')" style="
            padding:12px 20px;border:none;background:transparent;cursor:pointer;
            font-weight:500;font-size:14px;color:var(--text-muted);
            border-bottom:2px solid transparent;transition:all 0.2s;
          ">
            Intent Rules
          </button>
        </div>
      </div>

      <!-- Tab: Records -->
      <div class="productspecs-tab-content" data-tab="records" style="display:block;">
        <div class="card-header">
          <span class="card-title">Product Specs <small style="color:var(--text-muted);font-weight:normal;font-size:12px;">schema v${_productSpecSchemaVersion}</small></span>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <input class="form-control" type="text" id="productSpecSearch" placeholder="Search…" style="width:180px;"
              oninput="debouncedProductSpecSearch()" />
            <select class="form-control" id="productSpecBrand" style="width:150px;" onchange="resetProductSpecPage(); loadProductSpecs()">
              <option value="">All brands</option>
            </select>
            <select class="form-control" id="productSpecPageSize" style="width:100px;" onchange="resetProductSpecPage(); loadProductSpecs()">
              <option value="25" selected>25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="150">150</option>
            </select>
            <button class="btn btn-danger btn-sm" id="btnDeleteSelectedProductSpecs" onclick="deleteSelectedProductSpecs()" style="display:none;">🗑️ Delete Selected</button>
            <button class="btn btn-primary btn-sm" onclick="openProductSpecModal()">＋ Add Record</button>
            <button class="btn btn-secondary btn-sm" onclick="openProductSpecImportModal()">📥 Import</button>
            <button class="btn btn-secondary btn-sm" onclick="exportProductSpecsData()">📤 Export</button>
            <button class="btn btn-secondary btn-sm" onclick="syncProductSpecsVectorDB()">🔄 Sync VectorDB</button>
            <button class="btn btn-secondary btn-sm" onclick="openVectorDBViewer('product_spec_database_kbc')" id="btnProductSpecVectorViewer" style="display:none;">🔍 View VectorDB</button>
            <button class="btn btn-secondary btn-sm" id="btnProductSpecSchemaEditor" style="display:none;" onclick="window._productSpecSchemaEditor && window._productSpecSchemaEditor.open()">⚙️ Schema</button>
            <button class="btn btn-secondary btn-sm" onclick="loadProductSpecs()">🔄 Refresh</button>
            <button class="btn btn-danger btn-sm" onclick="truncateProductSpecsTable()">🗑️ Empty database</button>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style="width:36px;text-align:center;"><input type="checkbox" id="psSelectAllCheckbox" title="Select all" onchange="_psToggleSelectAll(this)" style="cursor:pointer;" /></th>
                ${thCells}
                ${hasBools ? '<th>Features</th>' : ''}
                <th>Sync</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="productSpecTableBody">
              <tr><td colspan="${colSpan}" style="text-align:center;padding:24px;color:var(--text-muted);">Loading…</td></tr>
            </tbody>
          </table>
        </div>
        <div style="padding:12px 16px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div style="font-size:12px;color:var(--text-muted);" id="productSpecFooter"></div>
          <div id="productSpecPagination" style="display:flex;gap:4px;align-items:center;"></div>
        </div>
      </div>

      <!-- Tab: Intent Rules -->
      <div class="productspecs-tab-content" data-tab="intent" style="display:none;">
        <div class="card-header">
          <span class="card-title">Product Specs — Intent Trigger Rules</span>
        </div>
        <div class="card-body" id="productSpecsIntentRulesContainer"></div>
      </div>
    </div>

    <!-- Add / Edit Modal (Form + JSON dual tab) -->
    <div class="modal-overlay hidden" id="productSpecModal">
      <div class="modal" style="max-width:720px;max-height:90vh;">
        <div class="modal-header">
          <span class="modal-title" id="productSpecModalTitle">Add Product Spec</span>
          <button class="modal-close" onclick="closeProductSpecModal()">×</button>
        </div>
        <div class="modal-body" style="overflow-y:auto;max-height:65vh;">
          <div style="display:flex;gap:8px;margin-bottom:12px;">
            <button class="btn btn-primary btn-sm" id="csm-tabBtn-form" onclick="switchProductSpecTab('form')" style="flex:1;">📝 Form</button>
            <button class="btn btn-secondary btn-sm" id="csm-tabBtn-json" onclick="switchProductSpecTab('json')" style="flex:1;">{ } JSON</button>
          </div>

          <div id="csm-tab-form">
            <div id="csm-form-fields"><!-- populated dynamically by openProductSpecModal --></div>
          </div>

          <div id="csm-tab-json" class="hidden">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <label class="form-label" style="margin:0;">JSON Object</label>
              <div style="display:flex;gap:6px;">
                <button class="btn btn-secondary btn-sm" onclick="document.getElementById('csm-json-input').value=_psBuildJsonSample()">📄 Load Sample</button>
                <button class="btn btn-secondary btn-sm" onclick="_syncJsonFromForm()">🔄 Fill from Form</button>
              </div>
            </div>
            <textarea class="form-control" id="csm-json-input" rows="22"
              placeholder="Paste or edit a single product spec JSON object…"
              style="font-family:monospace;font-size:12px;resize:vertical;"
              spellcheck="false"></textarea>
            <div style="font-size:12px;color:var(--text-muted);margin-top:6px;">
              Required: ${reqFields} — all other fields optional.
              Boolean features: <code>true</code> / <code>false</code>.
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeProductSpecModal()">Cancel</button>
          <button class="btn btn-primary" id="productSpecModalSaveBtn" onclick="saveProductSpec()">Save Record</button>
        </div>
      </div>
    </div>

    <!-- Import Modal -->
    <div class="modal-overlay hidden" id="productSpecImportModal">
      <div class="modal" style="max-width:700px;">
        <div class="modal-header">
          <span class="modal-title">📥 Import Product Specs</span>
          <button class="modal-close" onclick="closeProductSpecImportModal()">×</button>
        </div>
        <div class="modal-body">
          <div style="display:flex;gap:8px;margin-bottom:12px;">
            <button class="btn btn-secondary btn-sm" id="csImportTabFile" onclick="switchProductSpecImportTab('file')" style="flex:1;">File Upload</button>
            <button class="btn btn-secondary btn-sm" id="csImportTabText" onclick="switchProductSpecImportTab('text')" style="flex:1;">Paste JSON</button>
          </div>

          <!-- File Upload Tab -->
          <div id="csImportFileTab">
            <div class="form-group">
              <label class="form-label">Upload JSON / CSV / Excel file</label>
              <input type="file" class="form-control" id="csFileInput" accept=".json,.csv,.xlsx,.xls" />
              <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">
                Supported: <code>.json</code>, <code>.csv</code>, <code>.xlsx</code> / <code>.xls</code>
              </div>
            </div>
          </div>

          <!-- Text Area Tab -->
          <div id="csImportTextTab" class="hidden">
            <div class="form-group">
              <label class="form-label">Paste JSON Data</label>
              <textarea class="form-control" id="csTextInput" rows="12" placeholder=""
                style="font-family:monospace;font-size:12px;"></textarea>
              <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">
                Required fields: ${reqFields}
              </div>
            </div>
          </div>

          <details style="font-size:13px;color:var(--text-muted);margin-top:8px;">
            <summary style="cursor:pointer;margin-bottom:8px;font-weight:500;">Expected JSON Format</summary>
            <pre style="background:var(--bg-secondary);padding:12px;border-radius:4px;overflow-x:auto;"><code>${esc(_psBuildImportSample())}</code></pre>
          </details>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeProductSpecImportModal()">Cancel</button>
          <button class="btn btn-primary" id="csImportBtn" onclick="importProductSpecs()">Import</button>
        </div>
      </div>
    </div>

    <!-- Schema Editor Modals (injected by SchemaEditor class) -->
  `;

  // Initialize shared SchemaEditor (if not already created)
  if (!window._productSpecSchemaEditor) {
    window._productSpecSchemaEditor = new SchemaEditor({
      id:               'product_specs',
      apiPrefix:        'product-specs',
      entityLabel:      'Product Spec',
      entityIcon:       '',
      getSchema:        () => _productSpecSchema,
      getSchemaVersion: () => _productSpecSchemaVersion,
      loadSchema:       _loadProductSpecSchema,
      onClose:          () => renderProductSpecs(),
      formatHintOptions: [
        { value: '',              label: '(default)' },
        { value: 'badge',         label: 'badge — coloured tag pill' },
        { value: 'textarea',      label: 'textarea — multiline text input' },
        { value: 'boolean_badge', label: 'boolean_badge — Yes/No badge (features)' },
        { value: 'currency',      label: 'currency — bold locale-formatted number' },
      ],
    });
  }
  window._productSpecSchemaEditor.injectModals(document.body);

  // Set import placeholder
  const csTextInput = document.getElementById('csTextInput');
  if (csTextInput) csTextInput.placeholder = _psBuildImportSample();

  // Render intent rules in its container
  const intentContainer = document.getElementById('productSpecsIntentRulesContainer');
  if (intentContainer) {
    intentContainer.innerHTML = `
      <p style="font-size:13px;color:var(--text-muted);margin:0 0 12px;">
        These keywords guide the AI intent classifier to recognise
        <strong>product specification</strong>-related queries.
        Click <strong>×</strong> on a tag to remove it. Type a keyword below and press
        <kbd style="font-size:11px;padding:1px 5px;border:1px solid var(--border);border-radius:3px;">Enter</kbd>
        or <kbd style="font-size:11px;padding:1px 5px;border:1px solid var(--border);border-radius:3px;">,</kbd>
        to add. Changes take effect immediately — no restart required.
      </p>

      <div id="intentChips_specs" onclick="_intentFocusInput('intentKwInput_specs')" style="
        display:flex;flex-wrap:wrap;gap:6px;align-items:center;
        min-height:44px;padding:8px 10px;
        border:1px solid var(--border);border-radius:8px;
        background:var(--card-bg,#fff);cursor:text;
      ">
        <input
          id="intentKwInput_specs"
          type="text"
          placeholder="Add keyword…"
          autocomplete="off"
          style="
            border:none;outline:none;background:transparent;
            font-size:13px;min-width:140px;flex:1;padding:2px 4px;
            color:var(--text-primary);
          "
          onkeydown="_intentInputKeydown(event,'specs','intentChips_specs','intentKwInput_specs')"
          onblur="_intentInputBlur('specs','intentChips_specs','intentKwInput_specs')"
        />
      </div>
      <small style="color:var(--text-muted);font-size:12px;margin-top:4px;display:block;">
        Press <strong>Enter</strong> or <strong>,</strong> to confirm. Backspace on empty input removes the last tag.
      </small>

      <div style="display:flex;align-items:center;gap:12px;margin-top:14px;">
        <button class="btn btn-primary btn-sm" onclick="_saveIntentRules('specs','intentRulesStatus_specs')">
          💾 Save Keywords
        </button>
        <button class="btn btn-secondary btn-sm" onclick="_resetIntentRules('specs','intentChips_specs','intentKwInput_specs','intentRulesStatus_specs')">
          ↩ Reset to Default
        </button>
        <span id="intentRulesStatus_specs" style="font-size:12px;color:var(--text-muted);"></span>
      </div>
    `;
    _loadIntentRules('specs', 'intentChips_specs', 'intentKwInput_specs');
  }

  await Promise.all([loadProductSpecBrands(), loadProductSpecs()]);
  _initProductSpecRoleButtons();
}

// ══════════════════════════════════════════════════════════════════════════════
// Search debounce
// ══════════════════════════════════════════════════════════════════════════════

let _productSpecSearchTimer;
function debouncedProductSpecSearch() {
  clearTimeout(_productSpecSearchTimer);
  _productSpecSearchTimer = setTimeout(() => { resetProductSpecPage(); loadProductSpecs(); }, 300);
}

function resetProductSpecPage() { _productSpecsCurrentPage = 1; }

// ══════════════════════════════════════════════════════════════════════════════
// Brand filter
// ══════════════════════════════════════════════════════════════════════════════

async function loadProductSpecBrands() {
  try {
    const data = await apiFetch('/product-specs/brands');
    const sel = document.getElementById('productSpecBrand');
    if (!sel) return;
    (data.brands || []).forEach(b => {
      const opt = document.createElement('option');
      opt.value = b; opt.textContent = b;
      sel.appendChild(opt);
    });
  } catch (_) { /* ignore */ }
}

// ══════════════════════════════════════════════════════════════════════════════
// Load & render table (schema-driven)
// ══════════════════════════════════════════════════════════════════════════════

async function loadProductSpecs() {
  const hasBools = _psBoolFields.length > 0;
  const colSpan = _psDataFields.length + (hasBools ? 1 : 0) + 3;
  const tbody = document.getElementById('productSpecTableBody');
  const footer = document.getElementById('productSpecFooter');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center;padding:24px;color:var(--text-muted);">Loading…</td></tr>`;

  try {
    const query = document.getElementById('productSpecSearch')?.value.trim() || '';
    const brand = document.getElementById('productSpecBrand')?.value || '';
    const pageSizeSelect = document.getElementById('productSpecPageSize');
    _productSpecsPageSize = pageSizeSelect ? parseInt(pageSizeSelect.value) : 25;

    let data;
    if (query) {
      data = await apiFetch('/product-specs/search', {
        method: 'POST',
        body: JSON.stringify({ query, brand: brand || undefined, limit: 1000 }),
      });
      data.records = data.results || [];
    } else {
      const params = new URLSearchParams({ limit: 10000 });
      if (brand) params.set('brand', brand);
      data = await apiFetch(`/product-specs?${params}`);
    }

    const allRecords = data.records || [];
    _productSpecsTotalRecords = allRecords.length;
    const totalPages = Math.ceil(_productSpecsTotalRecords / _productSpecsPageSize);
    if (_productSpecsCurrentPage > totalPages && totalPages > 0) {
      _productSpecsCurrentPage = totalPages;
    }

    const startIdx = (_productSpecsCurrentPage - 1) * _productSpecsPageSize;
    const endIdx = startIdx + _productSpecsPageSize;
    const records = allRecords.slice(startIdx, endIdx);

    if (footer) {
      const start = _productSpecsTotalRecords === 0 ? 0 : startIdx + 1;
      const end = Math.min(endIdx, _productSpecsTotalRecords);
      footer.textContent = `Showing ${start}–${end} of ${_productSpecsTotalRecords} record${_productSpecsTotalRecords !== 1 ? 's' : ''}`;
    }
    renderProductSpecPagination(totalPages);

    if (!records.length) {
      tbody.innerHTML = `<tr><td colspan="${colSpan}"><div class="empty-state"><div class="empty-icon">❌</div><p>No product spec records found.</p></div></td></tr>`;
      return;
    }

    // Clear stale selections for IDs no longer visible
    const visibleIds = new Set(records.map(r => r.id));
    for (const id of _productSpecSelectedIds) {
      if (!visibleIds.has(id)) _productSpecSelectedIds.delete(id);
    }
    _psUpdateSelectionUI();

    tbody.innerHTML = records.map(r => {
      // Non-boolean field cells (each gets its own column)
      const cells = _psDataFields.map(f => `<td>${_psFormatCell(f, r[f.name])}</td>`).join('');

      // Boolean features summary column
      let featCell = '';
      if (hasBools) {
        const active = _psBoolFields.filter(f => r[f.name]);
        const badges = active.slice(0, 4).map(f =>
          `<span class="badge badge-info" style="font-size:10px;">${esc(f.display_label)}</span>`
        ).join(' ');
        const more = active.length > 4
          ? ` <span style="font-size:10px;color:var(--text-muted);">+${active.length - 4} more</span>`
          : '';
        featCell = `<td>${badges}${more}${active.length === 0 ? '<span class="text-muted">—</span>' : ''}</td>`;
      }

      // Sync badge
      const syncBadge = r.vectordb_synced
        ? '<span class="badge badge-success" style="font-size:10px;">✓ Synced</span>'
        : '<span class="badge badge-warning" style="font-size:10px;">⏳ Pending</span>';

      // Display name for delete confirmation
      const displayName = `${esc(r.brand || '')} ${esc(r.model || '')}`.trim() || r.id;

      const isChecked = _productSpecSelectedIds.has(r.id) ? 'checked' : '';
      return `
        <tr>
          <td style="text-align:center;">
            <input type="checkbox" class="ps-row-checkbox" data-id="${r.id}" ${isChecked}
              onchange="_psToggleSelectRow(${r.id}, this)" style="cursor:pointer;" />
          </td>
          ${cells}
          ${featCell}
          <td>${syncBadge}</td>
          <td>
            <div class="td-actions">
              <button class="btn btn-secondary btn-sm btn-icon" title="Edit" onclick="editProductSpec(${r.id})">✏️</button>
              <button class="btn btn-danger btn-sm btn-icon" title="Delete" onclick="deleteProductSpec(${r.id}, '${displayName}')">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Sync select-all checkbox state
    const allCheckboxes = tbody.querySelectorAll('.ps-row-checkbox');
    const selectAll = document.getElementById('psSelectAllCheckbox');
    if (selectAll) {
      selectAll.checked = allCheckboxes.length > 0 && Array.from(allCheckboxes).every(cb => cb.checked);
      selectAll.indeterminate = !selectAll.checked && Array.from(allCheckboxes).some(cb => cb.checked);
    }

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="${colSpan}" style="color:var(--danger);padding:16px;">${err.message}</td></tr>`;
    showToast(err.message, 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Modal — open / close (dynamic form fields from schema)
// ══════════════════════════════════════════════════════════════════════════════

function openProductSpecModal(record = null) {
  _editingProductSpecId = record?.id ?? null;
  document.getElementById('productSpecModalTitle').textContent = record ? 'Edit Product Spec' : 'Add Product Spec';

  // Build form dynamically from schema
  const formContainer = document.getElementById('csm-form-fields');
  let html = '';
  let row = [];

  // Non-boolean fields → standard 2-column layout
  const nonBoolFields = _productSpecSchema.filter(f => f.data_type !== 'boolean');
  const boolFields = _productSpecSchema.filter(f => f.data_type === 'boolean');

  for (const f of nonBoolFields) {
    const isLong = f.format_hint === 'textarea';
    if (isLong) {
      if (row.length) { html += `<div class="form-row">${row.join('')}</div>`; row = []; }
      html += _psFieldInput(f, record?.[f.name]);
    } else {
      row.push(_psFieldInput(f, record?.[f.name]));
      if (row.length === 2) { html += `<div class="form-row">${row.join('')}</div>`; row = []; }
    }
  }
  if (row.length) { html += `<div class="form-row">${row.join('')}</div>`; row = []; }

  // Boolean features → grid layout
  if (boolFields.length) {
    html += `
      <div class="form-group">
        <label class="form-label">Features</label>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px 16px;margin-top:6px;">
          ${boolFields.map(f => _psFieldInput(f, record?.[f.name])).join('')}
        </div>
      </div>`;
  }

  formContainer.innerHTML = html;

  // Always start on Form tab; pre-fill JSON textarea
  _productSpecActiveTab = 'form';
  switchProductSpecTab('form');
  const ta = document.getElementById('csm-json-input');
  if (ta) ta.value = record ? JSON.stringify(record, null, 2) : _psBuildJsonSample();

  document.getElementById('productSpecModal').classList.remove('hidden');
}

function closeProductSpecModal() {
  document.getElementById('productSpecModal').classList.add('hidden');
  _editingProductSpecId = null;
}

async function editProductSpec(id) {
  try {
    const data = await apiFetch(`/product-specs/${id}`);
    openProductSpecModal(data);
  } catch (err) { showToast(err.message, 'error'); }
}

// ══════════════════════════════════════════════════════════════════════════════
// Save record (schema-driven validation)
// ══════════════════════════════════════════════════════════════════════════════

async function saveProductSpec() {
  // If JSON tab is active, sync form fields from JSON first
  if (_productSpecActiveTab === 'json') {
    const ok = _syncFormFromJson();
    if (!ok) return;  // invalid JSON — toast already shown
  }

  const payload = _psCollectFormValues();

  // Validate required fields dynamically
  for (const f of _productSpecSchema) {
    if (f.is_required) {
      const v = payload[f.name];
      if (v === null || v === undefined || v === '' || (typeof v === 'number' && isNaN(v))) {
        showToast(`${f.display_label} is required`, 'warning');
        return;
      }
    }
  }

  const btn = document.getElementById('productSpecModalSaveBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    if (_editingProductSpecId) {
      await apiFetch(`/product-specs/${_editingProductSpecId}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Record updated', 'success');
    } else {
      await apiFetch('/product-specs', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Record created', 'success');
    }
    closeProductSpecModal();
    await loadProductSpecs();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save Record';
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Delete
// ══════════════════════════════════════════════════════════════════════════════

async function deleteProductSpec(id, name) {
  if (!confirm(`Delete product spec record "${name}"?`)) return;
  try {
    await apiFetch(`/product-specs/${id}`, { method: 'DELETE' });
    showToast('Record deleted', 'success');
    await loadProductSpecs();
  } catch (err) { showToast(err.message, 'error'); }
}

// ══════════════════════════════════════════════════════════════════════════════
// Multi-select helpers
// ══════════════════════════════════════════════════════════════════════════════

function _psToggleSelectAll(checkbox) {
  const rows = document.querySelectorAll('#productSpecTableBody .ps-row-checkbox');
  rows.forEach(cb => {
    const id = parseInt(cb.dataset.id);
    cb.checked = checkbox.checked;
    if (checkbox.checked) {
      _productSpecSelectedIds.add(id);
    } else {
      _productSpecSelectedIds.delete(id);
    }
  });
  _psUpdateSelectionUI();
}

function _psToggleSelectRow(id, checkbox) {
  if (checkbox.checked) {
    _productSpecSelectedIds.add(id);
  } else {
    _productSpecSelectedIds.delete(id);
  }
  _psUpdateSelectionUI();
  // Sync select-all checkbox
  const allCheckboxes = document.querySelectorAll('#productSpecTableBody .ps-row-checkbox');
  const selectAll = document.getElementById('psSelectAllCheckbox');
  if (selectAll) {
    selectAll.checked = allCheckboxes.length > 0 && Array.from(allCheckboxes).every(cb => cb.checked);
    selectAll.indeterminate = !selectAll.checked && Array.from(allCheckboxes).some(cb => cb.checked);
  }
}

function _psUpdateSelectionUI() {
  const count = _productSpecSelectedIds.size;
  const btn = document.getElementById('btnDeleteSelectedProductSpecs');
  if (btn) {
    if (count > 0) {
      btn.style.display = '';
      btn.textContent = `🗑️ Delete Selected (${count})`;
    } else {
      btn.style.display = 'none';
    }
  }
}

async function deleteSelectedProductSpecs() {
  const ids = Array.from(_productSpecSelectedIds);
  if (!ids.length) return;
  if (!confirm(`Delete ${ids.length} selected record${ids.length !== 1 ? 's' : ''}?\n\nThis action cannot be undone.`)) return;
  const btn = document.getElementById('btnDeleteSelectedProductSpecs');
  if (btn) { btn.disabled = true; btn.textContent = 'Deleting…'; }
  try {
    const response = await apiFetch('/product-specs/bulk-delete', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
    showToast(response.message || `${ids.length} record(s) deleted`, 'success');
    _productSpecSelectedIds.clear();
    _psUpdateSelectionUI();
    await loadProductSpecs();
  } catch (err) {
    showToast(err.message || 'Failed to delete records', 'error');
  } finally {
    if (btn) { btn.disabled = false; _psUpdateSelectionUI(); }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Import Modal
// ══════════════════════════════════════════════════════════════════════════════

function openProductSpecImportModal() {
  document.getElementById('productSpecImportModal').classList.remove('hidden');
  switchProductSpecImportTab('file');
}

function closeProductSpecImportModal() {
  document.getElementById('productSpecImportModal').classList.add('hidden');
  const fi = document.getElementById('csFileInput');
  const ti = document.getElementById('csTextInput');
  if (fi) fi.value = '';
  if (ti) ti.value = '';
}

function switchProductSpecImportTab(tab) {
  const fileTab = document.getElementById('csImportFileTab');
  const textTab = document.getElementById('csImportTextTab');
  const fileBtn = document.getElementById('csImportTabFile');
  const textBtn = document.getElementById('csImportTabText');
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

async function importProductSpecs() {
  const fileInput = document.getElementById('csFileInput');
  const textInput = document.getElementById('csTextInput');
  const btn = document.getElementById('csImportBtn');

  const isFileTab = !document.getElementById('csImportFileTab').classList.contains('hidden');

  try {
    let response;
    if (isFileTab) {
      // File upload (JSON / CSV / Excel)
      if (!fileInput.files.length) { showToast('Please select a file', 'warning'); return; }
      const file = fileInput.files[0];
      const ext = file.name.toLowerCase().split('.').pop();

      btn.disabled = true; btn.textContent = 'Importing…';

      if (ext === 'json') {
        const text = await file.text();
        const jsonData = JSON.parse(text);
        const isEnvelope = jsonData && !Array.isArray(jsonData) && Array.isArray(jsonData.records);
        const count = isEnvelope ? jsonData.records.length : (Array.isArray(jsonData) ? jsonData.length : 0);
        if (!count) { showToast('No records found in JSON data', 'warning'); return; }
        if (!confirm(`Import ${count} record(s)?`)) return;
        response = await apiFetch('/product-specs/import-json', { method: 'POST', body: JSON.stringify(jsonData) });
      } else if (ext === 'csv') {
        const formData = new FormData();
        formData.append('file', file);
        response = await apiFetch('/product-specs/import-csv', { method: 'POST', body: formData, headers: {} });
      } else if (ext === 'xlsx' || ext === 'xls') {
        const formData = new FormData();
        formData.append('file', file);
        response = await apiFetch('/product-specs/import-excel', { method: 'POST', body: formData, headers: {} });
      } else {
        showToast('Unsupported file type. Use .json, .csv, .xlsx', 'error');
        return;
      }
    } else {
      // Paste JSON
      const text = textInput.value.trim();
      if (!text) { showToast('Please paste JSON data', 'warning'); return; }
      const jsonData = JSON.parse(text);
      const isEnvelope = jsonData && !Array.isArray(jsonData) && Array.isArray(jsonData.records);
      const count = isEnvelope ? jsonData.records.length : (Array.isArray(jsonData) ? jsonData.length : 0);
      if (!count) { showToast('No records found in JSON data', 'warning'); return; }
      if (!confirm(`Import ${count} record(s)?`)) return;
      btn.disabled = true; btn.textContent = 'Importing…';
      response = await apiFetch('/product-specs/import-json', { method: 'POST', body: JSON.stringify(jsonData) });
    }

    let msg = response.message || 'Import successful';
    if (response.version_mismatch) msg += ' ⚠️ Schema version mismatch — matched fields only.';
    if (response.ignored_fields && response.ignored_fields.length) msg += ` Ignored: ${response.ignored_fields.join(', ')}.`;
    showToast(msg, response.version_mismatch ? 'warning' : 'success');
    closeProductSpecImportModal();
    await loadProductSpecs();
  } catch (err) {
    if (err instanceof SyntaxError) {
      showToast('Invalid JSON format', 'error');
    } else {
      showToast(err.message || 'Import failed', 'error');
    }
  } finally {
    btn.disabled = false; btn.textContent = 'Import';
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Pagination
// ══════════════════════════════════════════════════════════════════════════════

function renderProductSpecPagination(totalPages) {
  const pagination = document.getElementById('productSpecPagination');
  if (!pagination) return;
  if (totalPages <= 1) { pagination.innerHTML = ''; return; }

  let html = `
    <button class="btn btn-secondary btn-sm" onclick="changeProductSpecPage(1)" ${_productSpecsCurrentPage === 1 ? 'disabled' : ''}>«</button>
    <button class="btn btn-secondary btn-sm" onclick="changeProductSpecPage(${_productSpecsCurrentPage - 1})" ${_productSpecsCurrentPage === 1 ? 'disabled' : ''}>‹</button>
  `;

  const maxButtons = 5;
  let startPage = Math.max(1, _productSpecsCurrentPage - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage < maxButtons - 1) startPage = Math.max(1, endPage - maxButtons + 1);

  if (startPage > 1) {
    html += `<button class="btn btn-secondary btn-sm" onclick="changeProductSpecPage(1)">1</button>`;
    if (startPage > 2) html += `<span style="padding:0 4px;color:var(--text-muted);">…</span>`;
  }
  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="btn btn-${i === _productSpecsCurrentPage ? 'primary' : 'secondary'} btn-sm" onclick="changeProductSpecPage(${i})">${i}</button>`;
  }
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += `<span style="padding:0 4px;color:var(--text-muted);">…</span>`;
    html += `<button class="btn btn-secondary btn-sm" onclick="changeProductSpecPage(${totalPages})">${totalPages}</button>`;
  }
  html += `
    <button class="btn btn-secondary btn-sm" onclick="changeProductSpecPage(${_productSpecsCurrentPage + 1})" ${_productSpecsCurrentPage === totalPages ? 'disabled' : ''}>›</button>
    <button class="btn btn-secondary btn-sm" onclick="changeProductSpecPage(${totalPages})" ${_productSpecsCurrentPage === totalPages ? 'disabled' : ''}>»</button>
  `;
  pagination.innerHTML = html;
}

function changeProductSpecPage(page) {
  const totalPages = Math.ceil(_productSpecsTotalRecords / _productSpecsPageSize);
  if (page < 1 || page > totalPages) return;
  _productSpecsCurrentPage = page;
  loadProductSpecs();
}

// ══════════════════════════════════════════════════════════════════════════════
// Truncate
// ══════════════════════════════════════════════════════════════════════════════

async function truncateProductSpecsTable() {
  if (!confirm('⚠️ WARNING: This will DELETE ALL product spec records.\n\nThis action CANNOT be undone.\n\nAre you sure?')) return;
  if (!confirm('⚠️ FINAL CONFIRMATION\n\nClick OK to permanently delete ALL product spec data.')) return;
  try {
    const response = await apiFetch('/product-specs/truncate', { method: 'DELETE' });
    showToast(response.message || 'All product spec records deleted', 'success');
    resetProductSpecPage();
    await loadProductSpecs();
  } catch (err) {
    showToast(err.message || 'Failed to clear product specs table', 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Export (with schema envelope)
// ══════════════════════════════════════════════════════════════════════════════

async function exportProductSpecsData() {
  try {
    showToast('Exporting product specs data...', 'info');
    const data = await apiFetch('/product-specs?limit=10000');
    if (!data.records || data.records.length === 0) {
      showToast('No product spec records to export', 'warning');
      return;
    }
    const envelope = {
      _schema_version: _productSpecSchemaVersion,
      _exported_at: new Date().toISOString(),
      _field_names: _productSpecSchema.map(f => f.name),
      records: data.records,
    };
    const jsonStr = JSON.stringify(envelope, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-specs-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${data.records.length} records (schema v${_productSpecSchemaVersion})`, 'success');
  } catch (err) {
    showToast(err.message || 'Failed to export product specs data', 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// VectorDB Sync
// ══════════════════════════════════════════════════════════════════════════════

async function syncProductSpecsVectorDB() {
  if (!confirm('Sync all product spec records to VectorDB?\n\nExisting product spec vectors will be replaced.')) return;
  try {
    showToast('Syncing to VectorDB…', 'info');
    const response = await apiFetch('/product-specs/sync-vectordb', { method: 'POST' });
    showToast(response.message || `Synced ${response.records_synced} records`, 'success');
    loadProductSpecs();
  } catch (err) {
    showToast(err.message || 'VectorDB sync failed', 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// VectorDB Viewer (shared — used by both pricing and product specs)
// ══════════════════════════════════════════════════════════════════════════════

async function openVectorDBViewer(source) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'vectorDBViewerOverlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:900px;max-height:85vh;display:flex;flex-direction:column;">
      <div class="modal-header">
        <span class="modal-title">🔍 VectorDB Viewer — ${esc(source)}</span>
        <button class="modal-close" onclick="closeVectorDBViewer()">×</button>
      </div>
      <div style="padding:16px;display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--border);">
        <span style="font-size:13px;color:var(--text-muted);" id="vectoViewerInfo">Loading…</span>
        <div style="margin-left:auto;display:flex;gap:4px;" id="vectoViewerPagination"></div>
      </div>
      <div style="flex:1;overflow:auto;padding:0;">
        <table>
          <thead>
            <tr>
              <th style="width:200px;">Chunk ID</th>
              <th>Content (preview)</th>
              <th style="width:180px;">Metadata</th>
            </tr>
          </thead>
          <tbody id="vectoViewerBody">
            <tr><td colspan="3" style="text-align:center;padding:24px;">Loading…</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  loadVectorDBRecords(source, 1);
}

function closeVectorDBViewer() {
  const el = document.getElementById('vectorDBViewerOverlay');
  if (el) el.remove();
}

let _vectorViewerSource = '';
let _vectorViewerPage = 1;

async function loadVectorDBRecords(source, page) {
  _vectorViewerSource = source;
  _vectorViewerPage = page;
  const tbody = document.getElementById('vectoViewerBody');
  const info = document.getElementById('vectoViewerInfo');
  if (!tbody) return;

  try {
    const params = new URLSearchParams({ source, page, per_page: 50 });
    const data = await adminFetch(`/vectordb/records?${params}`);

    if (info) info.textContent = `${data.total} vectors — page ${data.page}/${data.total_pages || 1}`;

    if (!data.records || !data.records.length) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--text-muted);">No vectors found for this source.</td></tr>';
      return;
    }

    tbody.innerHTML = data.records.map(r => {
      const metaStr = Object.entries(r.metadata || {}).map(([k,v]) => `<b>${esc(k)}</b>: ${esc(String(v))}`).join('<br>');
      return `
        <tr>
          <td style="font-size:11px;word-break:break-all;">${esc(r.chunk_id)}</td>
          <td style="font-size:12px;max-width:400px;white-space:pre-wrap;">${esc(r.content)}</td>
          <td style="font-size:11px;">${metaStr}</td>
        </tr>
      `;
    }).join('');

    // Pagination
    const pag = document.getElementById('vectoViewerPagination');
    if (pag && data.total_pages > 1) {
      let btns = '';
      if (data.page > 1) btns += `<button class="btn btn-secondary btn-sm" onclick="loadVectorDBRecords('${source}', ${data.page - 1})">‹ Prev</button>`;
      btns += `<span style="font-size:12px;padding:4px 8px;">${data.page}/${data.total_pages}</span>`;
      if (data.page < data.total_pages) btns += `<button class="btn btn-secondary btn-sm" onclick="loadVectorDBRecords('${source}', ${data.page + 1})">Next ›</button>`;
      pag.innerHTML = btns;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="3" style="color:var(--danger);padding:16px;">${err.message}</td></tr>`;
  }
}

async function _renderRoutingBanner(bannerId, badgeSpanId, settingKey, label, offDescription) {
  try {
    const data = await adminFetch('/settings/llm');
    const enabled = data[settingKey] !== false;

    const span = document.getElementById(badgeSpanId);
    if (span) {
      span.innerHTML = enabled
        ? '<span style="display:inline-flex;align-items:center;gap:4px;background:#dcfce7;color:#16a34a;font-weight:700;font-size:11px;padding:3px 10px;border-radius:8px;border:1px solid #86efac;">&#x2705; Routing: ON</span>'
        : '<span style="display:inline-flex;align-items:center;gap:4px;background:#fee2e2;color:#dc2626;font-weight:700;font-size:11px;padding:3px 10px;border-radius:8px;border:1px solid #fca5a5;">&#x26D4; Routing: OFF</span>';
    }

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

function _switchProductSpecsTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.productspecs-tab').forEach(btn => {
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
  document.querySelectorAll('.productspecs-tab-content').forEach(content => {
    content.style.display = content.dataset.tab === tabName ? 'block' : 'none';
  });
}
