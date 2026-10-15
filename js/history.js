/**
 * history.js — Query history viewer
 */

let _historyState = {
  page: 1,
  perPage: 50,
  sortBy: 'timestamp',
  sortDir: 'desc',
  workspaceHandle: (sessionStorage.getItem('admin_workspace') || '').trim(),
};

async function renderHistory() {
  const body = document.getElementById('pageBody');
  body.innerHTML = `
    <div class="card">
      <div class="card-header" style="flex-wrap:wrap;gap:12px;">
        <div style="display:flex;flex-direction:column;gap:4px;">
          <span class="card-title" style="font-size:32px;font-weight:700;">Query History</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <select class="form-control" id="historyPerPage" style="width:90px;height:34px;" onchange="onHistoryPerPage(this.value)">
            <option value="25">25</option>
            <option value="50" selected>50</option>
            <option value="100">100</option>
          </select>
          <button class="btn btn-secondary btn-sm" onclick="loadHistory()">Refresh</button>
          <button class="btn btn-primary btn-sm" onclick="exportHistoryToCSV()">Export CSV</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:50px;">ID</th>
              <th class="sortable" data-sort="timestamp" onclick="onHistorySort('timestamp')">
                Timestamp <span id="sortIcon_timestamp">↓</span>
              </th>
              <th>Question</th>
              <th>Lang</th>
              <th>Intent</th>
              <th>Results</th>
              <th class="sortable" data-sort="processing_time" onclick="onHistorySort('processing_time')">
                Time (s) <span id="sortIcon_processing_time"></span>
              </th>
              <th>Tokens</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="historyTableBody">
            <tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text-muted);">Loading…</td></tr>
          </tbody>
        </table>
      </div>
      <!-- Pagination -->
      <div class="card-footer" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-top:1px solid var(--border);">
        <span id="historyPaginationInfo" style="font-size:13px;color:var(--text-muted);"></span>
        <div id="historyPagination" style="display:flex;gap:4px;"></div>
      </div>
    </div>

    <!-- Detail Modal -->
    <div class="modal-overlay hidden" id="historyDetailModal">
      <div class="modal" style="max-width:800px;">
        <div class="modal-header">
          <span class="modal-title">Query Details</span>
          <button class="modal-close" onclick="closeHistoryModal()">×</button>
        </div>
        <div class="modal-body" id="historyDetailBody" style="max-height:70vh;overflow-y:auto;">
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeHistoryModal()">Close</button>
        </div>
      </div>
    </div>
  `;

  await loadHistory();
}

async function loadHistory() {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text-muted);">Loading…</td></tr>';

  try {
    const { page, perPage, sortBy, sortDir, workspaceHandle } = _historyState;
    const params = new URLSearchParams({ page, per_page: perPage, sort_by: sortBy, sort_dir: sortDir });
    if (workspaceHandle) params.set('workspace_handle', workspaceHandle);
    const data = await adminFetch(`/history?${params}`);
    
    const records = data.records || [];
    const pagination = data.pagination || {};

    if (!records.length) {
      tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><div class="empty-icon">📭</div><p>No query history yet.</p></div></td></tr>';
      document.getElementById('historyPaginationInfo').textContent = '0 queries';
      document.getElementById('historyPagination').innerHTML = '';
      return;
    }

    tbody.innerHTML = records.map(rec => `
      <tr>
        <td>${formatShortId(rec.id)}</td>
        <td style="white-space:nowrap;font-size:12px;">${formatTimestamp(rec.timestamp)}</td>
        <td>
          <div style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(rec.question)}">
            ${esc(rec.question)}
          </div>
        </td>
        <td style="white-space:nowrap;">${rec.query_language ? `<span class="badge" style="background:${rec.query_language === 'id' ? '#7c3aed' : '#0ea5e9'};color:#fff;font-size:11px;">${rec.query_language === 'id' ? 'ID' : 'EN'}</span>` : '—'}</td>
        <td style="white-space:nowrap;">${rec.router_intent ? `<span class="badge badge-info" style="font-size:11px;">${esc(rec.router_intent)}</span>` : '—'}</td>
        <td>${rec.total_results ?? '—'}</td>
        <td>${rec.processing_time != null ? rec.processing_time.toFixed(3) : '—'}</td>
        <td style="white-space:nowrap;font-size:12px;">
          ${formatTokens(rec.input_tokens, rec.output_tokens)}
        </td>
        <td>
          <button class="btn btn-secondary btn-sm btn-icon" title="View Details" onclick='viewHistoryDetail(${JSON.stringify(String(rec.id || ""))})'>View</button>
        </td>
      </tr>
    `).join('');

    // Pagination info
    const start = (pagination.page - 1) * pagination.per_page + 1;
    const end = Math.min(pagination.page * pagination.per_page, pagination.total);
    document.getElementById('historyPaginationInfo').textContent = 
      `Showing ${start}–${end} of ${pagination.total} queries`;

    // Pagination buttons
    renderHistoryPagination(pagination.page, pagination.total_pages);
    updateHistorySortIcons();

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="10" style="color:var(--danger);padding:16px;">${err.message}</td></tr>`;
    showToast(err.message, 'error');
  }
}

function renderHistoryPagination(currentPage, totalPages) {
  const container = document.getElementById('historyPagination');
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';
  html += `<button class="btn btn-secondary btn-sm" ${currentPage === 1 ? 'disabled' : ''} onclick="goToHistoryPage(${currentPage - 1})">‹</button>`;

  const range = 2;
  let startPage = Math.max(1, currentPage - range);
  let endPage = Math.min(totalPages, currentPage + range);

  if (startPage > 1) {
    html += `<button class="btn btn-secondary btn-sm" onclick="goToHistoryPage(1)">1</button>`;
    if (startPage > 2) html += `<span style="padding:0 6px;color:var(--text-muted);">…</span>`;
  }

  for (let p = startPage; p <= endPage; p++) {
    const active = p === currentPage ? 'btn-primary' : 'btn-secondary';
    html += `<button class="btn ${active} btn-sm" onclick="goToHistoryPage(${p})">${p}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += `<span style="padding:0 6px;color:var(--text-muted);">…</span>`;
    html += `<button class="btn btn-secondary btn-sm" onclick="goToHistoryPage(${totalPages})">${totalPages}</button>`;
  }

  html += `<button class="btn btn-secondary btn-sm" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToHistoryPage(${currentPage + 1})">›</button>`;

  container.innerHTML = html;
}

