/**
 * knowledge.js — Knowledge Base management (documents + URL ingestion)
 * Features: pagination, filtering, search, sorting
 */

// ── State ─────────────────────────────────────────────────────────────────────

let _allDocs = [];
let _filteredDocs = [];
let _currentChunkSettings = null;
let _knowledgeState = {
  page: 1,
  perPage: 10,
  search: '',
  typeFilter: 'all', // 'all' | 'file' | 'url'
  sortBy: 'upload_date',
  sortDir: 'desc',
};

// ── Render ────────────────────────────────────────────────────────────────────

async function renderKnowledge() {
  const body = document.getElementById('pageBody');
  body.innerHTML = `
    <div class="mb-6" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <!-- Upload file -->
      <div class="card">
        <div class="card-header"><span class="card-title" style="font-size: 15px; font-weight: 600;">Upload File</span></div>
        <div class="card-body">
          <div class="upload-area" id="uploadArea" onclick="document.getElementById('fileInput').click()">
            <div class="upload-icon">⬆</div>
            <div class="upload-text"><strong>Click to browse</strong> or drag &amp; drop</div>
            <div class="upload-text" style="margin-top:4px;font-size:12px;">PDF or TXT, max 2 MB</div>
          </div>
          <input type="file" id="fileInput" accept=".pdf,.txt,.doc,.docx,.xls,.xlsx" style="display:none" onchange="uploadFile(event)" />
          <div style="margin-top:12px;display:flex;align-items:center;gap:8px;">
            <label class="form-label" style="margin-bottom:0;white-space:nowrap;font-size:13px;">Custom ID <span style="font-weight:400;color:var(--text-muted);">(optional)</span></label>
            <input type="text" class="form-control" id="uploadCustomId" placeholder="auto" maxLength="16"
              inputmode="text"
              style="width:120px;height:32px;font-size:13px;" />
          </div>
          <div id="uploadProgress" class="hidden" style="margin-top:12px;">
            <div class="progress"><div class="progress-bar" id="uploadProgressBar" style="width:0%"></div></div>
            <p style="font-size:12px;color:var(--text-muted);margin-top:6px;" id="uploadProgressLabel">Uploading…</p>
          </div>
        </div>
      </div>

      <!-- Ingest URL -->
      <div class="card">
        <div class="card-header"><span class="card-title" style="font-size: 15px; font-weight: 600;">Ingest URLs</span></div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">Web Page URLs (one per line)</label>
            <textarea class="form-control" id="urlInput" rows="5" placeholder="https://example.com/page1&#10;https://example.com/page2&#10;https://example.com/page3"></textarea>
          </div>
          <div style="margin-bottom:10px;display:flex;align-items:center;gap:8px;">
            <label class="form-label" style="margin-bottom:0;white-space:nowrap;font-size:13px;">Custom ID <span style="font-weight:400;color:var(--text-muted);">(optional, single URL only)</span></label>
            <input type="text" class="form-control" id="urlCustomId" placeholder="auto" maxLength="16"
              inputmode="text"
              style="width:120px;height:32px;font-size:13px;" />
          </div>
          <button class="btn btn-primary" onclick="ingestUrl()" id="ingestUrlBtn">
            Ingest URLs
          </button>
          <div id="urlProgress" class="hidden" style="margin-top:12px;">
            <div class="progress"><div class="progress-bar" id="urlProgressBar" style="width:0%"></div></div>
            <p style="font-size:12px;color:var(--text-muted);margin-top:6px;" id="urlProgressLabel">Fetching…</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Document Modal -->
    <div id="editDocModal" class="modal-overlay hidden">
      <div class="modal" style="max-width: 900px;">
        <div class="modal-header">
          <h3 class="modal-title">Edit Document</h3>
          <span class="modal-close" onclick="closeEditModal()">&times;</span>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Document ID <span style="font-weight:400;color:var(--text-muted);font-size:12px;">— change to reassign ID</span></label>
            <input type="text" class="form-control" id="editDocId" maxLength="16" />
          </div>
          <div class="form-group">
            <label class="form-label">Filename</label>
            <input type="text" class="form-control" id="editDocFilename" required />
          </div>
          <div class="form-group" id="editDocPathGroup">
            <label class="form-label">URL/Path</label>
            <input type="text" class="form-control" id="editDocPath" />
          </div>
          <div class="form-group">
            <label class="form-label">Content</label>
            <textarea class="form-control" id="editDocContent" rows="15" style="font-family: monospace; font-size: 13px;"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Type</label>
            <input type="text" class="form-control" id="editDocType" readonly disabled />
          </div>

          <!-- ✨ KBC Improvement Panel -->
          <div style="border:1px solid var(--border);border-radius:10px;padding:18px 16px 14px;margin-top:8px;background:var(--card-bg);">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border);">
              <span style="font-size:16px;filter:grayscale(1);opacity:0.6;">✦</span>
              <span style="font-weight:600;font-size:14px;color:var(--text);">Content Improvement</span>
              <span style="font-size:11px;padding:2px 8px;border-radius:4px;background:var(--border);color:var(--text-muted);font-weight:600;letter-spacing:.5px;">AI</span>
            </div>
            <!-- ✨ AI Improvement Panel: AFTER Split -->
            <div class="form-group" style="margin-bottom:10px;">
              <label class="form-label" style="font-size:12px;">Expected Questions <span style="font-weight:400;color:var(--text-muted);">(optional — helps the AI tune the content)</span></label>
              <textarea class="form-control" id="improveHint" rows="3"
                style="font-size:13px;resize:vertical;"
                placeholder="e.g. What are the specifications of Honda HR-V? How much does it cost? What colors are available?"></textarea>
            </div>
            <button class="btn btn-primary" id="improveSuggestBtn"
              onclick="generateImprovement()"
              style="margin-bottom:14px;">
              ✨ Generate Suggestion
            </button>
            <div id="improveSuggestionWrap" class="hidden">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <label class="form-label" style="font-size:12px;margin-bottom:0;">AI Suggestion <span id="improveModelBadge" style="font-size:11px;padding:1px 7px;border-radius:4px;background:var(--border);color:var(--text-muted);font-weight:600;"></span></label>
                <div style="display:flex;gap:8px;">
                  <button class="btn btn-secondary btn-sm" onclick="copyImprovementToContent()"
                    style="font-size:12px;">
                    ↑ Use Suggestion
                  </button>
                  <button class="btn btn-primary btn-sm" onclick="applySuggestionAndSave()"
                    style="font-size:12px;">
                    ↑ Use &amp; Save
                  </button>
                </div>
              </div>
              <textarea class="form-control" id="improveSuggestion" rows="12"
                style="font-family:monospace;font-size:13px;resize:vertical;"></textarea>
            </div>
            <div id="improveLoading" class="hidden" style="display:flex;align-items:center;gap:10px;padding:12px 0;color:var(--text-muted);font-size:13px;">
              <div class="spinner" style="width:18px;height:18px;border:2px solid var(--border);border-top:2px solid var(--accent);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
              Generating improvement suggestion…
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <div id="editProgressBar" class="hidden" style="width:100%;margin-bottom:12px;">
            <div class="progress"><div class="progress-bar" style="width:100%;background:var(--accent);"></div></div>
            <p style="font-size:12px;color:var(--text-muted);margin-top:6px;" id="editProgressLabel">Saving changes...</p>
          </div>
          <button class="btn btn-secondary" onclick="closeEditModal()" id="editCancelBtn">Cancel</button>
          <button class="btn btn-primary" onclick="saveDocumentEdit()" id="editSaveBtn">Save Changes</button>
        </div>
      </div>
    </div>

    <!-- Stale chunk warning (populated after documents load) -->
    <div id="staleChunkBanner" style="margin-bottom:16px;"></div>

    <!-- Document library -->
    <div class="card">
      <div class="card-header" style="flex-wrap:wrap;gap:12px;">
        <span class="card-title" style="font-size: 15px; font-weight: 600;">Document Library</span>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <!-- Search -->
          <input type="text" class="form-control" id="docSearch" placeholder="Search filename…"
            style="width:200px;height:34px;" oninput="onDocSearch(this.value)" />
          <!-- Type filter -->
          <select class="form-control" id="docTypeFilter" style="width:120px;height:34px;" onchange="onDocTypeFilter(this.value)">
            <option value="all">All Types</option>
            <option value="file">Files</option>
            <option value="url">URLs</option>
          </select>
          <!-- Per page -->
          <select class="form-control" id="docPerPage" style="width:90px;height:34px;" onchange="onDocPerPage(this.value)">
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
          <button class="btn btn-secondary btn-sm" onclick="loadDocuments()">Refresh</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title / Filename</th>
              <th>Type</th>
              <th class="sortable" data-sort="chunk_count" onclick="onDocSort('chunk_count')">
                Chunks <span id="sortIcon_chunk_count"></span>
              </th>
              <th class="sortable" data-sort="file_size" onclick="onDocSort('file_size')">
                Size <span id="sortIcon_file_size"></span>
              </th>
              <th class="sortable" data-sort="upload_date" onclick="onDocSort('upload_date')">
                Uploaded <span id="sortIcon_upload_date"></span>
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="docTableBody">
            <tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">Loading…</td></tr>
          </tbody>
        </table>
      </div>
      <!-- Pagination -->
      <div class="card-footer" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-top:1px solid var(--border);">
        <span id="docPaginationInfo" style="font-size:13px;color:var(--text-muted);"></span>
        <div id="docPagination" style="display:flex;gap:4px;"></div>
      </div>
    </div>
  `;

  // Drag & drop
  const area = document.getElementById('uploadArea');
  area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('drag-over'); });
  area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
  area.addEventListener('drop', e => {
    e.preventDefault();
    area.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  });

  // Restore state to UI
  document.getElementById('docPerPage').value = _knowledgeState.perPage;
  document.getElementById('docTypeFilter').value = _knowledgeState.typeFilter;
  document.getElementById('docSearch').value = _knowledgeState.search;

  await loadChunkSettings();
  await loadDocuments();
}

