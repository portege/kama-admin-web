/**
 * activitylog.js — Admin activity-log viewer
 *
 * Shows all write operations (POST / PUT / DELETE) logged by the backend
 * middleware.  Supports search, method / status / date filters, pagination,
 * column sorting, per-page selector (25 / 50 / 100) and CSV export.
 */

let _activityLogState = {
  page: 1,
  perPage: 25,
  sortBy: 'timestamp',
  sortDir: 'desc',
  workspaceHandle: (sessionStorage.getItem('admin_workspace') || '').trim(),
  search: '',
  method: '',
  statusCode: '',
  dateFrom: '',
  dateTo: '',
};

let _activityDebounceTimer = null;

// ── Render ────────────────────────────────────────────────────────────────────

async function renderActivityLog() {
  const body = document.getElementById('pageBody');
  body.innerHTML = `
    <div class="card">
      <div class="card-header" style="flex-wrap:wrap;gap:12px;">
        <div style="display:flex;flex-direction:column;gap:4px;">
          <span class="card-title" style="font-size:32px;font-weight:700;">Activity Log</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <!-- Search -->
          <input class="form-control" id="alSearch" type="text" placeholder="Search user, endpoint, payload…"
                 style="width:220px;height:34px;" value="${_escAL(_activityLogState.search)}"
                 oninput="onALSearchInput(this.value)" />

          <!-- Method filter -->
          <select class="form-control" id="alMethodFilter" style="width:110px;height:34px;" onchange="onALMethodFilter(this.value)">
            <option value="">All Methods</option>
            <option value="POST"  ${_activityLogState.method==='POST'?'selected':''}>POST</option>
            <option value="PUT"   ${_activityLogState.method==='PUT'?'selected':''}>PUT</option>
            <option value="DELETE" ${_activityLogState.method==='DELETE'?'selected':''}>DELETE</option>
          </select>

          <!-- Date range -->
          <input class="form-control" id="alDateFrom" type="date" title="From date"
                 style="width:140px;height:34px;" value="${_activityLogState.dateFrom}"
                 onchange="onALDateFilter()" />
          <input class="form-control" id="alDateTo" type="date" title="To date"
                 style="width:140px;height:34px;" value="${_activityLogState.dateTo}"
                 onchange="onALDateFilter()" />

          <!-- Per-page -->
          <select class="form-control" id="alPerPage" style="width:80px;height:34px;" onchange="onALPerPage(this.value)">
            <option value="25"  ${_activityLogState.perPage===25?'selected':''}>25</option>
            <option value="50"  ${_activityLogState.perPage===50?'selected':''}>50</option>
            <option value="100" ${_activityLogState.perPage===100?'selected':''}>100</option>
          </select>

          <button class="btn btn-secondary btn-sm" onclick="loadActivityLog()">Refresh</button>
          <button class="btn btn-primary btn-sm" onclick="exportActivityLogCSV()">Export CSV</button>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:44px;">ID</th>
              <th class="sortable" onclick="onALSort('timestamp')" style="cursor:pointer;">
                Timestamp <span id="alSort_timestamp">↓</span>
              </th>
              <th class="sortable" onclick="onALSort('user')" style="cursor:pointer;">
                User <span id="alSort_user"></span>
              </th>
              <th class="sortable" onclick="onALSort('method')" style="cursor:pointer;">
                Method <span id="alSort_method"></span>
              </th>
              <th class="sortable" onclick="onALSort('endpoint')" style="cursor:pointer;">
                Endpoint <span id="alSort_endpoint"></span>
              </th>
              <th class="sortable" onclick="onALSort('status_code')" style="cursor:pointer;">
                Status <span id="alSort_status_code"></span>
              </th>
              <th class="sortable" onclick="onALSort('duration_ms')" style="cursor:pointer;">
                Duration <span id="alSort_duration_ms"></span>
              </th>
              <th>IP</th>
              <th style="width:60px;">Actions</th>
            </tr>
          </thead>
          <tbody id="alTableBody">
            <tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted);">Loading…</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="card-footer" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-top:1px solid var(--border);">
        <span id="alPaginationInfo" style="font-size:13px;color:var(--text-muted);"></span>
        <div id="alPagination" style="display:flex;gap:4px;"></div>
      </div>
    </div>

    <!-- Detail Modal -->
    <div class="modal-overlay hidden" id="alDetailModal">
      <div class="modal" style="max-width:860px;">
        <div class="modal-header">
          <span class="modal-title">Activity Detail</span>
          <button class="modal-close" onclick="closeALModal()">×</button>
        </div>
        <div class="modal-body" id="alDetailBody" style="max-height:70vh;overflow-y:auto;"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeALModal()">Close</button>
        </div>
      </div>
    </div>
  `;

  await loadActivityLog();
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadActivityLog() {
  const tbody = document.getElementById('alTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted);">Loading…</td></tr>';

  try {
    const s = _activityLogState;
    const params = new URLSearchParams({
      page: s.page,
      per_page: s.perPage,
      sort_by: s.sortBy,
      sort_dir: s.sortDir,
    });
    if (s.search)     params.set('search', s.search);
    if (s.method)     params.set('method', s.method);
    if (s.statusCode) params.set('status_code', s.statusCode);
    if (s.dateFrom)   params.set('date_from', s.dateFrom);
    if (s.dateTo)     params.set('date_to', s.dateTo);
    if (s.workspaceHandle) params.set('workspace_handle', s.workspaceHandle);

    const data = await adminFetch(`/activity-log?${params}`);
    const records = Array.isArray(data.records) ? data.records : (Array.isArray(data.items) ? data.items : []);
    const pagination = data.pagination || {};
    const page = Number(pagination.page ?? data.page ?? s.page ?? 1);
    const perPage = Number(pagination.per_page ?? data.per_page ?? s.perPage ?? 25);
    const total = Number(pagination.total ?? data.total ?? 0);
    const totalPages = Number(pagination.total_pages ?? data.total_pages ?? 0);
    const items = records.map(r => ({
      ...r,
      id: r.id,
      timestamp: r.timestamp ?? r.created_at ?? r.createdAt,
      user: r.user ?? r.actor_username ?? r.username ?? 'system',
      method: r.method ?? 'GET',
      endpoint: r.endpoint ?? r.path ?? r.action ?? '—',
      status_code: r.status_code ?? r.status ?? null,
      duration_ms: r.duration_ms ?? r.durationMs ?? r.duration ?? null,
      ip_address: r.ip_address ?? r.ip ?? r.ipAddress ?? r.client_ip ?? '—',
      payload: r.payload ?? null,
      result: r.result ?? null,
      error_message: r.error_message ?? r.detail ?? null,
    }));

    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">📋</div><p>No activity logged yet.</p></div></td></tr>';
      document.getElementById('alPaginationInfo').textContent = '0 activities';
      document.getElementById('alPagination').innerHTML = '';
      return;
    }

    tbody.innerHTML = items.map(r => `
      <tr>
        <td>${_shortId(r.id)}</td>
        <td style="white-space:nowrap;font-size:12px;">${_fmtTS(r.timestamp)}</td>
        <td>${_escAL(r.user || '—')}</td>
        <td>${_methodBadge(r.method)}</td>
        <td>
          <div style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${_escAL(r.endpoint)}">
            ${_escAL(r.endpoint)}
          </div>
        </td>
        <td>${_statusBadge(r.status_code)}</td>
        <td style="white-space:nowrap;">${r.duration_ms != null ? Number(r.duration_ms).toFixed(0) + ' ms' : '—'}</td>
        <td style="font-family:monospace;font-size:12px;">${_escAL(r.ip_address || '—')}</td>
        <td>
          <button class="btn btn-secondary btn-sm btn-icon" title="View Details" onclick='viewALDetail(${JSON.stringify(r).replace(/'/g,"&#39;")})'>View</button>
        </td>
      </tr>
    `).join('');

    const start = (page - 1) * perPage + 1;
    const end = Math.min(page * perPage, total);
    document.getElementById('alPaginationInfo').textContent =
      `Showing ${start}–${end} of ${total} activities`;

    _renderALPagination(page, totalPages || Math.max(1, Math.ceil(total / perPage)));
    _updateALSortIcons();

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" style="color:var(--danger);padding:16px;">${err.message}</td></tr>`;
    showToast(err.message, 'error');
  }
}

// ── Pagination ────────────────────────────────────────────────────────────────

function _renderALPagination(cur, total) {
  const el = document.getElementById('alPagination');
  if (total <= 1) { el.innerHTML = ''; return; }
  let h = '';
  h += `<button class="btn btn-secondary btn-sm" ${cur===1?'disabled':''} onclick="goToALPage(${cur-1})">‹</button>`;
  const range = 2;
  let sp = Math.max(1, cur - range), ep = Math.min(total, cur + range);
  if (sp > 1) {
    h += `<button class="btn btn-secondary btn-sm" onclick="goToALPage(1)">1</button>`;
    if (sp > 2) h += `<span style="padding:0 6px;color:var(--text-muted);">…</span>`;
  }
  for (let p = sp; p <= ep; p++) {
    h += `<button class="btn ${p===cur?'btn-primary':'btn-secondary'} btn-sm" onclick="goToALPage(${p})">${p}</button>`;
  }
  if (ep < total) {
    if (ep < total - 1) h += `<span style="padding:0 6px;color:var(--text-muted);">…</span>`;
    h += `<button class="btn btn-secondary btn-sm" onclick="goToALPage(${total})">${total}</button>`;
  }
  h += `<button class="btn btn-secondary btn-sm" ${cur===total?'disabled':''} onclick="goToALPage(${cur+1})">›</button>`;
  el.innerHTML = h;
}

function goToALPage(p) {
  _activityLogState.page = p;
  loadActivityLog();
}

// ── Controls ──────────────────────────────────────────────────────────────────

function onALPerPage(v) {
  _activityLogState.perPage = parseInt(v, 10);
  _activityLogState.page = 1;
  loadActivityLog();
}

function onALSearchInput(v) {
  clearTimeout(_activityDebounceTimer);
  _activityDebounceTimer = setTimeout(() => {
    _activityLogState.search = v.trim();
    _activityLogState.page = 1;
    loadActivityLog();
  }, 300);
}

function onALMethodFilter(v) {
  _activityLogState.method = v;
  _activityLogState.page = 1;
  loadActivityLog();
}

function onALDateFilter() {
  _activityLogState.dateFrom = document.getElementById('alDateFrom').value;
  _activityLogState.dateTo   = document.getElementById('alDateTo').value;
  _activityLogState.page = 1;
  loadActivityLog();
}

function onALSort(col) {
  if (_activityLogState.sortBy === col) {
    _activityLogState.sortDir = _activityLogState.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    _activityLogState.sortBy = col;
    _activityLogState.sortDir = col === 'timestamp' ? 'desc' : 'asc';
  }
  _activityLogState.page = 1;
  loadActivityLog();
}

function _updateALSortIcons() {
  const cols = ['timestamp','user','method','endpoint','status_code','duration_ms'];
  cols.forEach(c => {
    const el = document.getElementById(`alSort_${c}`);
    if (el) el.textContent = _activityLogState.sortBy === c
      ? (_activityLogState.sortDir === 'asc' ? '↑' : '↓')
      : '';
  });
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function viewALDetail(rec) {
  const body = document.getElementById('alDetailBody');

  function prettyJSON(raw) {
    if (!raw || raw === 'null') return '<em style="color:var(--text-muted);">—</em>';
    try {
      const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return `<pre style="background:var(--bg);padding:12px;border-radius:6px;overflow-x:auto;font-size:12px;max-height:300px;overflow-y:auto;margin:0;">${_escAL(JSON.stringify(obj, null, 2))}</pre>`;
    } catch { return `<pre style="background:var(--bg);padding:12px;border-radius:6px;overflow-x:auto;font-size:12px;max-height:300px;overflow-y:auto;margin:0;">${_escAL(raw)}</pre>`; }
  }

  body.innerHTML = `
    <div style="display:grid;gap:16px;">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
        <div>
          <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">ID</div>
          <div>${_shortId(rec.id)}</div>
        </div>
        <div>
          <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Timestamp</div>
          <div>${_fmtTS(rec.timestamp)}</div>
        </div>
        <div>
          <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Duration</div>
          <div>${rec.duration_ms != null ? rec.duration_ms.toFixed(2) + ' ms' : '—'}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
        <div>
          <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">User</div>
          <div>${_escAL(rec.user || '—')}</div>
        </div>
        <div>
          <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Method</div>
          <div>${_methodBadge(rec.method)}</div>
        </div>
        <div>
          <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Status</div>
          <div>${_statusBadge(rec.status_code)}</div>
        </div>
      </div>

      <div>
        <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Endpoint</div>
        <div style="font-family:monospace;font-size:13px;">${_escAL(rec.endpoint)}</div>
      </div>

      <div>
        <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Request Payload</div>
        ${prettyJSON(rec.payload)}
      </div>

      <div>
        <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Response</div>
        ${prettyJSON(rec.result)}
      </div>

      ${rec.error_message ? `
      <div>
        <div style="font-weight:600;font-size:12px;color:var(--danger);margin-bottom:4px;">Error</div>
        <div style="background:rgba(239,68,68,0.08);color:var(--danger);padding:12px;border-radius:6px;font-size:13px;white-space:pre-wrap;">${_escAL(rec.error_message)}</div>
      </div>
      ` : ''}

    </div>
  `;

  document.getElementById('alDetailModal').classList.remove('hidden');
}

function closeALModal() {
  document.getElementById('alDetailModal').classList.add('hidden');
}

// ── CSV export ────────────────────────────────────────────────────────────────

async function exportActivityLogCSV() {
  try {
    const s = _activityLogState;
    const params = new URLSearchParams({
      page: 1,
      per_page: 10000,
      sort_by: s.sortBy,
      sort_dir: s.sortDir,
    });
    if (s.search)     params.set('search', s.search);
    if (s.method)     params.set('method', s.method);
    if (s.statusCode) params.set('status_code', s.statusCode);
    if (s.dateFrom)   params.set('date_from', s.dateFrom);
    if (s.dateTo)     params.set('date_to', s.dateTo);
    if (s.workspaceHandle) params.set('workspace_handle', s.workspaceHandle);

    const data = await adminFetch(`/activity-log?${params}`);
    const records = Array.isArray(data.records) ? data.records : (Array.isArray(data.items) ? data.items : []);
    const items = records.map(r => ({
      ...r,
      timestamp: r.timestamp ?? r.created_at ?? r.createdAt,
      user: r.user ?? r.actor_username ?? r.username ?? 'system',
      method: r.method ?? 'GET',
      endpoint: r.endpoint ?? r.path ?? r.action ?? '—',
      status_code: r.status_code ?? r.status ?? null,
      duration_ms: r.duration_ms ?? r.durationMs ?? null,
    }));
    if (!items.length) { showToast('No data to export', 'warning'); return; }

    const headers = ['ID','Timestamp','User','Method','Endpoint','Status','Duration (ms)','IP','Device','OS','Browser','Error'];
    const rows = items.map(r => [
      r.id,
      _fmtTS(r.timestamp),
      `"${(r.user||'').replace(/"/g,'""')}"`,
      r.method,
      `"${(r.endpoint||'').replace(/"/g,'""')}"`,
      r.status_code,
      r.duration_ms != null ? Number(r.duration_ms).toFixed(0) : '',
      r.ip_address || '',
      r.device_type || '',
      `${r.os_type||''}${r.os_version?' '+r.os_version:''}`,
      `${r.browser_name||''}${r.browser_version?' '+r.browser_version:''}`,
      `"${(r.error_message||'').replace(/"/g,'""')}"`,
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity_log_${new Date().toISOString().split('T')[0]}.csv`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${items.length} records to CSV`, 'success');
  } catch (err) {
    showToast('Export failed: ' + err.message, 'error');
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _escAL(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _fmtTS(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2,'0');
  const mon = String(d.getMonth()+1).padStart(2,'0');
  const time = d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
  return `${day}/${mon}/${d.getFullYear()} ${time}`;
}

function _methodBadge(m) {
  const colors = { POST: '#10b981', PUT: '#BB86FC', DELETE: '#ef4444' };
  const bg = colors[m] || '#6b7280';
  return `<span class="badge" style="background:${bg};color:#fff;">${_escAL(m)}</span>`;
}

function _statusBadge(code) {
  if (code == null) return '—';
  const bg = code < 400 ? '#10b981' : '#ef4444';
  return `<span class="badge" style="background:${bg};color:#fff;">${code}</span>`;
}

function _deviceBadge(dt) {
  const icons = { mobile: '📱', tablet: '📱', desktop: '💻' };
  const colors = { mobile: '#10b981', tablet: '#f59e0b', desktop: '#BB86FC' };
  return `<span class="badge" style="background:${colors[dt]||'#6b7280'};color:#fff;">${icons[dt]||''} ${_escAL(dt)}</span>`;
}

function _shortId(id) {
  if (id == null) return '—';
  return String(id).split('-')[0].slice(0, 8);
}