function goToHistoryPage(p) {
  _historyState.page = p;
  loadHistory();
}

function onHistoryPerPage(val) {
  _historyState.perPage = parseInt(val, 10);
  _historyState.page = 1;
  loadHistory();
}

function onHistorySort(col) {
  if (_historyState.sortBy === col) {
    _historyState.sortDir = _historyState.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    _historyState.sortBy = col;
    _historyState.sortDir = col === 'timestamp' ? 'desc' : 'asc';
  }
  _historyState.page = 1;
  loadHistory();
}

function updateHistorySortIcons() {
  const cols = ['timestamp', 'processing_time'];
  cols.forEach(c => {
    const el = document.getElementById(`sortIcon_${c}`);
    if (el) {
      if (_historyState.sortBy === c) {
        el.textContent = _historyState.sortDir === 'asc' ? '↑' : '↓';
      } else {
        el.textContent = '';
      }
    }
  });
}

async function viewHistoryDetail(id) {
  try {
    const { page, perPage, sortBy, sortDir, workspaceHandle } = _historyState;
    const params = new URLSearchParams({ page, per_page: perPage, sort_by: sortBy, sort_dir: sortDir });
    if (workspaceHandle) params.set('workspace_handle', workspaceHandle);
    const data = await adminFetch(`/history?${params}`);
    const rec = (data.records || []).find(r => String(r.id) === String(id));
    
    if (!rec) {
      showToast('Record not found', 'error');
      return;
    }

    const body = document.getElementById('historyDetailBody');
    
    let citationsHtml = '—';
    if (rec.citations) {
      try {
        const citations = JSON.parse(rec.citations);
        citationsHtml = citations.map(c => `<span class="badge badge-info" style="margin:2px;">${esc(c)}</span>`).join(' ');
      } catch (e) {
        citationsHtml = esc(rec.citations);
      }
    }

    body.innerHTML = `
      <div style="display:grid;gap:16px;">
        <div>
          <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">ID</div>
          <div>${formatShortId(rec.id)}</div>
        </div>
        <div>
          <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Timestamp</div>
          <div>${formatTimestamp(rec.timestamp)}</div>
        </div>
        <div>
          <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Question</div>
          <div style="background:var(--bg-alt, rgba(255,255,255,0.03));padding:12px;border-radius:6px;white-space:pre-wrap;">${esc(rec.question)}</div>
        </div>
        <div>
          <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Answer</div>
          <div style="background:var(--bg-alt, rgba(255,255,255,0.03));padding:12px;border-radius:6px;white-space:pre-wrap;max-height:300px;overflow-y:auto;">${rec.answer ? esc(rec.answer) : '<em style="color:var(--text-muted);">No answer generated</em>'}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div>
            <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Model</div>
            <div>${rec.model ? esc(rec.model) : '—'}</div>
          </div>
          <div>
            <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Temperature</div>
            <div>${rec.temperature != null ? rec.temperature.toFixed(2) : '—'}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div>
            <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Search Type</div>
            <div>${rec.search_type ? esc(rec.search_type) : '—'}</div>
          </div>
          <div>
            <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Total Results</div>
            <div>${rec.total_results ?? '—'}</div>
          </div>
        </div>
        <div>
          <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Processing Time</div>
          <div>${rec.processing_time != null ? rec.processing_time.toFixed(3) + ' seconds' : '—'}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
          <div>
            <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Input Tokens</div>
            <div>${rec.input_tokens ?? '—'}</div>
          </div>
          <div>
            <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Output Tokens</div>
            <div>${rec.output_tokens ?? '—'}</div>
          </div>
          <div>
            <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Total Tokens</div>
            <div>${(rec.input_tokens && rec.output_tokens) ? (rec.input_tokens + rec.output_tokens) : '—'}</div>
          </div>
        </div>
        <div>
          <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Citations</div>
          <div>${citationsHtml}</div>
        </div>
        ${rec.router_used === 'yes' ? `
        <div style="border-top:1px solid var(--border);padding-top:16px;margin-top:8px;">
          <div style="font-weight:600;font-size:14px;color:var(--text);margin-bottom:12px;">Intent Router</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:16px;">
            <div>
              <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Router Used</div>
              <div>
                <span class="badge" style="background:#10b981;color:#fff;">
                  Yes
                </span>
              </div>
            </div>
            <div>
              <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Intent</div>
              <div>
                ${rec.router_intent ? `<span class="badge badge-info">${esc(rec.router_intent)}</span>` : '<em style="color:var(--text-muted);">—</em>'}
              </div>
            </div>
            <div>
              <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Confidence</div>
              <div>${rec.router_confidence != null ? (rec.router_confidence * 100).toFixed(0) + '%' : '—'}</div>
            </div>
            <div>
              <div style="font-weight:600;font-size:12px;color:var(--text-muted);margin-bottom:4px;">Language</div>
              <div>${rec.query_language ? `<span class="badge" style="background:${rec.query_language === 'id' ? '#7c3aed' : '#0ea5e9'};color:#fff;">${rec.query_language === 'id' ? 'Bahasa Indonesia' : 'English'}</span>` : '<em style="color:var(--text-muted);">—</em>'}</div>
            </div>
          </div>
        </div>
        ` : ''}
        <div style="border-top:1px solid var(--border);padding-top:16px;margin-top:8px;">
          <div style="font-weight:600;font-size:14px;color:var(--text);margin-bottom:12px;">Request Tracking</div>
          <div style="display:grid;gap:12px;">
            <div style="display:grid;grid-template-columns:140px 1fr;gap:8px;align-items:start;">
              <div style="font-weight:600;font-size:12px;color:var(--text-muted);">IP Address</div>
              <div style="font-family:monospace;font-size:13px;">${rec.ip_address ? esc(rec.ip_address) : '<em style="color:var(--text-muted);">—</em>'}</div>
            </div>
            <div style="display:grid;grid-template-columns:140px 1fr;gap:8px;align-items:start;">
              <div style="font-weight:600;font-size:12px;color:var(--text-muted);">Session ID</div>
              <div style="font-family:monospace;font-size:11px;word-break:break-all;">${rec.session_id ? esc(rec.session_id) : '<em style="color:var(--text-muted);">—</em>'}</div>
            </div>
            <div style="display:grid;grid-template-columns:140px 1fr;gap:8px;align-items:start;">
              <div style="font-weight:600;font-size:12px;color:var(--text-muted);">Location</div>
              <div>${rec.location ? esc(rec.location) : '<em style="color:var(--text-muted);">—</em>'}</div>
            </div>
            <div style="display:grid;grid-template-columns:140px 1fr;gap:8px;align-items:start;">
              <div style="font-weight:600;font-size:12px;color:var(--text-muted);">Device Type</div>
              <div>
                ${rec.device_type ? `
                <span class="badge" style="background:${rec.device_type === 'mobile' ? '#10b981' : rec.device_type === 'tablet' ? '#f59e0b' : '#BB86FC'};color:#fff;">
                  ${esc(rec.device_type)}
                </span>
                ` : '<em style="color:var(--text-muted);">—</em>'}
              </div>
            </div>
            <div style="display:grid;grid-template-columns:140px 1fr;gap:8px;align-items:start;">
              <div style="font-weight:600;font-size:12px;color:var(--text-muted);">Operating System</div>
              <div>${rec.os_type ? `${esc(rec.os_type)}${rec.os_version ? ' ' + esc(rec.os_version) : ''}` : '<em style="color:var(--text-muted);">—</em>'}</div>
            </div>
            <div style="display:grid;grid-template-columns:140px 1fr;gap:8px;align-items:start;">
              <div style="font-weight:600;font-size:12px;color:var(--text-muted);">Browser</div>
              <div>${rec.browser_name ? `${esc(rec.browser_name)}${rec.browser_version ? ' ' + esc(rec.browser_version) : ''}` : '<em style="color:var(--text-muted);">—</em>'}</div>
            </div>
            ${rec.page_url ? `
            <div style="display:grid;grid-template-columns:140px 1fr;gap:8px;align-items:start;">
              <div style="font-weight:600;font-size:12px;color:var(--text-muted);">Page URL</div>
              <div style="font-family:monospace;font-size:11px;color:var(--text-muted);word-break:break-all;">${esc(rec.page_url)}</div>
            </div>
            ` : ''}
            ${rec.user_agent ? `
            <div style="display:grid;grid-template-columns:140px 1fr;gap:8px;align-items:start;">
              <div style="font-weight:600;font-size:12px;color:var(--text-muted);">User Agent</div>
              <div style="font-family:monospace;font-size:11px;color:var(--text-muted);word-break:break-all;">${esc(rec.user_agent)}</div>
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    document.getElementById('historyDetailModal').classList.remove('hidden');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function closeHistoryModal() {
  document.getElementById('historyDetailModal').classList.add('hidden');
}

async function exportHistoryToCSV() {
  try {
    // Fetch all history records (no pagination limit for export)
    const params = new URLSearchParams({ 
      page: 1, 
      per_page: 10000, // Get all records
      sort_by: _historyState.sortBy, 
      sort_dir: _historyState.sortDir 
    });
    if (_historyState.workspaceHandle) params.set('workspace_handle', _historyState.workspaceHandle);
    const data = await adminFetch(`/history?${params}`);
    const records = data.records || [];
    
    if (!records.length) {
      showToast('No data to export', 'warning');
      return;
    }
    
    // CSV Headers
    const headers = ['ID', 'Timestamp', 'Question', 'Answer', 'Temperature', 'Results', 'Time (s)', 'Input Tokens', 'Output Tokens', 'Total Tokens'];
    
    // CSV Rows
    const rows = records.map(rec => {
      const timestamp = formatTimestamp(rec.timestamp);
      const question = (rec.question || '').replace(/"/g, '""'); // Escape quotes
      const answer = (rec.answer || '').replace(/"/g, '""');
      const temp = rec.temperature != null ? rec.temperature.toFixed(2) : '';
      const results = rec.total_results ?? '';
      const time = rec.processing_time != null ? rec.processing_time.toFixed(3) : '';
      const inputTokens = rec.input_tokens || '';
      const outputTokens = rec.output_tokens || '';
      const totalTokens = (rec.input_tokens && rec.output_tokens) ? (rec.input_tokens + rec.output_tokens) : '';
      
      return [
        rec.id,
        timestamp,
        `"${question}"`,
        `"${answer}"`,
        temp,
        results,
        time,
        inputTokens,
        outputTokens,
        totalTokens
      ].join(',');
    });
    
    // Create CSV content
    const csv = [headers.join(','), ...rows].join('\n');
    
    // Create download link
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `query_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast(`Exported ${records.length} records to CSV`, 'success');
  } catch (err) {
    showToast('Failed to export CSV: ' + err.message, 'error');
  }
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatTimestamp(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${day}/${month}/${year} ${time}`;
}

function formatTokens(inputTokens, outputTokens) {
  if (!inputTokens && !outputTokens) return '—';
  const input = inputTokens ? inputTokens.toLocaleString() : '0';
  const output = outputTokens ? outputTokens.toLocaleString() : '0';
  const total = (inputTokens || 0) + (outputTokens || 0);
  return `<span title="Input: ${input} | Output: ${output}">${total.toLocaleString()}</span>`;
}

function formatShortId(id) {
  if (id == null) return '—';
  return String(id).split('-')[0].slice(0, 8);
}