// ── Load & Display Documents ──────────────────────────────────────────────────

async function loadDocuments() {
  const tbody = document.getElementById('docTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">Loading…</td></tr>';

  try {
    const data = await apiFetch('/documents');
    _allDocs = data.documents || [];
    applyDocFilters();
    checkStaleChunks();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:var(--danger);padding:16px;">${err.message}</td></tr>`;
    showToast(err.message, 'error');
  }
}

  async function quickSplitDocument(docId, filename, fileSize = 0) {
    const safeName = filename || 'this document';
    const bytes = Number(fileSize || 0);
    const suggested = Math.max(2, Math.min(20, bytes > 0 ? Math.ceil(bytes / (30 * 1024)) : 2));

    const raw = window.prompt(
      `Split "${safeName}" into how many files?\n\nSuggested: ${suggested} file(s) (about 30KB per file)\nRange: 2-20\n\nOriginal file will be removed by default to avoid duplicate KB content.`,
      String(suggested)
    );
    if (raw == null) return;

    const parts = Math.floor(Number(raw));
    if (!Number.isFinite(parts) || parts < 2 || parts > 20) {
      showToast('Split count must be an integer between 2 and 20', 'error');
      return;
    }

    const confirmed = window.confirm(
      `Split "${safeName}" into ${parts} files and remove the original file?\n\nThis helps avoid duplicate KB content.`
    );
    if (!confirmed) return;

    try {
      showToast(`Splitting into ${parts} files...`, 'info');
      const data = await adminFetch(`/documents/${docId}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parts,
          keep_original: false,
          overlap_units: 1,
        }),
      });

      const count = data?.created_count || parts;
      showToast(`✅ Split complete: created ${count} files. Original removed.`, data?.bm25_only ? 'warning' : 'success');
      await loadDocuments();
    } catch (err) {
      showToast('Failed to split document: ' + err.message, 'error');
    }
  }

async function loadChunkSettings() {
  try {
    const data = await adminFetch('/settings/llm');
    _currentChunkSettings = {
      chunk_size:    data.chunk_size    ?? 500,
      chunk_overlap: data.chunk_overlap ?? 50,
    };
  } catch (_) {
    _currentChunkSettings = null;
  }
}

function checkStaleChunks() {
  const banner = document.getElementById('staleChunkBanner');
  if (!banner || !_currentChunkSettings || _allDocs.length === 0) { if (banner) banner.innerHTML = ''; return; }

  const { chunk_size, chunk_overlap } = _currentChunkSettings;
  const staleDocs = _allDocs.filter(d =>
    (d.chunk_size    != null && d.chunk_size    !== chunk_size) ||
    (d.chunk_overlap != null && d.chunk_overlap !== chunk_overlap)
  );

  if (staleDocs.length === 0) { banner.innerHTML = ''; return; }

  const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  banner.innerHTML = `
    <div style="padding:12px 16px;background:#fef3c7;border:1px solid #fbbf24;
                border-radius:8px;display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;">
      <span style="font-size:20px;line-height:1.4;">⚠️</span>
      <div style="flex:1;min-width:200px;">
        <div style="font-weight:600;color:#92400e;font-size:13px;margin-bottom:4px;">
          Chunk settings changed — ${staleDocs.length} document${staleDocs.length > 1 ? 's' : ''} indexed with old settings
        </div>
        <div style="font-size:12px;color:#78350f;margin-bottom:8px;">
          Current: <strong>chunk_size = ${chunk_size}</strong>, <strong>overlap = ${chunk_overlap}</strong>.
          The documents below used different settings and may have inconsistent retrieval quality.
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
          ${staleDocs.slice(0, 6).map(d =>
            `<span style="background:#fde68a;color:#92400e;padding:2px 8px;border-radius:4px;
                          font-size:11px;font-weight:600;white-space:nowrap;">
              ${esc(d.filename)} (${d.chunk_size ?? '?'} / ${d.chunk_overlap ?? '?'})
            </span>`).join('')}
          ${staleDocs.length > 6
            ? `<span style="font-size:11px;color:#92400e;line-height:1.9;">+${staleDocs.length - 6} more</span>`
            : ''}
        </div>
        <button class="btn btn-sm"
          onclick="startReindex(null)"
          style="background:#d97706;color:#fff;border-color:#d97706;font-size:12px;">
          🔄 Re-index All (${staleDocs.length}) Documents
        </button>
      </div>
    </div>`;
}

function applyDocFilters() {
  const { search, typeFilter, sortBy, sortDir } = _knowledgeState;

  // Filter
  let docs = _allDocs.slice();

  // Type filter
  if (typeFilter === 'file') {
    docs = docs.filter(d => d.file_type !== '.url');
  } else if (typeFilter === 'url') {
    docs = docs.filter(d => d.file_type === '.url');
  }

  // Search
  if (search.trim()) {
    const q = search.toLowerCase();
    docs = docs.filter(d => (d.filename || '').toLowerCase().includes(q) || (d.file_path || '').toLowerCase().includes(q));
  }

  // Sort
  docs.sort((a, b) => {
    let va = a[sortBy];
    let vb = b[sortBy];
    // Handle nulls
    if (va == null) va = sortBy === 'upload_date' ? '' : 0;
    if (vb == null) vb = sortBy === 'upload_date' ? '' : 0;
    // Compare
    if (typeof va === 'string') {
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return sortDir === 'asc' ? va - vb : vb - va;
  });

  _filteredDocs = docs;
  renderDocTable();
  updateSortIcons();
}

function renderDocTable() {
  const { page, perPage } = _knowledgeState;
  const totalDocs = _filteredDocs.length;
  const totalPages = Math.max(1, Math.ceil(totalDocs / perPage));

  // Clamp page
  if (_knowledgeState.page > totalPages) _knowledgeState.page = totalPages;
  const currentPage = _knowledgeState.page;

  const start = (currentPage - 1) * perPage;
  const end = Math.min(start + perPage, totalDocs);
  const pageDocs = _filteredDocs.slice(start, end);

  const tbody = document.getElementById('docTableBody');
  if (!pageDocs.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><p>No documents match your filters.</p></div></td></tr>';
  } else {
    const parseSplitMeta = (filename) => {
      const m = /^(.*)\s+\(Part\s+(\d+)\/(\d+)\)$/.exec(filename || '');
      if (!m) return null;
      return {
        baseName: (m[1] || '').trim(),
        partIndex: Number(m[2] || 0),
        partTotal: Number(m[3] || 0),
      };
    };

    const splitGroups = new Map();
    pageDocs.forEach(doc => {
      const meta = parseSplitMeta(doc.filename);
      if (!meta) return;
      const key = meta.baseName.toLowerCase();
      if (!splitGroups.has(key)) {
        splitGroups.set(key, { baseName: meta.baseName, docs: [] });
      }
      splitGroups.get(key).docs.push({ doc, meta });
    });

    const renderedGroups = new Set();
    const rows = [];

    pageDocs.forEach(doc => {
      const meta = parseSplitMeta(doc.filename);
      if (!meta) {
        rows.push({ type: 'doc', doc, meta: null, isChild: false });
        return;
      }

      const key = meta.baseName.toLowerCase();
      if (renderedGroups.has(key)) return;
      renderedGroups.add(key);

      const group = splitGroups.get(key);
      if (!group) {
        rows.push({ type: 'doc', doc, meta, isChild: true });
        return;
      }

      rows.push({ type: 'group', baseName: group.baseName, count: group.docs.length });
      group.docs
        .slice()
        .sort((a, b) => (a.meta.partIndex || 0) - (b.meta.partIndex || 0))
        .forEach(item => rows.push({ type: 'doc', doc: item.doc, meta: item.meta, isChild: true }));
    });

    tbody.innerHTML = rows.map(row => {
      if (row.type === 'group') {
        return `
          <tr>
            <td colspan="6" style="background:var(--surface, #f8fafc);border-top:1px dashed var(--border);border-bottom:1px dashed var(--border);padding:8px 12px;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                <div style="font-weight:600;color:var(--text);">📁 ${esc(row.baseName)}</div>
                <div style="font-size:11px;color:var(--text-muted);">${row.count} split file${row.count > 1 ? 's' : ''}</div>
              </div>
            </td>
          </tr>
        `;
      }

      const doc = row.doc;
      const meta = row.meta;
      const nameCell = row.isChild && meta
        ? `
          <div style="padding-left:16px;">
            <div style="font-weight:500;">└─ Part ${meta.partIndex}/${meta.partTotal}</div>
            ${doc.file_type === '.url' ? `<div class="text-sm text-muted truncate" style="max-width:300px;">${esc(doc.file_path)}</div>` : ''}
          </div>
        `
        : `
          <div style="font-weight:500;">${esc(doc.filename)}</div>
          ${doc.file_type === '.url' ? `<div class="text-sm text-muted truncate" style="max-width:300px;">${esc(doc.file_path)}</div>` : ''}
        `;

      return `
        <tr>
          <td>${nameCell}</td>
          <td>
            <span class="badge ${doc.file_type === '.url' ? 'badge-info' : 'badge-neutral'}">
              ${doc.file_type === '.url' ? 'URL' : (doc.file_type?.toUpperCase().replace('.','') || 'FILE')}
            </span>
          </td>
          <td>${doc.chunk_count ?? '—'}</td>
          <td>${doc.file_size ? formatSize(doc.file_size) : '—'}</td>
          <td>${doc.upload_date ? formatDate(doc.upload_date) : '—'}</td>
          <td>
            <div class="td-actions">
              <button class="btn btn-primary btn-sm" title="Edit" onclick="editDocument('${escAttr(doc.id)}')">Edit</button>
              <button class="btn btn-secondary btn-sm" title="Split into multiple files" onclick="quickSplitDocument('${escAttr(doc.id)}', '${escAttr(doc.filename)}', ${Number(doc.file_size || 0)})">Split</button>
              <button class="btn btn-sm" title="Re-index with current chunk settings" onclick="startReindex('${escAttr(doc.id)}')" style="background:#f59e0b;color:#fff;border-color:#f59e0b;">🔄</button>
              <button class="btn btn-danger btn-sm" title="Delete" onclick="deleteDocument('${escAttr(doc.id)}', '${escAttr(doc.filename)}')">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Pagination info
  const infoEl = document.getElementById('docPaginationInfo');
  if (totalDocs === 0) {
    infoEl.textContent = '0 documents';
  } else {
    infoEl.textContent = `Showing ${start + 1}–${end} of ${totalDocs} documents`;
  }

  // Pagination buttons
  renderDocPagination(currentPage, totalPages);
}

function renderDocPagination(currentPage, totalPages) {
  const container = document.getElementById('docPagination');
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';

  // Prev
  html += `<button class="btn btn-secondary btn-sm" ${currentPage === 1 ? 'disabled' : ''} onclick="goToDocPage(${currentPage - 1})">‹</button>`;

  // Page numbers (show up to 5 pages centered on current)
  const range = 2;
  let startPage = Math.max(1, currentPage - range);
  let endPage = Math.min(totalPages, currentPage + range);

  if (startPage > 1) {
    html += `<button class="btn btn-secondary btn-sm" onclick="goToDocPage(1)">1</button>`;
    if (startPage > 2) html += `<span style="padding:0 6px;color:var(--text-muted);">…</span>`;
  }

  for (let p = startPage; p <= endPage; p++) {
    const active = p === currentPage ? 'btn-primary' : 'btn-secondary';
    html += `<button class="btn ${active} btn-sm" onclick="goToDocPage(${p})">${p}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += `<span style="padding:0 6px;color:var(--text-muted);">…</span>`;
    html += `<button class="btn btn-secondary btn-sm" onclick="goToDocPage(${totalPages})">${totalPages}</button>`;
  }

  // Next
  html += `<button class="btn btn-secondary btn-sm" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToDocPage(${currentPage + 1})">›</button>`;

  container.innerHTML = html;
}

function goToDocPage(p) {
  _knowledgeState.page = p;
  renderDocTable();
}

// ── Filter/Search/Sort Handlers ───────────────────────────────────────────────

let _docSearchTimeout = null;
function onDocSearch(val) {
  clearTimeout(_docSearchTimeout);
  _docSearchTimeout = setTimeout(() => {
    _knowledgeState.search = val;
    _knowledgeState.page = 1;
    applyDocFilters();
  }, 250);
}

function onDocTypeFilter(val) {
  _knowledgeState.typeFilter = val;
  _knowledgeState.page = 1;
  applyDocFilters();
}

function onDocPerPage(val) {
  _knowledgeState.perPage = parseInt(val, 10);
  _knowledgeState.page = 1;
  applyDocFilters();
}

function onDocSort(col) {
  if (_knowledgeState.sortBy === col) {
    _knowledgeState.sortDir = _knowledgeState.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    _knowledgeState.sortBy = col;
    _knowledgeState.sortDir = col === 'upload_date' ? 'desc' : 'asc';
  }
  _knowledgeState.page = 1;
  applyDocFilters();
}

function updateSortIcons() {
  const cols = ['chunk_count', 'file_size', 'upload_date'];
  cols.forEach(c => {
    const el = document.getElementById(`sortIcon_${c}`);
    if (el) {
      if (_knowledgeState.sortBy === c) {
        el.textContent = _knowledgeState.sortDir === 'asc' ? '↑' : '↓';
      } else {
        el.textContent = '';
      }
    }
  });
}

// ── Upload & Ingest ───────────────────────────────────────────────────────────

function uploadFile(event) {
  const file = event.target.files[0];
  if (file) handleFileUpload(file);
  event.target.value = '';
}

async function handleFileUpload(file) {
  const MAX_SIZE_MB = 7;
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    showToast(`File too large. Maximum size is ${MAX_SIZE_MB} MB.`, 'error');
    return;
  }
  const progressEl = document.getElementById('uploadProgress');
  const bar = document.getElementById('uploadProgressBar');
  const label = document.getElementById('uploadProgressLabel');
  progressEl.classList.remove('hidden');
  bar.style.width = '20%';
  label.textContent = `Uploading ${file.name}…`;

  try {
    const formData = new FormData();
    formData.append('file', file);
    const customId = document.getElementById('uploadCustomId')?.value.trim();
    if (customId) formData.append('doc_id', customId);
    bar.style.width = '60%';
    const data = await apiFetch('/upload', { method: 'POST', body: formData });
    bar.style.width = '100%';
    const idNote = data.document_id ? ` (id=${data.document_id})` : '';
    label.textContent = `✅ ${data.message || 'Upload complete'}${idNote}`;
    showToast(`Uploaded: ${file.name} (${data.chunks_created} chunks${idNote})`, 'success');
    if (document.getElementById('uploadCustomId')) document.getElementById('uploadCustomId').value = '';
    setTimeout(() => { progressEl.classList.add('hidden'); bar.style.width = '0%'; }, 2000);
    await loadDocuments();
  } catch (err) {
    bar.style.width = '100%';
    bar.style.background = 'var(--danger)';
    label.textContent = `❌ ${err.message}`;
    showToast(err.message, 'error');
    setTimeout(() => { progressEl.classList.add('hidden'); bar.style.width = '0%'; bar.style.background = ''; }, 3000);
  }
}

async function ingestUrl() {
  const urlInput = document.getElementById('urlInput');
  const urlText = urlInput.value.trim();
  if (!urlText) { showToast('Please enter at least one URL', 'warning'); return; }

  // Parse URLs - split by newlines and filter empty lines
  const urls = urlText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (urls.length === 0) {
    showToast('Please enter at least one valid URL', 'warning');
    return;
  }

  const btn = document.getElementById('ingestUrlBtn');
  const progressEl = document.getElementById('urlProgress');
  const bar = document.getElementById('urlProgressBar');
  const label = document.getElementById('urlProgressLabel');

  btn.disabled = true;
  progressEl.classList.remove('hidden');
  
  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  // Process each URL
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const urlIndex = i + 1;
    const totalUrls = urls.length;

    try {
      // Calculate progress percentage for this URL
      const baseProgress = (i / totalUrls) * 100;
      const urlProgressStep = 100 / totalUrls;

      // Stage 1: Fetching
      bar.style.width = `${baseProgress + urlProgressStep * 0.2}%`;
      label.textContent = `[${urlIndex}/${totalUrls}] Fetching: ${url.substring(0, 50)}...`;
      
      const formData = new FormData();
      formData.append('url', url);
      // Custom ID only makes sense for single-URL ingestion
      if (i === 0 && urls.length === 1) {
        const customId = document.getElementById('urlCustomId')?.value.trim();
        if (customId) formData.append('doc_id', customId);
      }
      
      // Stage 2: Scraping
      await new Promise(resolve => setTimeout(resolve, 200));
      bar.style.width = `${baseProgress + urlProgressStep * 0.4}%`;
      label.textContent = `[${urlIndex}/${totalUrls}] Extracting text...`;
      
      // Stage 3: Processing (chunking + embedding)
      await new Promise(resolve => setTimeout(resolve, 200));
      bar.style.width = `${baseProgress + urlProgressStep * 0.6}%`;
      label.textContent = `[${urlIndex}/${totalUrls}] ✂️ Chunking and embedding...`;
      
      // Make actual API call
      const data = await apiFetch('/ingest-url', { method: 'POST', body: formData });
      
      // Stage 4: Storing
      bar.style.width = `${baseProgress + urlProgressStep * 0.85}%`;
      label.textContent = `[${urlIndex}/${totalUrls}] 💾 Storing in database...`;
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Complete this URL
      bar.style.width = `${baseProgress + urlProgressStep}%`;
      successCount++;
      
    } catch (err) {
      errorCount++;
      errors.push({ url, error: err.message });
      console.error(`Failed to ingest ${url}:`, err);
    }
  }

  // Show final results
  bar.style.width = '100%';
  
  if (errorCount === 0) {
    bar.style.background = '';
    label.textContent = `✅ Complete! Successfully ingested ${successCount} URL${successCount !== 1 ? 's' : ''}`;
    showToast(`Successfully ingested ${successCount} URL${successCount !== 1 ? 's' : ''}`, 'success');
  } else if (successCount === 0) {
    bar.style.background = 'var(--danger)';
    label.textContent = `❌ All ${errorCount} URL${errorCount !== 1 ? 's' : ''} failed`;
    showToast(`Failed to ingest all URLs. Check console for details.`, 'error');
  } else {
    bar.style.background = '#f59e0b'; // warning color
    label.textContent = `⚠️ Completed with errors: ${successCount} succeeded, ${errorCount} failed`;
    showToast(`Partial success: ${successCount} URLs ingested, ${errorCount} failed`, 'warning');
  }

  // Show error details if any
  if (errors.length > 0) {
    console.error('URL ingestion errors:', errors);
  }

  urlInput.value = '';
  if (document.getElementById('urlCustomId')) document.getElementById('urlCustomId').value = '';
  btn.disabled = false;
  
  setTimeout(() => { 
    progressEl.classList.add('hidden'); 
    bar.style.width = '0%'; 
    bar.style.background = ''; 
  }, 3000);
  
  await loadDocuments();
}

async function deleteDocument(docId, name) {
  if (!confirm(`Delete "${name}"? This will remove all its chunks from VectorDB and SQLite.`)) return;
  try {
    await apiFetch(`/documents/${docId}`, { method: 'DELETE' });
    showToast(`Deleted: ${name}`, 'success');
    await loadDocuments();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function editDocument(docId) {
  try {
    // Find document in current data
    const doc = _allDocs.find(d => String(d.id) === String(docId));
    if (!doc) {
      showToast('Document not found', 'error');
      return;
    }

    // Populate modal fields
    const idInput = document.getElementById('editDocId');
    idInput.value = doc.id;
    idInput.dataset.originalId = doc.id;  // remember original for PUT URL
    document.getElementById('editDocFilename').value = doc.filename;
    document.getElementById('editDocPath').value = doc.file_path || '';
    document.getElementById('editDocType').value = doc.file_type === '.url' ? 'URL' : (doc.file_type?.toUpperCase().replace('.','') || 'FILE');

    // Show/hide path field based on type
    const pathGroup = document.getElementById('editDocPathGroup');
    if (doc.file_type === '.url') {
      pathGroup.style.display = 'block';
    } else {
      pathGroup.style.display = 'none';
    }

    // Fetch document content
    document.getElementById('editDocContent').value = 'Loading content...';
    const contentData = await apiFetch(`/documents/${docId}/content`);
    document.getElementById('editDocContent').value = contentData.content || '';

    // Show modal
    document.getElementById('editDocModal').classList.remove('hidden');
  } catch (err) {
    showToast('Failed to load document: ' + err.message, 'error');
  }
}

function closeEditModal() {
  document.getElementById('editDocModal').classList.add('hidden');
  // Reset progress bar
  const progressBar = document.getElementById('editProgressBar');
  const saveBtn = document.getElementById('editSaveBtn');
  const cancelBtn = document.getElementById('editCancelBtn');
  progressBar.classList.add('hidden');
  saveBtn.disabled = false;
  cancelBtn.disabled = false;
  // Reset improvement panel
  document.getElementById('improveHint').value = '';
  document.getElementById('improveSuggestion').value = '';
  document.getElementById('improveSuggestionWrap').classList.add('hidden');
  document.getElementById('improveLoading').classList.add('hidden');
  document.getElementById('improveSuggestBtn').disabled = false;
}

// ── KBC Improvement ──────────────────────────────────────────────────────────

async function generateImprovement() {
  const docId = document.getElementById('editDocId').value;
  if (!docId) { showToast('Open a document first', 'error'); return; }

  const hint = document.getElementById('improveHint').value.trim();
  const btn = document.getElementById('improveSuggestBtn');
  const loading = document.getElementById('improveLoading');
  const wrap = document.getElementById('improveSuggestionWrap');

  btn.disabled = true;
  loading.style.display = 'flex';
  loading.classList.remove('hidden');
  wrap.classList.add('hidden');

  try {
    const data = await adminFetch(`/documents/${docId}/improve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hint }),
    });

    document.getElementById('improveSuggestion').value = data.suggestion || '';
    const badge = document.getElementById('improveModelBadge');
    badge.textContent = data.model_used ? `model: ${data.model_used}` : '';
    wrap.classList.remove('hidden');
    showToast('Suggestion generated ✨', 'success');
  } catch (err) {
    showToast('Improvement failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    loading.style.display = 'none';
    loading.classList.add('hidden');
  }
}

function copyImprovementToContent() {
  const suggestion = document.getElementById('improveSuggestion').value.trim();
  if (!suggestion) { showToast('No suggestion to use', 'error'); return; }
  document.getElementById('editDocContent').value = suggestion;
  document.getElementById('editDocContent').scrollIntoView({ behavior: 'smooth', block: 'center' });
  showToast('Suggestion copied to Content ↑', 'success');
}

async function applySuggestionAndSave() {
  const suggestion = document.getElementById('improveSuggestion').value.trim();
  if (!suggestion) { showToast('No suggestion to apply', 'error'); return; }
  // Copy to main content, then trigger save
  document.getElementById('editDocContent').value = suggestion;
  await saveDocumentEdit();
}

async function saveDocumentEdit() {
  const originalDocId = document.getElementById('editDocId').dataset.originalId || '';
  const newDocIdRaw = document.getElementById('editDocId').value.trim();
  const docId = originalDocId || newDocIdRaw;
  const filename = document.getElementById('editDocFilename').value.trim();
  const filePath = document.getElementById('editDocPath').value.trim();
  const content = document.getElementById('editDocContent').value.trim();

  if (!filename) {
    showToast('Filename is required', 'error');
    return;
  }

  if (!content) {
    showToast('Content cannot be empty', 'error');
    return;
  }

  if (!newDocIdRaw) {
    showToast('Document ID is required', 'error');
    return;
  }

  // Build body — include new_doc_id only if it actually changed
  const bodyPayload = {
    filename: filename,
    file_path: filePath || null,
    content: content
  };
  if (newDocIdRaw !== String(originalDocId)) {
    bodyPayload.new_doc_id = newDocIdRaw;
  }

  // Show progress bar and disable buttons
  const progressBar = document.getElementById('editProgressBar');
  const progressLabel = document.getElementById('editProgressLabel');
  const saveBtn = document.getElementById('editSaveBtn');
  const cancelBtn = document.getElementById('editCancelBtn');
  
  progressBar.classList.remove('hidden');
  saveBtn.disabled = true;
  cancelBtn.disabled = true;
  progressLabel.textContent = 'Updating document metadata...';

  try {
    // Step 1: Update metadata
    progressLabel.textContent = 'Updating content and re-chunking...';
    
    // Step 2: Update content (this includes re-chunking)
    progressLabel.textContent = 'Generating embeddings and updating vector database...';
    
    await apiFetch(`/documents/${docId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
    });

    progressLabel.textContent = '✅ Document updated successfully!';
    
    setTimeout(() => {
      showToast('Document updated successfully', 'success');
      closeEditModal();
      loadDocuments();
    }, 500);
    
  } catch (err) {
    progressBar.classList.add('hidden');
    saveBtn.disabled = false;
    cancelBtn.disabled = false;
    showToast('Failed to update document: ' + err.message, 'error');
  }
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escAttr(s) {
  return String(s ?? '').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Re-index modal ────────────────────────────────────────────────────────────

function _ensureReindexModal() {
  let modal = document.getElementById('reindexModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'reindexModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);' +
    'display:flex;align-items:center;justify-content:center;z-index:9999;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:28px 32px;
                width:580px;max-width:95vw;max-height:88vh;
                display:flex;flex-direction:column;gap:16px;
                box-shadow:0 20px 60px rgba(0,0,0,.3);">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <h3 style="margin:0;font-size:1.1rem;">🔄 Re-indexing Documents</h3>
        <button id="reindexCloseBtn"
          onclick="closeReindexModal()"
          style="background:none;border:none;font-size:1.4rem;cursor:pointer;
                 color:#6b7280;line-height:1;display:none;">✕</button>
      </div>

      <div>
        <div style="display:flex;justify-content:space-between;font-size:.8rem;
                    color:#6b7280;margin-bottom:4px;">
          <span id="reindexProgressLabel">Preparing…</span>
          <span id="reindexProgressPct">0%</span>
        </div>
        <div style="background:#e5e7eb;border-radius:999px;height:10px;overflow:hidden;">
          <div id="reindexProgressBar"
               style="height:100%;width:0%;background:#d97706;
                      border-radius:999px;transition:width .3s;"></div>
        </div>
      </div>

      <div id="reindexLog"
           style="flex:1;overflow-y:auto;min-height:180px;max-height:320px;
                  background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;
                  padding:10px 12px;font-family:monospace;font-size:.8rem;
                  line-height:1.6;color:#374151;"></div>

      <div id="reindexSummary" style="display:none;"></div>
    </div>`;
  document.body.appendChild(modal);
  return modal;
}

function showReindexModal() {
  const modal = _ensureReindexModal();
  document.getElementById('reindexProgressBar').style.width  = '0%';
  document.getElementById('reindexProgressPct').textContent  = '0%';
  document.getElementById('reindexProgressLabel').textContent = 'Preparing…';
  document.getElementById('reindexLog').innerHTML             = '';
  document.getElementById('reindexSummary').style.display     = 'none';
  document.getElementById('reindexCloseBtn').style.display    = 'none';
  modal.style.display = 'flex';
}

function closeReindexModal() {
  const modal = document.getElementById('reindexModal');
  if (modal) modal.style.display = 'none';
  // Refresh table so chunk counts + chunk settings update
  loadChunkSettings().then(() => loadDocuments());
}

function _appendReindexLog(html) {
  const log = document.getElementById('reindexLog');
  if (!log) return;
  log.insertAdjacentHTML('beforeend', html);
  log.scrollTop = log.scrollHeight;
}

function _setReindexProgress(current, total) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 100;
  document.getElementById('reindexProgressBar').style.width = pct + '%';
  document.getElementById('reindexProgressPct').textContent = pct + '%';
  document.getElementById('reindexProgressLabel').textContent =
    `Processing ${current} of ${total}…`;
}

async function startReindex(docId) {
  showReindexModal();

  const base = getApiBase();
  if (!base) {
    _appendReindexLog('<div style="color:#ef4444;">❌ Workspace API endpoint is missing. Please log in again.</div>');
    document.getElementById('reindexCloseBtn').style.display = 'block';
    return;
  }

  const url = docId != null
    ? `${base}/api/admin/reindex?reindex_doc_id=${encodeURIComponent(docId)}`
    : `${base}/api/admin/reindex`;

  try {
    const token = sessionStorage.getItem('admin_token');
    const resp  = await fetch(url, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'text/event-stream' },
    });

    if (!resp.ok) {
      _appendReindexLog(
        `<div style="color:#ef4444;">❌ Server error ${resp.status}: ${await resp.text()}</div>`
      );
      document.getElementById('reindexCloseBtn').style.display = 'block';
      return;
    }

    const reader  = resp.body.getReader();
    const decoder = new TextDecoder();
    let   buf     = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();   // keep incomplete last line

      let eventType = 'message';
      let dataStr   = '';
      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataStr = line.slice(5).trim();
        } else if (line === '') {
          if (dataStr) {
            try { _handleReindexEvent(eventType, JSON.parse(dataStr)); } catch {}
          }
          eventType = 'message';
          dataStr   = '';
        }
      }
    }
  } catch (err) {
    _appendReindexLog(
      `<div style="color:#ef4444;">❌ Connection error: ${esc(String(err))}</div>`
    );
    document.getElementById('reindexCloseBtn').style.display = 'block';
  }
}

function _handleReindexEvent(type, d) {
  const ICON = { done: '✅', skipped: '⏭️', error: '❌', processing: '⏳' };

  switch (type) {
    case 'start':
      _appendReindexLog(
        `<div style="color:#6b7280;margin-bottom:6px;">
          📋 Re-indexing <strong>${d.total}</strong> document${d.total !== 1 ? 's' : ''}
          with chunk_size&nbsp;<strong>${d.chunk_size}</strong> /
          overlap&nbsp;<strong>${d.chunk_overlap}</strong>
         </div>`
      );
      break;

    case 'progress': {
      _setReindexProgress(d.current, d.total);
      const icon  = ICON[d.status] ?? '•';
      const chunkInfo = d.chunks ? ` → <strong>${d.chunks}</strong> chunks` : '';
      const modeInfo = d.bm25_only
        ? ` · <span style="color:#d97706;">BM25-only (vector embedding unavailable)</span>`
        : '';
      const reasonInfo = d.reason ? ` — <em>${esc(d.reason)}</em>` : '';
      const extra = `${chunkInfo}${modeInfo}${d.status === 'error' ? reasonInfo : ''}`;
      const color = d.status === 'error'   ? '#ef4444' :
                    d.status === 'skipped' ? '#d97706' : '#374151';
      _appendReindexLog(
        `<div style="color:${color};">
          ${icon} [${d.current}/${d.total}] <strong>${esc(d.title)}</strong>${extra}
         </div>`
      );
      break;
    }

    case 'done': {
      _setReindexProgress(d.total, d.total);
      document.getElementById('reindexProgressLabel').textContent = 'Complete';
      document.getElementById('reindexCloseBtn').style.display = 'block';

      const failBadge = d.failed > 0
        ? ` · <span style="color:#ef4444;">${d.failed} failed</span>` : '';
      const summaryEl = document.getElementById('reindexSummary');
      summaryEl.style.display = 'block';
      summaryEl.innerHTML = `
        <div style="background:#f0fdf4;border:1px solid #86efac;
                    border-radius:8px;padding:12px 16px;font-size:.9rem;">
          <strong>✅ Re-indexing complete</strong><br>
          <span style="color:#15803d;">
            ${d.success} succeeded${failBadge}
            · chunk_size&nbsp;<strong>${d.chunk_size}</strong>
            / overlap&nbsp;<strong>${d.chunk_overlap}</strong>
          </span>
        </div>`;

      // Clear stale banner if everything succeeded
      if (d.failed === 0) {
        const b = document.getElementById('staleChunkBanner');
        if (b) b.innerHTML = '';
      }
      break;
    }

    case 'error':
      _appendReindexLog(
        `<div style="color:#ef4444;">❌ Fatal: ${esc(d.message || d.reason || 'unknown error')}</div>`
      );
      document.getElementById('reindexCloseBtn').style.display = 'block';
      break;
  }
}
