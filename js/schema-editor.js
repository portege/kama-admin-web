/**
 * schema-editor.js — Reusable Schema Editor UI Component
 *
 * Provides a full schema-management modal (fields CRUD, drag-sort, history,
 * diff viewer, rebuild status) for any DynamicSchemaService entity.
 *
 * Usage:
 *   const editor = new SchemaEditor({
 *     id:              'pricing',           // unique key (also used for DOM IDs)
 *     apiPrefix:       'pricing',           // URL path segment under /admin/
 *     entityLabel:     'Pricing',           // human label
 *     entityIcon:      '💰',               // icon prefix
 *     getSchema:       () => _pricingSchema,
 *     getSchemaVersion:() => _pricingSchemaVersion,
 *     loadSchema:      async () => { ... }, // reload from API
 *     onClose:         () => renderPricing(),
 *     formatHintOptions: [ ... ],           // optional override
 *   });
 *
 *   // Open the editor
 *   editor.open();
 *
 * Dependencies: config.js (API_BASE), auth.js (adminFetch, showToast)
 */

/* global adminFetch, showToast */

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Registry — allows onclick handlers in generated HTML to find instances    */
/* ═══════════════════════════════════════════════════════════════════════════ */

window._seRegistry = window._seRegistry || {};

/** Shorthand called from onclick attributes: _seCall('pricing','openEditField','name') */
function _seCall(editorId, method, ...args) {
  const editor = window._seRegistry[editorId];
  if (editor && typeof editor[method] === 'function') {
    editor[method](...args);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  SchemaEditor class                                                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

class SchemaEditor {
  /**
   * @param {Object} config
   * @param {string} config.id              - Unique identifier (e.g. 'pricing')
   * @param {string} config.apiPrefix       - API URL prefix (e.g. 'pricing')
   * @param {string} config.entityLabel     - Human-readable label
   * @param {string} [config.entityIcon='⚙️'] - Emoji icon
   * @param {Function} config.getSchema     - Returns current schema array
   * @param {Function} config.getSchemaVersion - Returns current version number
   * @param {Function} config.loadSchema    - Async function to reload schema
   * @param {Function} [config.onClose]     - Called when editor closes
   * @param {Array}  [config.formatHintOptions] - Custom format_hint options
   */
  constructor(config) {
    this.id = config.id;
    this.apiPrefix = config.apiPrefix;
    this.entityLabel = config.entityLabel;
    this.entityIcon = config.entityIcon || '⚙️';
    this.getSchema = config.getSchema;
    this.getSchemaVersion = config.getSchemaVersion;
    this.loadSchema = config.loadSchema;
    this.onClose = config.onClose || (() => {});
    this.formatHintOptions = config.formatHintOptions || [
      { value: '',              label: '(default)' },
      { value: 'currency',     label: 'currency — bold locale-formatted number' },
      { value: 'badge',        label: 'badge — coloured tag pill' },
      { value: 'textarea',     label: 'textarea — multiline text input' },
      { value: 'boolean_badge', label: 'boolean_badge — Yes/No badge' },
    ];

    // State
    this._editingFieldName = null;
    this._rebuildPollTimer = null;
    this._activeTab = 'fields';
    this._dragSrcIdx = null;
    this._stylesInjected = false;
    this._modalsInjected = false;

    // DOM ID prefixes to avoid collisions between instances
    this._mid = `se_${this.id}`;

    // Register for onclick access
    window._seRegistry[this.id] = this;
  }

  /* ── tiny HTML-escape ─────────────────────────────────────────────────── */
  _esc(s) {
    if (s === null || s === undefined) return '';
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  /* ═════════════════════════════════════════════════════════════════════════ */
  /*  Modal HTML injection                                                    */
  /* ═════════════════════════════════════════════════════════════════════════ */

  /**
   * Inject the three modal overlays into the page.
   * Safe to call multiple times — injects only once.
   *
   * @param {HTMLElement} [container] - Element to append modals to (default: document.body)
   */
  injectModals(container) {
    if (this._modalsInjected) return;
    this._modalsInjected = true;
    const target = container || document.body;
    const id = this.id;
    const mid = this._mid;
    const ver = this.getSchemaVersion();

    const html = `
    <!-- Schema Editor Modal (${this.entityLabel}) -->
    <div class="modal-overlay hidden" id="${mid}_modal">
      <div class="modal" style="max-width:900px;max-height:90vh;">
        <div class="modal-header">
          <span class="modal-title" id="${mid}_title">${this._esc(this.entityLabel)} Schema Editor <small style="color:var(--text-muted);font-weight:normal;">v${ver}</small></span>
          <button class="modal-close" onclick="_seCall('${id}','close')">×</button>
        </div>
        <div class="modal-body" id="${mid}_body" style="overflow-y:auto;max-height:60vh;"></div>
        <div class="modal-footer" style="justify-content:space-between;">
          <div id="${mid}_status" style="font-size:12px;color:var(--text-muted);"></div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-secondary btn-sm" onclick="_seCall('${id}','triggerRebuild')" title="Force FTS + VectorDB rebuild">🔄 Rebuild</button>
            <button class="btn btn-secondary btn-sm" onclick="_seCall('${id}','openAddField')">＋ Add Field</button>
            <button class="btn btn-secondary" onclick="_seCall('${id}','close')">Close</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Field Modal (${this.entityLabel}) -->
    <div class="modal-overlay hidden" id="${mid}_fieldModal">
      <div class="modal" style="max-width:550px;">
        <div class="modal-header">
          <span class="modal-title" id="${mid}_fieldTitle">Add Field</span>
          <button class="modal-close" onclick="_seCall('${id}','closeFieldModal')">×</button>
        </div>
        <div class="modal-body" id="${mid}_fieldBody"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="_seCall('${id}','closeFieldModal')">Cancel</button>
          <button class="btn btn-primary" id="${mid}_fieldSaveBtn" onclick="_seCall('${id}','saveField')">Add Field</button>
        </div>
      </div>
    </div>

    <!-- Rename Field Modal (${this.entityLabel}) -->
    <div class="modal-overlay hidden" id="${mid}_renameModal">
      <div class="modal" style="max-width:400px;">
        <div class="modal-header">
          <span class="modal-title">Rename Field</span>
          <button class="modal-close" onclick="_seCall('${id}','closeRenameModal')">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Current name</label>
            <input class="form-control" id="${mid}_renameOldName" disabled />
          </div>
          <div class="form-group">
            <label class="form-label">New name <small style="color:var(--text-muted);">(lowercase, a-z 0-9 _)</small></label>
            <input class="form-control" id="${mid}_renameNewName" placeholder="new_field_name" pattern="^[a-z][a-z0-9_]*$" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="_seCall('${id}','closeRenameModal')">Cancel</button>
          <button class="btn btn-primary" id="${mid}_renameSaveBtn" onclick="_seCall('${id}','saveRename')">Rename</button>
        </div>
      </div>
    </div>`;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    while (wrapper.firstChild) target.appendChild(wrapper.firstChild);
  }

  /**
   * Returns modal HTML as a string (for pages that embed modals in their
   * own render function instead of calling injectModals).
   */
  getModalsHTML() {
    this._modalsInjected = true;
    const id = this.id;
    const mid = this._mid;
    const ver = this.getSchemaVersion();

    return `
    <!-- Schema Editor Modal (${this.entityLabel}) -->
    <div class="modal-overlay hidden" id="${mid}_modal">
      <div class="modal" style="max-width:900px;max-height:90vh;">
        <div class="modal-header">
          <span class="modal-title" id="${mid}_title">${this._esc(this.entityLabel)} Schema Editor <small style="color:var(--text-muted);font-weight:normal;">v${ver}</small></span>
          <button class="modal-close" onclick="_seCall('${id}','close')">×</button>
        </div>
        <div class="modal-body" id="${mid}_body" style="overflow-y:auto;max-height:60vh;"></div>
        <div class="modal-footer" style="justify-content:space-between;">
          <div id="${mid}_status" style="font-size:12px;color:var(--text-muted);"></div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-secondary btn-sm" onclick="_seCall('${id}','triggerRebuild')" title="Force FTS + VectorDB rebuild">🔄 Rebuild</button>
            <button class="btn btn-secondary btn-sm" onclick="_seCall('${id}','openAddField')">＋ Add Field</button>
            <button class="btn btn-secondary" onclick="_seCall('${id}','close')">Close</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Field Modal (${this.entityLabel}) -->
    <div class="modal-overlay hidden" id="${mid}_fieldModal">
      <div class="modal" style="max-width:550px;">
        <div class="modal-header">
          <span class="modal-title" id="${mid}_fieldTitle">Add Field</span>
          <button class="modal-close" onclick="_seCall('${id}','closeFieldModal')">×</button>
        </div>
        <div class="modal-body" id="${mid}_fieldBody"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="_seCall('${id}','closeFieldModal')">Cancel</button>
          <button class="btn btn-primary" id="${mid}_fieldSaveBtn" onclick="_seCall('${id}','saveField')">Add Field</button>
        </div>
      </div>
    </div>

    <!-- Rename Field Modal (${this.entityLabel}) -->
    <div class="modal-overlay hidden" id="${mid}_renameModal">
      <div class="modal" style="max-width:400px;">
        <div class="modal-header">
          <span class="modal-title">Rename Field</span>
          <button class="modal-close" onclick="_seCall('${id}','closeRenameModal')">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Current name</label>
            <input class="form-control" id="${mid}_renameOldName" disabled />
          </div>
          <div class="form-group">
            <label class="form-label">New name <small style="color:var(--text-muted);">(lowercase, a-z 0-9 _)</small></label>
            <input class="form-control" id="${mid}_renameNewName" placeholder="new_field_name" pattern="^[a-z][a-z0-9_]*$" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="_seCall('${id}','closeRenameModal')">Cancel</button>
          <button class="btn btn-primary" id="${mid}_renameSaveBtn" onclick="_seCall('${id}','saveRename')">Rename</button>
        </div>
      </div>
    </div>`;
  }

  /* ═════════════════════════════════════════════════════════════════════════ */
  /*  Open / Close                                                            */
  /* ═════════════════════════════════════════════════════════════════════════ */

  async open() {
    await this.loadSchema();
    this._activeTab = 'fields';
    this._renderModal();
    document.getElementById(`${this._mid}_modal`).classList.remove('hidden');
    this._startRebuildPoll();
  }

  close() {
    document.getElementById(`${this._mid}_modal`).classList.add('hidden');
    this._stopRebuildPoll();
    this.onClose();
  }

  /* ═════════════════════════════════════════════════════════════════════════ */
  /*  Main modal chrome                                                       */
  /* ═════════════════════════════════════════════════════════════════════════ */

  _renderModal() {
    const container = document.getElementById(`${this._mid}_body`);
    if (!container) return;

    const schema = this.getSchema();
    container.innerHTML = `
      <!-- Tabs -->
      <div class="se-tabs" style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:16px;">
        <button id="${this._mid}_tabFields" class="se-tab ${this._activeTab === 'fields' ? 'se-tab--active' : ''}"
                onclick="_seCall('${this.id}','_switchTab','fields')">
          Fields <span class="badge badge-neutral" style="font-size:10px;margin-left:4px;">${schema.length}</span>
        </button>
        <button id="${this._mid}_tabHistory" class="se-tab ${this._activeTab === 'history' ? 'se-tab--active' : ''}"
                onclick="_seCall('${this.id}','_switchTab','history')">
          History
        </button>
      </div>

      <!-- Tab bodies -->
      <div id="${this._mid}_fieldsPanel" style="${this._activeTab === 'fields' ? '' : 'display:none;'}">
        ${this._renderFieldsTable()}
      </div>
      <div id="${this._mid}_historyPanel" style="${this._activeTab === 'history' ? '' : 'display:none;'}">
        <div id="${this._mid}_historyContent" style="font-size:13px;color:var(--text-muted);">Loading…</div>
      </div>
    `;

    this._injectStyles();
    if (this._activeTab === 'history') this._loadHistory();
  }

  /* ═════════════════════════════════════════════════════════════════════════ */
  /*  Tab switching                                                           */
  /* ═════════════════════════════════════════════════════════════════════════ */

  _switchTab(tab) {
    this._activeTab = tab;
    document.getElementById(`${this._mid}_tabFields`).className = `se-tab ${tab === 'fields' ? 'se-tab--active' : ''}`;
    document.getElementById(`${this._mid}_tabHistory`).className = `se-tab ${tab === 'history' ? 'se-tab--active' : ''}`;
    document.getElementById(`${this._mid}_fieldsPanel`).style.display = tab === 'fields' ? '' : 'none';
    document.getElementById(`${this._mid}_historyPanel`).style.display = tab === 'history' ? '' : 'none';

    if (tab === 'history') this._loadHistory();
  }

  /* ═════════════════════════════════════════════════════════════════════════ */
  /*  Fields table (sortable rows)                                            */
  /* ═════════════════════════════════════════════════════════════════════════ */

  _renderFieldsTable() {
    const schema = this.getSchema();
    if (!schema.length) {
      return `<div style="text-align:center;padding:32px;color:var(--text-muted);">No fields defined. Click <strong>+ Add Field</strong> to get started.</div>`;
    }

    const id = this.id;
    const rows = schema.map((f, idx) => {
      const badges = [];
      if (f.is_required)       badges.push('<span class="badge badge-danger" style="font-size:10px;">required</span>');
      if (f.format_hint)       badges.push(`<span class="badge badge-neutral" style="font-size:10px;">🎨 ${this._esc(f.format_hint)}</span>`);
      if (f.is_fts_indexed)    badges.push(`<span class="badge badge-info" style="font-size:10px;">FTS w:${f.fts_weight}</span>`);
      if (f.is_vectordb_field) badges.push('<span class="badge badge-success" style="font-size:10px;">VectorDB</span>');
      if (f.default_value !== null && f.default_value !== undefined)
        badges.push(`<span class="badge badge-neutral" style="font-size:10px;">default: ${this._esc(f.default_value)}</span>`);

      return `<tr draggable="true" data-idx="${idx}" class="se-field-row"
                  ondragstart="_seCall('${id}','_dragStart',event,${idx})"
                  ondragover="_seCall('${id}','_dragOver',event)"
                  ondragenter="_seCall('${id}','_dragEnter',event)"
                  ondragleave="_seCall('${id}','_dragLeave',event)"
                  ondrop="_seCall('${id}','_drop',event,${idx})"
                  ondragend="_seCall('${id}','_dragEnd',event)">
        <td style="cursor:grab;text-align:center;color:var(--text-muted);width:28px;" title="Drag to reorder">⠿</td>
        <td style="font-weight:600;font-family:monospace;font-size:13px;white-space:nowrap;">${this._esc(f.name)}</td>
        <td>${this._esc(f.display_label)}</td>
        <td><code style="font-size:12px;">${this._esc(f.data_type)}</code></td>
        <td>${badges.join(' ') || '<span style="color:var(--text-muted);">—</span>'}</td>
        <td style="text-align:center;">${f.sort_order}</td>
        <td>
          <div class="td-actions" style="display:flex;gap:4px;justify-content:flex-end;">
            <button class="btn btn-secondary btn-sm btn-icon" title="Edit"   onclick="_seCall('${id}','openEditField','${this._esc(f.name)}')">✏️</button>
            <button class="btn btn-secondary btn-sm btn-icon" title="Rename" onclick="_seCall('${id}','openRenameModal','${this._esc(f.name)}')">🏷️</button>
            <button class="btn btn-danger btn-sm btn-icon"    title="Remove" onclick="_seCall('${id}','removeField','${this._esc(f.name)}')">🗑️</button>
          </div>
        </td>
      </tr>`;
    }).join('');

    return `
      <div class="table-wrap" style="overflow-x:auto;">
        <table style="width:100%;" id="${this._mid}_fieldsTable">
          <thead>
            <tr>
              <th style="width:28px;"></th>
              <th>Column Name</th>
              <th>Label</th>
              <th>Type</th>
              <th>Flags</th>
              <th style="text-align:center;">Order</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  /* ── Drag & Drop sorting ───────────────────────────────────────────────── */

  _dragStart(e, idx) {
    this._dragSrcIdx = idx;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
    setTimeout(() => e.target.closest('tr').classList.add('se-dragging'), 0);
  }

  _dragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }

  _dragEnter(e) {
    const row = e.target.closest('tr.se-field-row');
    if (row) row.classList.add('se-drag-over');
  }

  _dragLeave(e) {
    const row = e.target.closest('tr.se-field-row');
    if (row) row.classList.remove('se-drag-over');
  }

  _dragEnd(e) {
    this._dragSrcIdx = null;
    document.querySelectorAll('.se-field-row').forEach(r => {
      r.classList.remove('se-dragging', 'se-drag-over');
    });
  }

  async _drop(e, destIdx) {
    e.preventDefault();
    const row = e.target.closest('tr.se-field-row');
    if (row) row.classList.remove('se-drag-over');

    if (this._dragSrcIdx === null || this._dragSrcIdx === destIdx) return;

    const schema = this.getSchema();

    // Reorder locally
    const moved = schema.splice(this._dragSrcIdx, 1)[0];
    schema.splice(destIdx, 0, moved);
    schema.forEach((f, i) => { f.sort_order = (i + 1) * 10; });

    // Re-render immediately for snappy feedback
    const panel = document.getElementById(`${this._mid}_fieldsPanel`);
    if (panel) panel.innerHTML = this._renderFieldsTable();

    // Persist each changed sort_order to the backend
    try {
      const updates = schema.map((f, i) =>
        adminFetch(`/${this.apiPrefix}/schema/fields/${f.name}`, {
          method: 'PUT',
          body: JSON.stringify({ sort_order: (i + 1) * 10 }),
        })
      );
      await Promise.all(updates);
      await this.loadSchema();
      showToast('Field order saved', 'success');
    } catch (err) {
      showToast('Failed to save order: ' + (err.message || err), 'error');
      await this.loadSchema();
    }

    const panel2 = document.getElementById(`${this._mid}_fieldsPanel`);
    if (panel2) panel2.innerHTML = this._renderFieldsTable();
  }

  /* ═════════════════════════════════════════════════════════════════════════ */
  /*  Add / Edit Field Modal                                                  */
  /* ═════════════════════════════════════════════════════════════════════════ */

  _fieldFormHTML(field = null) {
    const isEdit = !!field;
    const mid = this._mid;
    const fhOptions = this.formatHintOptions.map(o =>
      `<option value="${o.value}" ${(field?.format_hint || '') === o.value ? 'selected' : ''}>${this._esc(o.label)}</option>`
    ).join('');

    return `
      <div class="form-group">
        <label class="form-label">Column Name <small style="color:var(--text-muted);">(lowercase, a-z 0-9 _)</small></label>
        <input class="form-control" id="${mid}_sf_name" placeholder="e.g. color"
               value="${this._esc(field?.name || '')}" ${isEdit ? 'disabled' : ''}
               pattern="^[a-z][a-z0-9_]*$" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Display Label</label>
          <input class="form-control" id="${mid}_sf_label" placeholder="e.g. Color"
                 value="${this._esc(field?.display_label || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Data Type</label>
          <select class="form-control" id="${mid}_sf_type" ${isEdit ? 'disabled' : ''}>
            <option value="text"    ${field?.data_type === 'text'    ? 'selected' : ''}>text</option>
            <option value="integer" ${field?.data_type === 'integer' ? 'selected' : ''}>integer</option>
            <option value="real"    ${field?.data_type === 'real'    ? 'selected' : ''}>real</option>
            <option value="boolean" ${field?.data_type === 'boolean' ? 'selected' : ''}>boolean</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Default Value</label>
          <input class="form-control" id="${mid}_sf_default" placeholder="(none)"
                 value="${this._esc(field?.default_value || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Sort Order</label>
          <input class="form-control" id="${mid}_sf_sort" type="number" step="1"
                 value="${field?.sort_order ?? ''}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Display Format Hint <small style="color:var(--text-muted);">(controls table/form rendering)</small></label>
        <select class="form-control" id="${mid}_sf_format">${fhOptions}</select>
      </div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="checkbox" id="${mid}_sf_required" ${field?.is_required ? 'checked' : ''} /> Required
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="checkbox" id="${mid}_sf_fts" ${field?.is_fts_indexed ? 'checked' : ''}
                 onchange="document.getElementById('${mid}_sf_fts_wrap').style.display=this.checked?'':'none'" /> FTS Indexed
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="checkbox" id="${mid}_sf_vdb" ${field?.is_vectordb_field ? 'checked' : ''}
                 onchange="document.getElementById('${mid}_sf_vdb_wrap').style.display=this.checked?'':'none'" /> VectorDB Field
        </label>
      </div>
      <div class="form-row" style="margin-top:12px;">
        <div class="form-group" id="${mid}_sf_fts_wrap" style="${field?.is_fts_indexed ? '' : 'display:none'}">
          <label class="form-label">FTS Weight</label>
          <input class="form-control" id="${mid}_sf_fts_weight" type="number" step="0.1" min="0" max="100"
                 value="${field?.fts_weight ?? 1.0}" />
        </div>
        <div class="form-group" id="${mid}_sf_vdb_wrap" style="${field?.is_vectordb_field ? '' : 'display:none'}">
          <label class="form-label">VectorDB Template</label>
          <input class="form-control" id="${mid}_sf_vdb_tpl" placeholder="{display_label}: {value}"
                 value="${this._esc(field?.vectordb_template || '')}" />
        </div>
      </div>`;
  }

  openAddField() {
    this._editingFieldName = null;
    const mid = this._mid;
    document.getElementById(`${mid}_fieldTitle`).textContent = 'Add Field';
    document.getElementById(`${mid}_fieldBody`).innerHTML = this._fieldFormHTML(null);
    document.getElementById(`${mid}_fieldSaveBtn`).textContent = 'Add Field';
    document.getElementById(`${mid}_fieldModal`).classList.remove('hidden');
  }

  openEditField(name) {
    const field = this.getSchema().find(f => f.name === name);
    if (!field) return;
    this._editingFieldName = name;
    const mid = this._mid;
    document.getElementById(`${mid}_fieldTitle`).textContent = `Edit Field — ${name}`;
    document.getElementById(`${mid}_fieldBody`).innerHTML = this._fieldFormHTML(field);
    document.getElementById(`${mid}_fieldSaveBtn`).textContent = 'Save Changes';
    document.getElementById(`${mid}_fieldModal`).classList.remove('hidden');
  }

  closeFieldModal() {
    document.getElementById(`${this._mid}_fieldModal`).classList.add('hidden');
    this._editingFieldName = null;
  }

  async saveField() {
    const mid = this._mid;
    const btn = document.getElementById(`${mid}_fieldSaveBtn`);
    btn.disabled = true;
    try {
      if (this._editingFieldName) {
        /* ── Edit existing field ────────────────────────────────────── */
        const payload = {};
        const label = document.getElementById(`${mid}_sf_label`).value.trim();
        if (label) payload.display_label = label;
        payload.default_value     = document.getElementById(`${mid}_sf_default`).value.trim() || null;
        const so = document.getElementById(`${mid}_sf_sort`).value.trim();
        if (so !== '') payload.sort_order = parseInt(so, 10);
        payload.is_required       = document.getElementById(`${mid}_sf_required`).checked;
        const fh = document.getElementById(`${mid}_sf_format`).value;
        payload.format_hint       = fh || null;
        payload.is_fts_indexed    = document.getElementById(`${mid}_sf_fts`).checked;
        payload.fts_weight        = parseFloat(document.getElementById(`${mid}_sf_fts_weight`).value) || 1.0;
        payload.is_vectordb_field = document.getElementById(`${mid}_sf_vdb`).checked;
        const vt = document.getElementById(`${mid}_sf_vdb_tpl`).value.trim();
        if (vt) payload.vectordb_template = vt;

        const resp = await adminFetch(`/${this.apiPrefix}/schema/fields/${this._editingFieldName}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast(resp.message || 'Field updated', 'success');
      } else {
        /* ── Add new field ──────────────────────────────────────────── */
        const name = document.getElementById(`${mid}_sf_name`).value.trim();
        if (!name)  { showToast('Column name is required', 'warning'); btn.disabled = false; return; }
        const label = document.getElementById(`${mid}_sf_label`).value.trim();
        if (!label) { showToast('Display label is required', 'warning'); btn.disabled = false; return; }

        const resp = await adminFetch(`/${this.apiPrefix}/schema/fields`, {
          method: 'POST',
          body: JSON.stringify({
            name,
            display_label:    label,
            data_type:        document.getElementById(`${mid}_sf_type`).value,
            is_required:      document.getElementById(`${mid}_sf_required`).checked,
            default_value:    document.getElementById(`${mid}_sf_default`).value.trim() || null,
            format_hint:      document.getElementById(`${mid}_sf_format`).value || null,
            is_fts_indexed:   document.getElementById(`${mid}_sf_fts`).checked,
            fts_weight:       parseFloat(document.getElementById(`${mid}_sf_fts_weight`).value) || 1.0,
            is_vectordb_field: document.getElementById(`${mid}_sf_vdb`).checked,
            vectordb_template: document.getElementById(`${mid}_sf_vdb_tpl`).value.trim() || null,
            sort_order:       parseInt(document.getElementById(`${mid}_sf_sort`).value) || null,
          }),
        });
        showToast(resp.message || 'Field added', 'success');
      }
      this.closeFieldModal();
      await this.loadSchema();
      this._refreshFieldsPanel();
    } catch (err) { showToast(err.message, 'error'); }
    finally { btn.disabled = false; }
  }

  /* ═════════════════════════════════════════════════════════════════════════ */
  /*  Rename Field Modal                                                      */
  /* ═════════════════════════════════════════════════════════════════════════ */

  openRenameModal(name) {
    const mid = this._mid;
    document.getElementById(`${mid}_renameOldName`).value = name;
    document.getElementById(`${mid}_renameNewName`).value = '';
    document.getElementById(`${mid}_renameModal`).classList.remove('hidden');
  }

  closeRenameModal() {
    document.getElementById(`${this._mid}_renameModal`).classList.add('hidden');
  }

  async saveRename() {
    const mid = this._mid;
    const oldName = document.getElementById(`${mid}_renameOldName`).value;
    const newName = document.getElementById(`${mid}_renameNewName`).value.trim();
    if (!newName) { showToast('New name is required', 'warning'); return; }
    if (!/^[a-z][a-z0-9_]*$/.test(newName)) { showToast('Name must be lowercase a-z, 0-9, _', 'warning'); return; }
    const btn = document.getElementById(`${mid}_renameSaveBtn`);
    btn.disabled = true;
    try {
      const resp = await adminFetch(`/${this.apiPrefix}/schema/fields/${oldName}/rename`, {
        method: 'POST',
        body: JSON.stringify({ new_name: newName }),
      });
      showToast(resp.message || 'Field renamed', 'success');
      this.closeRenameModal();
      await this.loadSchema();
      this._refreshFieldsPanel();
    } catch (err) { showToast(err.message, 'error'); }
    finally { btn.disabled = false; }
  }

  /* ═════════════════════════════════════════════════════════════════════════ */
  /*  Remove Field                                                            */
  /* ═════════════════════════════════════════════════════════════════════════ */

  async removeField(name) {
    if (!confirm(`Remove field "${name}" from the ${this.entityLabel.toLowerCase()} schema?\n\nThis will DROP the column and all its data. This cannot be undone.`)) return;
    try {
      const resp = await adminFetch(`/${this.apiPrefix}/schema/fields/${name}`, { method: 'DELETE' });
      showToast(resp.message || 'Field removed', 'success');
      await this.loadSchema();
      this._refreshFieldsPanel();
    } catch (err) { showToast(err.message, 'error'); }
  }

  /* ═════════════════════════════════════════════════════════════════════════ */
  /*  Rebuild status indicator                                                */
  /* ═════════════════════════════════════════════════════════════════════════ */

  _startRebuildPoll() {
    this._stopRebuildPoll();
    const tick = async () => {
      try {
        const st = await adminFetch(`/${this.apiPrefix}/schema/rebuild-status`);
        const el = document.getElementById(`${this._mid}_status`);
        if (!el) return;
        const parts = [];
        if (st.fts_rebuilding)   parts.push('<span class="se-status-dot se-status-dot--active"></span> FTS rebuilding…');
        if (st.vectordb_syncing) parts.push('<span class="se-status-dot se-status-dot--active"></span> VectorDB syncing…');
        if (st.last_error)       parts.push(`<span class="se-status-dot se-status-dot--error"></span> ${this._esc(st.last_error)}`);
        if (!parts.length) {
          const ts = [];
          if (st.last_fts_rebuild)   ts.push(`FTS: ${this._shortTime(st.last_fts_rebuild)}`);
          if (st.last_vectordb_sync) ts.push(`VDB: ${this._shortTime(st.last_vectordb_sync)}`);
          parts.push(`<span class="se-status-dot se-status-dot--idle"></span> ${ts.length ? ts.join(' · ') : 'Idle'}`);
        }
        el.innerHTML = parts.join(' &nbsp;│&nbsp; ');

        if (!st.fts_rebuilding && !st.vectordb_syncing && this._rebuildPollTimer) {
          clearInterval(this._rebuildPollTimer);
          this._rebuildPollTimer = null;
        }
      } catch (_) {}
    };
    tick();
    this._rebuildPollTimer = setInterval(tick, 3000);
  }

  _stopRebuildPoll() {
    if (this._rebuildPollTimer) { clearInterval(this._rebuildPollTimer); this._rebuildPollTimer = null; }
  }

  _shortTime(iso) {
    if (!iso) return '—';
    try { return new Date(iso + 'Z').toLocaleTimeString(); } catch { return iso; }
  }

  /* ═════════════════════════════════════════════════════════════════════════ */
  /*  History tab                                                             */
  /* ═════════════════════════════════════════════════════════════════════════ */

  async _loadHistory() {
    const container = document.getElementById(`${this._mid}_historyContent`);
    if (!container) return;
    container.innerHTML = '<span style="color:var(--text-muted);">Loading…</span>';

    try {
      const data = await adminFetch(`/${this.apiPrefix}/schema/history?limit=50`);
      const entries = data.history || [];
      const currentVer = data.current_version || this.getSchemaVersion();

      if (!entries.length) {
        container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);">No schema changes recorded yet.</div>';
        return;
      }

      const versions = {};
      for (const e of entries) {
        (versions[e.version] = versions[e.version] || []).push(e);
      }
      const versionNums = Object.keys(versions).map(Number).sort((a, b) => b - a);
      const id = this.id;
      const mid = this._mid;

      let html = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <span style="font-weight:600;">Current: v${currentVer}</span>
          <div style="display:flex;gap:8px;align-items:center;">
            <label style="font-size:12px;color:var(--text-muted);">Compare:</label>
            <select id="${mid}_diffV1" class="form-control" style="width:80px;font-size:12px;">
              ${versionNums.map(v => `<option value="${v}" ${v === Math.max(0, currentVer - 1) ? 'selected' : ''}>v${v}</option>`).join('')}
              <option value="0">v0 (initial)</option>
            </select>
            <span style="color:var(--text-muted);">→</span>
            <select id="${mid}_diffV2" class="form-control" style="width:80px;font-size:12px;">
              ${versionNums.map(v => `<option value="${v}" ${v === currentVer ? 'selected' : ''}>v${v}</option>`).join('')}
            </select>
            <button class="btn btn-secondary btn-sm" onclick="_seCall('${id}','_loadDiff')">Show Diff</button>
          </div>
        </div>

        <div id="${mid}_diffOutput" style="margin-bottom:16px;"></div>

        <table style="width:100%;font-size:13px;">
          <thead>
            <tr>
              <th>Version</th>
              <th>Action</th>
              <th>Field</th>
              <th>Details</th>
              <th>When</th>
              <th>By</th>
            </tr>
          </thead>
          <tbody>
            ${entries.map(e => {
              const actionColor = { add: 'success', remove: 'danger', edit: 'info', rename: 'warning' }[e.action] || 'neutral';
              const details = this._formatChangeDetails(e);
              return `<tr>
                <td><strong>v${e.version}</strong></td>
                <td><span class="badge badge-${actionColor}" style="font-size:10px;">${this._esc(e.action)}</span></td>
                <td style="font-family:monospace;font-size:12px;">${this._esc(e.field_name)}</td>
                <td style="font-size:12px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${this._esc(details)}">${details}</td>
                <td style="white-space:nowrap;">${this._shortTime(e.changed_at)}</td>
                <td>${this._esc(e.changed_by)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`;

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<span style="color:var(--danger);">${this._esc(err.message)}</span>`;
    }
  }

  _formatChangeDetails(entry) {
    if (entry.action === 'add' && entry.new_definition) {
      const nd = entry.new_definition;
      return `${nd.data_type || 'text'}${nd.is_required ? ', required' : ''}`;
    }
    if (entry.action === 'remove' && entry.old_definition) {
      return `was: ${entry.old_definition.data_type || 'text'}`;
    }
    if (entry.action === 'rename' && entry.new_definition) {
      return `→ ${entry.new_definition.name || '?'}`;
    }
    if (entry.action === 'edit' && entry.old_definition && entry.new_definition) {
      const changes = [];
      for (const key of Object.keys(entry.new_definition)) {
        if (JSON.stringify(entry.old_definition[key]) !== JSON.stringify(entry.new_definition[key])) {
          changes.push(`${key}: ${entry.old_definition[key]} → ${entry.new_definition[key]}`);
        }
      }
      return changes.join('; ') || '—';
    }
    return '—';
  }

  /* ── Side-by-side diff viewer ──────────────────────────────────────────── */

  async _loadDiff() {
    const mid = this._mid;
    const v1 = parseInt(document.getElementById(`${mid}_diffV1`).value, 10);
    const v2 = parseInt(document.getElementById(`${mid}_diffV2`).value, 10);
    const output = document.getElementById(`${mid}_diffOutput`);
    if (!output) return;

    if (v1 >= v2) { output.innerHTML = '<span style="color:var(--danger);font-size:13px;">v1 must be less than v2</span>'; return; }

    output.innerHTML = '<span style="color:var(--text-muted);font-size:13px;">Loading diff…</span>';

    try {
      const diff = await adminFetch(`/${this.apiPrefix}/schema/diff?v1=${v1}&v2=${v2}`);

      if (!diff.total_changes) {
        output.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:13px;">No changes between these versions.</div>';
        return;
      }

      let html = `
        <div class="se-diff-container">
          <div class="se-diff-header">
            <span>v${diff.from_version} → v${diff.to_version} — ${diff.total_changes} change(s)</span>
          </div>
          <div class="se-diff-body">`;

      for (const a of (diff.added || [])) {
        html += `
          <div class="se-diff-row se-diff-row--added">
            <div class="se-diff-side se-diff-side--old"><span class="se-diff-empty">—</span></div>
            <div class="se-diff-side se-diff-side--new">
              <span class="se-diff-badge">+ added</span>
              <strong>${this._esc(a.name || a.field_name || '?')}</strong>
              <code>${this._esc(a.data_type || 'text')}</code>
              ${a.is_required ? '<span class="badge badge-danger" style="font-size:9px;">required</span>' : ''}
            </div>
          </div>`;
      }

      for (const r of (diff.removed || [])) {
        html += `
          <div class="se-diff-row se-diff-row--removed">
            <div class="se-diff-side se-diff-side--old">
              <span class="se-diff-badge">− removed</span>
              <strong>${this._esc(r.name || r.field_name || '?')}</strong>
              <code>${this._esc(r.data_type || 'text')}</code>
            </div>
            <div class="se-diff-side se-diff-side--new"><span class="se-diff-empty">—</span></div>
          </div>`;
      }

      for (const m of (diff.modified || [])) {
        const oldDef = m.old || m.old_definition || {};
        const newDef = m.new || m.new_definition || {};
        const fname  = m.field_name || m.name || '?';
        const allKeys = new Set([...Object.keys(oldDef), ...Object.keys(newDef)]);
        const changed = [];
        for (const k of allKeys) {
          if (JSON.stringify(oldDef[k]) !== JSON.stringify(newDef[k])) changed.push(k);
        }

        html += `
          <div class="se-diff-row se-diff-row--modified">
            <div class="se-diff-side se-diff-side--old">
              <span class="se-diff-badge">~ modified</span>
              <strong>${this._esc(fname)}</strong>
              <div class="se-diff-props">
                ${changed.map(k => `<div><span class="se-diff-key">${this._esc(k)}:</span> <span class="se-diff-val se-diff-val--old">${this._esc(JSON.stringify(oldDef[k]))}</span></div>`).join('')}
              </div>
            </div>
            <div class="se-diff-side se-diff-side--new">
              <span class="se-diff-badge">~ modified</span>
              <strong>${this._esc(fname)}</strong>
              <div class="se-diff-props">
                ${changed.map(k => `<div><span class="se-diff-key">${this._esc(k)}:</span> <span class="se-diff-val se-diff-val--new">${this._esc(JSON.stringify(newDef[k]))}</span></div>`).join('')}
              </div>
            </div>
          </div>`;
      }

      html += '</div></div>';
      output.innerHTML = html;
    } catch (err) {
      output.innerHTML = `<span style="color:var(--danger);font-size:13px;">Diff failed: ${this._esc(err.message)}</span>`;
    }
  }

  /* ── Manual rebuild ────────────────────────────────────────────────────── */

  async triggerRebuild() {
    if (!confirm(`Trigger a manual FTS + VectorDB rebuild for ${this.entityLabel}?`)) return;
    try {
      const resp = await adminFetch(`/${this.apiPrefix}/schema/rebuild`, { method: 'POST' });
      showToast(resp.message || 'Rebuild queued', 'success');
      this._startRebuildPoll();
    } catch (err) { showToast(err.message || 'Rebuild failed', 'error'); }
  }

  /* ═════════════════════════════════════════════════════════════════════════ */
  /*  Utility                                                                 */
  /* ═════════════════════════════════════════════════════════════════════════ */

  _refreshFieldsPanel() {
    const panel = document.getElementById(`${this._mid}_fieldsPanel`);
    if (panel) panel.innerHTML = this._renderFieldsTable();
    const tabBtn = document.getElementById(`${this._mid}_tabFields`);
    if (tabBtn) {
      tabBtn.innerHTML = `📋 Fields <span class="badge badge-neutral" style="font-size:10px;margin-left:4px;">${this.getSchema().length}</span>`;
    }
    this._updateTitle();
  }

  _updateTitle() {
    const titleEl = document.getElementById(`${this._mid}_title`);
    if (titleEl) {
      titleEl.innerHTML = `${this._esc(this.entityLabel)} Schema Editor <small style="color:var(--text-muted);font-weight:normal;">v${this.getSchemaVersion()}</small>`;
    }
  }

  /* ═════════════════════════════════════════════════════════════════════════ */
  /*  Inject scoped CSS (once, shared across all instances)                   */
  /* ═════════════════════════════════════════════════════════════════════════ */

  _injectStyles() {
    if (SchemaEditor._stylesInjected) return;
    SchemaEditor._stylesInjected = true;

    const style = document.createElement('style');
    style.textContent = `
      /* ── Tabs ──────────────────────────────────────────────────────── */
      .se-tab {
        background: none; border: none;
        border-bottom: 2px solid transparent;
        padding: 8px 16px; font-size: 14px; font-weight: 500;
        color: var(--text-muted); cursor: pointer;
        transition: color .15s, border-color .15s;
      }
      .se-tab:hover { color: var(--text); }
      .se-tab--active { color: var(--primary); border-bottom-color: var(--primary); }

      /* ── Drag & drop rows ─────────────────────────────────────────── */
      .se-field-row { transition: background .15s; }
      .se-field-row.se-dragging { opacity: 0.4; }
      .se-field-row.se-drag-over { background: var(--bg-secondary); box-shadow: inset 0 -2px 0 var(--primary); }

      /* ── Rebuild status dots ──────────────────────────────────────── */
      .se-status-dot {
        display: inline-block; width: 8px; height: 8px;
        border-radius: 50%; margin-right: 4px; vertical-align: middle;
      }
      .se-status-dot--idle   { background: #22c55e; }
      .se-status-dot--active { background: #f59e0b; animation: se-pulse 1s infinite; }
      .se-status-dot--error  { background: #ef4444; }
      @keyframes se-pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }

      /* ── Diff viewer ──────────────────────────────────────────────── */
      .se-diff-container { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; font-size: 13px; }
      .se-diff-header { background: var(--bg-secondary); padding: 8px 12px; font-weight: 600; border-bottom: 1px solid var(--border); }
      .se-diff-row { display: flex; border-bottom: 1px solid var(--border); }
      .se-diff-row:last-child { border-bottom: none; }
      .se-diff-side { flex: 1; padding: 10px 12px; min-width: 0; }
      .se-diff-side--old { border-right: 1px solid var(--border); }
      .se-diff-row--added .se-diff-side--new    { background: rgba(34,197,94,0.06); }
      .se-diff-row--removed .se-diff-side--old  { background: rgba(239,68,68,0.06); }
      .se-diff-row--modified .se-diff-side--old  { background: rgba(245,158,11,0.04); }
      .se-diff-row--modified .se-diff-side--new  { background: rgba(34,197,94,0.04); }
      .se-diff-empty { color: var(--text-muted); font-style: italic; }
      .se-diff-badge {
        display: inline-block; font-size: 10px; font-weight: 600;
        text-transform: uppercase; padding: 1px 6px; border-radius: 4px;
        margin-right: 6px; vertical-align: middle;
      }
      .se-diff-row--added    .se-diff-badge { background:#dcfce7;color:#15803d; }
      .se-diff-row--removed  .se-diff-badge { background:#fee2e2;color:#b91c1c; }
      .se-diff-row--modified .se-diff-badge { background:#fef9c3;color:#854d0e; }
      .se-diff-props { margin-top: 6px; line-height: 1.7; }
      .se-diff-key { color: var(--text-muted); font-size: 12px; }
      .se-diff-val { font-family: monospace; font-size: 12px; }
      .se-diff-val--old { color: #b91c1c; text-decoration: line-through; }
      .se-diff-val--new { color: #15803d; font-weight: 600; }

      /* Dark mode diff */
      [data-theme="dark"] .se-diff-row--added .se-diff-side--new     { background: rgba(34,197,94,0.08); }
      [data-theme="dark"] .se-diff-row--removed .se-diff-side--old   { background: rgba(239,68,68,0.08); }
      [data-theme="dark"] .se-diff-row--modified .se-diff-side--old  { background: rgba(245,158,11,0.06); }
      [data-theme="dark"] .se-diff-row--modified .se-diff-side--new  { background: rgba(34,197,94,0.06); }
      [data-theme="dark"] .se-diff-val--old { color: #fca5a5; }
      [data-theme="dark"] .se-diff-val--new { color: #4ade80; }
      [data-theme="dark"] .se-diff-row--added    .se-diff-badge { background:#052e16;color:#4ade80; }
      [data-theme="dark"] .se-diff-row--removed  .se-diff-badge { background:#1c0a0a;color:#fca5a5; }
      [data-theme="dark"] .se-diff-row--modified .se-diff-badge { background:#1c1200;color:#fcd34d; }
    `;
    document.head.appendChild(style);
  }
}

// Static flag shared across all instances
SchemaEditor._stylesInjected = false;
