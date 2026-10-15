/**
 * summary.js — Dashboard summary statistics
 */

async function renderSummary() {
  const body = document.getElementById('pageBody');
  body.innerHTML = `
    <div style="display:grid;gap:20px;">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Dashboard Summary</span>
          <button class="btn btn-secondary btn-sm" onclick="loadSummary()">🔄 Refresh</button>
        </div>
        <div class="card-body" id="summaryContent">
          <div style="text-align:center;padding:40px;color:var(--text-muted);">Loading statistics...</div>
        </div>
      </div>
    </div>
  `;
  
  await loadSummary();
}

async function loadSummary() {
  const container = document.getElementById('summaryContent');
  if (!container) return;
  
  try {
    const data = await adminFetch('/summary');
    
    container.innerHTML = `
      <!-- Overview Stats Single Row -->
      <div style="background:var(--card-bg);border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:32px;margin-bottom:32px;">
        <div style="display:flex;gap:48px;align-items:center;justify-content:space-between;">
          ${createStatMetric('Total Queries', formatNumber(data.queries.total), '#BB86FC', `${formatNumber(data.queries.last_7d)} in last 7 days`)}
          <div style="width:1px;height:60px;background:#e5e7eb;"></div>
          ${createStatMetric('Total Documents', formatNumber(data.documents.total), '#8b5cf6', `${formatNumber(data.documents.chunks)} chunks`)}
          <div style="width:1px;height:60px;background:#e5e7eb;"></div>
          ${createStatMetric('Vector Embeddings', formatNumber(data.documents.vectors), '#10b981', 'in Database')}
          <div style="width:1px;height:60px;background:#e5e7eb;"></div>
          ${createStatMetric('Pricing Records', formatNumber(data.pricing.total_records), '#f59e0b', 'product prices')}
          <div style="width:1px;height:60px;background:#e5e7eb;"></div>
          ${createStatMetric('Product Spec Variants', formatNumber(data.product_specs ? data.product_specs.total_records : 0), '#ef4444', 'in database')}
        </div>
      </div>

      <!-- Query Analytics -->
      <div style="background:var(--card-bg);border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:32px;margin-bottom:32px;">
        <h3 style="font-size:16px;font-weight:600;margin-bottom:24px;color:var(--text);">Query Analytics</h3>
        <div style="display:flex;gap:48px;align-items:center;justify-content:space-between;">
          ${createStatMetric('Active Days', formatNumber(data.queries.active_days), '#BB86FC', 'with queries')}
          <div style="width:1px;height:60px;background:#e5e7eb;"></div>
          ${createStatMetric('Avg Processing Time', data.queries.avg_processing_time + 's', '#8b5cf6', 'per query')}
          <div style="width:1px;height:60px;background:#e5e7eb;"></div>
          ${createStatMetric('Avg Results/Query', data.queries.avg_results, '#10b981', 'documents found')}
        </div>
      </div>

      <!-- Token Usage -->
      <div style="background:var(--card-bg);border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:32px;margin-bottom:32px;">
        <h3 style="font-size:16px;font-weight:600;margin-bottom:24px;color:var(--text);">Token Usage</h3>
        <div style="display:flex;gap:48px;align-items:center;justify-content:space-between;">
          ${createStatMetric('Total Input', formatNumber(data.tokens.total_input), '#BB86FC', 'tokens sent')}
          <div style="width:1px;height:60px;background:#e5e7eb;"></div>
          ${createStatMetric('Total Output', formatNumber(data.tokens.total_output), '#8b5cf6', 'tokens received')}
          <div style="width:1px;height:60px;background:#e5e7eb;"></div>
          ${createStatMetric('Combined Total', formatNumber(data.tokens.total), '#10b981', 'total tokens')}
          <div style="width:1px;height:60px;background:#e5e7eb;"></div>
          ${createStatMetric('Last 7 Days', formatNumber(data.tokens.last_7d), '#f59e0b', 'recent usage')}
        </div>
      </div>

      <!-- Document Breakdown -->
      <div style="background:var(--card-bg);border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:32px;margin-bottom:32px;">
        <h3 style="font-size:16px;font-weight:600;margin-bottom:24px;color:var(--text);">Document Breakdown</h3>
        <div style="display:flex;gap:48px;align-items:center;justify-content:space-between;">
          ${createStatMetric('Files Uploaded', formatNumber(data.documents.files), '#BB86FC', 'from disk')}
          <div style="width:1px;height:60px;background:#e5e7eb;"></div>
          ${createStatMetric('URLs Scraped', formatNumber(data.documents.urls), '#8b5cf6', 'from web')}
          <div style="width:1px;height:60px;background:#e5e7eb;"></div>
          ${createStatMetric('Total Chunks', formatNumber(data.documents.chunks), '#10b981', 'text segments')}
        </div>
      </div>

      <!-- Model Usage -->
      ${data.models.length > 0 ? `
        <div style="margin-bottom:32px;">
          <h3 style="font-size:16px;font-weight:600;margin-bottom:16px;color:var(--text);">Model Usage</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Query Count</th>
                  <th>Avg Time (s)</th>
                  <th>Usage %</th>
                </tr>
              </thead>
              <tbody>
                ${data.models.map((model, idx) => {
                  const percentage = ((model.count / data.queries.total) * 100).toFixed(1);
                  return `
                    <tr>
                      <td>
                        <span class="badge badge-neutral" style="font-size:12px;">${esc(model.name)}</span>
                      </td>
                      <td>${formatNumber(model.count)}</td>
                      <td>${model.avg_time}s</td>
                      <td>
                        <div style="display:flex;align-items:center;gap:8px;">
                          <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden;">
                            <div style="width:${percentage}%;height:100%;background:${getBarColor(idx)};"></div>
                          </div>
                          <span style="font-size:12px;color:var(--text-muted);min-width:45px;">${percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <!-- Storage Info -->
      <div style="background:var(--card-bg);border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:32px;margin-bottom:32px;">
        <h3 style="font-size:16px;font-weight:600;margin-bottom:24px;color:var(--text);">Data Volume</h3>
        <div style="display:flex;gap:48px;align-items:center;justify-content:center;">
          ${createStatMetric('Database Size', data.storage.database_size_mb + ' MB', '#BB86FC', 'on disk')}
        </div>
      </div>
    `;
    
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p>Failed to load statistics</p>
        <p style="color:var(--danger);font-size:14px;">${err.message}</p>
      </div>
    `;
    showToast(err.message, 'error');
  }
}

// ── Helper functions ──────────────────────────────────────────────────────────

function createStatMetric(title, value, color, subtitle) {
  return `
    <div style="flex:1;text-align:center;">
      <div style="font-size:13px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">${title}</div>
      <div style="font-size:36px;font-weight:700;color:${color};margin-bottom:6px;">${value}</div>
      <div style="font-size:12px;color:var(--text-muted);">${subtitle}</div>
    </div>
  `;
}

function createMetricBox(label, value) {
  const colors = [
    '#667eea',
    '#f5576c',
    '#00f2fe',
    '#43e97b',
    '#fee140',
    '#30cfd0',
  ];
  const colorIndex = Math.floor(Math.random() * colors.length);
  return `
    <div style="background:var(--bg-secondary);padding:16px;border-radius:8px;border:2px solid ${colors[colorIndex]};box-shadow:0 4px 12px rgba(0,0,0,0.08);">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;font-weight:500;">${label}</div>
      <div style="font-size:24px;font-weight:700;color:var(--text);">${value}</div>
    </div>
  `;
}

function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return num.toLocaleString();
}

function getBarColor(index) {
  const colors = ['#BB86FC', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  return colors[index % colors.length];
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
