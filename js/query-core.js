/**
 * query-core.js — Shared rendering utilities for KBaaS admin pages.
 *
 * Contains the reusable UI helpers and table renderers used by:
 *   • debug.js  (Search Troubleshooter)
 *   • (future)  any page that needs score tables / config badges
 *
 * The production widget (frontend/js/kbaas-widget.js) is a self-contained
 * IIFE with Shadow-DOM isolation — it keeps its own copies of escapeHtml,
 * getScoreColor, etc.  If those utility functions change here, update the
 * widget accordingly.
 */

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function scoreBar(score, maxScore) {
  const pct   = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const color = score >= 0.5 ? '#22c55e' : score >= 0.3 ? '#f59e0b' : '#ef4444';
  return `
    <div style="display:flex;align-items:center;gap:8px;min-width:120px;">
      <div style="flex:1;height:6px;background:#f1f5f9;border-radius:3px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;transition:width .3s;"></div>
      </div>
      <span style="font-size:12px;font-weight:600;color:${color};min-width:42px;">${score.toFixed(4)}</span>
    </div>`;
}

function configBadge(label, value) {
  return `<div style="text-align:center;">
    <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;">${label}</div>
    <div style="font-weight:700;font-size:16px;">${value}</div>
  </div>`;
}

function summaryCard(label, value, bg, color) {
  return `<div style="background:${bg};border-radius:8px;padding:14px 16px;text-align:center;">
    <div style="font-size:11px;color:${color};font-weight:600;text-transform:uppercase;letter-spacing:.5px;">${label}</div>
    <div style="font-size:28px;font-weight:700;color:${color};margin-top:2px;">${value}</div>
  </div>`;
}

function emptyMsg(msg) {
  return `<p style="padding:16px 20px;color:var(--text-muted);font-size:13px;font-style:italic;">⚠️ ${msg}</p>`;
}

// ── Collapsible section wrapper ───────────────────────────────────────────────

function collapsibleSection(id, title, bgColor, textColor, bodyHtml, defaultOpen = false) {
  const openAttr = defaultOpen ? ' open' : '';
  return `
    <details class="card" style="margin-bottom:16px;"${openAttr}>
      <summary class="card-header" style="background:${bgColor};list-style:none;cursor:pointer;
                      display:flex;align-items:center;justify-content:space-between;
                      user-select:none;">
        <span class="card-title" style="color:${textColor};">${title}</span>
        <span style="font-size:13px;color:${textColor};opacity:.6;">&#9660;</span>
      </summary>
      <div style="padding:0;">${bodyHtml}</div>
    </details>`;
}

// ── Table renderers ───────────────────────────────────────────────────────────

function chromaTable(rows, threshold = null, isSim = false, vectorQuery = null) {
  if (!rows || rows.length === 0) return emptyMsg('No Vector Search results');

  const maxScore   = Math.max(...rows.map(r => r.score));
  const showStatus = threshold !== null;

  const queryBanner = vectorQuery
    ? `<div style="padding:8px 16px;background:#eff6ff;border-bottom:1px solid #bfdbfe;
                  font-size:12px;color:#1e40af;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <span style="font-weight:600;">Embedding query:</span>
        <code style="background:#dbeafe;color:#1e3a8a;padding:2px 8px;border-radius:4px;font-size:12px;">${escHtml(vectorQuery)}</code>
        <span style="color:#60a5fa;font-size:11px;">(full sentence converted to a vector by the embedding model)</span>
      </div>` : '';

  return `
    ${queryBanner}
    <div class="table-wrap"><table>
      <thead><tr>
        <th>#</th><th>Doc ID</th><th>Title</th>
        <th>Score (1−dist)</th><th>Distance</th><th>Page</th>
        ${showStatus ? '<th>Status</th>' : ''}
      </tr></thead>
      <tbody>
        ${rows.map((r, i) => {
          const pass = !showStatus || r.score > threshold;
          return `<tr style="${!pass ? 'opacity:.5;' : ''}">
            <td style="color:var(--text-muted);font-size:12px;">${i + 1}</td>
            <td><span class="badge badge-info">${r.doc_id ?? '—'}</span></td>
            <td style="max-width:320px;white-space:normal;word-break:break-word;font-size:13px;">${escHtml(r.title)}</td>
            <td>${scoreBar(r.score, maxScore)}</td>
            <td style="font-size:12px;color:var(--text-muted);">${r.distance}</td>
            <td style="font-size:12px;color:var(--text-muted);">${r.page_num ?? '—'}</td>
            ${showStatus ? `<td>${pass ? '<span class="badge badge-success">✓ PASS</span>' : '<span class="badge badge-danger">✗ FAIL</span>'}</td>` : ''}
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>
    ${showStatus ? `<div style="padding:10px 16px;font-size:12px;color:var(--text-muted);border-top:1px solid var(--border);">
      Threshold = <strong${isSim ? ' style="color:#c2410c;"' : ''}>${threshold.toFixed(2)}</strong>
      ${isSim ? '<span style="margin-left:6px;background:#fef3c7;color:#92400e;font-size:10px;padding:1px 6px;border-radius:8px;font-weight:700;">SIMULATED</span>' : ''}
    </div>` : ''}`;
}

function bm25Table(rows, threshold = null, isSim = false, bm25Query = null, bm25Tokens = null) {
  if (!rows || rows.length === 0) return emptyMsg('No BM25 results (query may not contain indexable terms)');

  const maxScore   = Math.max(...rows.map(r => r.score));
  const showStatus = threshold !== null;
  const hasTokens  = bm25Tokens && bm25Tokens.length > 0;

  const queryBanner = (bm25Query || hasTokens)
    ? `<div style="padding:8px 16px;background:#f0fdf4;border-bottom:1px solid #bbf7d0;font-size:12px;">
        ${bm25Query ? `<div style="color:#166534;margin-bottom:${hasTokens ? '6px' : '0'};">
          <span style="font-weight:600;">MATCH query:</span>
          <code style="background:#dcfce7;color:#14532d;padding:2px 8px;border-radius:4px;margin-left:6px;font-size:12px;">${escHtml(bm25Query)}</code>
        </div>` : ''}
        ${hasTokens ? `<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">
          <span style="font-weight:600;color:#166534;margin-right:2px;">Tokens searched:</span>
          ${bm25Tokens.map(t => `<span style="background:#166534;color:#fff;padding:2px 8px;border-radius:10px;
                                              font-size:11px;font-weight:600;letter-spacing:.2px;">${escHtml(t)}</span>`).join('')}
        </div>` : ''}
      </div>` : '';

  return `
    ${queryBanner}
    <div class="table-wrap"><table>
      <thead><tr>
        <th>#</th><th>Doc ID</th><th>Title</th>
        <th>Norm score</th><th>Raw BM25 rank</th>
        ${showStatus ? '<th>Status</th>' : ''}
      </tr></thead>
      <tbody>
        ${rows.map((r, i) => {
          const pass = !showStatus || r.score > threshold;
          return `<tr style="${!pass ? 'opacity:.5;' : ''}">
            <td style="color:var(--text-muted);font-size:12px;">${i + 1}</td>
            <td><span class="badge badge-success">${r.doc_id ?? '—'}</span></td>
            <td style="max-width:320px;white-space:normal;word-break:break-word;font-size:13px;">${escHtml(r.title)}</td>
            <td>${scoreBar(r.score, maxScore)}</td>
            <td style="font-size:12px;color:var(--text-muted);">${r.raw_rank}</td>
            ${showStatus ? `<td>${pass ? '<span class="badge badge-success">✓ PASS</span>' : '<span class="badge badge-danger">✗ FAIL</span>'}</td>` : ''}
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>
    ${showStatus ? `<div style="padding:10px 16px;font-size:12px;color:var(--text-muted);border-top:1px solid var(--border);">
      Threshold = <strong${isSim ? ' style="color:#c2410c;"' : ''}>${threshold.toFixed(2)}</strong>
      ${isSim ? '<span style="margin-left:6px;background:#fef3c7;color:#92400e;font-size:10px;padding:1px 6px;border-radius:8px;font-weight:700;">SIMULATED</span>' : ''}
    </div>` : ''}`;
}

function hybridTable(rows, threshold, isSim = false) {
  if (!rows || rows.length === 0) return emptyMsg('No hybrid results');

  const maxScore = Math.max(...rows.map(r => r.combined_score));
  return `
    <div class="table-wrap"><table>
      <thead><tr>
        <th>#</th><th>Doc ID</th><th>Title</th>
        <th>Combined</th><th>Vec score</th><th>BM25 score</th><th>Status</th>
      </tr></thead>
      <tbody>
        ${rows.map((r, i) => {
          const pass = r.combined_score > threshold;
          return `<tr style="${pass ? '' : 'opacity:.5;'}">
            <td style="color:var(--text-muted);font-size:12px;">${i + 1}</td>
            <td><span class="badge badge-neutral">${r.doc_id ?? '—'}</span></td>
            <td style="max-width:260px;white-space:normal;word-break:break-word;font-size:13px;">${escHtml(r.title)}</td>
            <td>${scoreBar(r.combined_score, maxScore)}</td>
            <td style="font-size:12px;color:#1d4ed8;">${r.vector_score.toFixed(4)}</td>
            <td style="font-size:12px;color:#15803d;">${r.bm25_score.toFixed(4)}</td>
            <td>${pass
              ? '<span class="badge badge-success">✓ PASS</span>'
              : '<span class="badge badge-danger">✗ FAIL</span>'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>
    <div style="padding:10px 16px;font-size:12px;color:var(--text-muted);border-top:1px solid var(--border);">
      Formula: <code>combined = vec_score × w<sub>vec</sub> + bm25_score × w<sub>bm25</sub></code>
      &nbsp;|&nbsp; Threshold = <strong${isSim ? ' style="color:#c2410c;"' : ''}>${typeof threshold === 'number' ? threshold.toFixed(2) : threshold}</strong>
      ${isSim ? '<span style="margin-left:6px;background:#fef3c7;color:#92400e;font-size:10px;padding:1px 6px;border-radius:8px;font-weight:700;">SIMULATED</span>' : ''}
    </div>`;
}

function thresholdSection(tf, isSim = false) {
  const failedRows = tf.failed_items || [];
  const threshold  = typeof tf.threshold === 'number' ? tf.threshold : parseFloat(tf.threshold);

  const failedHtml = failedRows.length === 0
    ? '<p style="color:var(--text-muted);padding:12px 16px;font-size:13px;">All results passed the threshold.</p>'
    : `<div class="table-wrap"><table>
        <thead><tr><th>Doc ID</th><th>Title</th><th>Combined score</th><th>Gap to threshold</th></tr></thead>
        <tbody>${failedRows.map(r => `
          <tr style="opacity:.6;">
            <td><span class="badge badge-neutral">${r.doc_id ?? '—'}</span></td>
            <td style="max-width:320px;white-space:normal;word-break:break-word;font-size:13px;">${escHtml(r.title)}</td>
            <td style="color:var(--danger);font-weight:600;">${r.combined_score.toFixed(4)}</td>
            <td style="font-size:12px;color:var(--text-muted);">−${(threshold - r.combined_score).toFixed(4)}</td>
          </tr>`).join('')}
        </tbody></table></div>`;

  const simBadge = isSim
    ? ' <span style="font-size:10px;background:#fed7aa;color:#c2410c;padding:1px 6px;border-radius:8px;font-weight:700;margin-left:6px;">SIMULATED</span>'
    : '';

  const headerExtra = `<span style="font-size:13px;color:#92400e;margin-left:auto;"
      >threshold = <strong${isSim ? ' style="color:#c2410c;"' : ''}>${threshold.toFixed(2)}</strong>${simBadge}
      &nbsp;·&nbsp;
      <span style="color:#15803d;font-weight:600;">${tf.passed} passed</span>
      &nbsp;/&nbsp;
      <span style="color:#b91c1c;font-weight:600;">${tf.failed} failed</span></span>`;

  const bodyHtml = tf.failed > 0
    ? `<div style="padding:6px 16px 2px;font-size:12px;color:var(--text-muted);">Chunks that did NOT make the threshold:</div>${failedHtml}`
    : failedHtml;

  const bg = isSim ? '#fff7ed' : '#fef3c7';
  return `
    <details class="card" style="margin-bottom:16px;">
      <summary class="card-header" style="background:${bg};list-style:none;cursor:pointer;
                      display:flex;align-items:center;gap:8px;flex-wrap:wrap;user-select:none;">
        <span class="card-title" style="color:#92400e;">Threshold Filter${simBadge}</span>
        ${headerExtra}
        <span style="font-size:13px;color:#92400e;opacity:.6;margin-left:4px;">&#9660;</span>
      </summary>
      <div style="padding:0;">${bodyHtml}</div>
    </details>`;
}

function pricingTable(rows, triggered = true) {
  if (!triggered) {
    return `<div style="padding:12px 20px;">
      <p style="color:#9d174d;font-size:13px;margin:0 0 6px;">
        ⚠️ <strong>Pricing lookup was NOT triggered</strong> for this query.
      </p>
      <p style="color:var(--text-muted);font-size:12px;margin:0;">
        Add a pricing keyword to trigger it:
        <code>harga</code>, <code>price</code>, <code>berapa</code>, <code>cost</code>,
        <code>biaya</code>, <code>budget</code>, <code>diskon</code>, <code>kisaran</code>, <code>sekitar</code>…
      </p>
    </div>`;
  }
  if (!rows || rows.length === 0) return emptyMsg('No pricing records matched this query.');

  return `
    <div class="table-wrap"><table>
      <thead><tr>
        <th>#</th><th>ID</th><th>Product Name</th><th>SKU</th>
        <th>Price</th><th>Category</th><th>Description</th>
      </tr></thead>
      <tbody>
        ${rows.map((r, i) => `<tr>
          <td style="color:var(--text-muted);font-size:12px;">${i + 1}</td>
          <td><span class="badge badge-neutral">${r.id ?? '—'}</span></td>
          <td style="max-width:200px;white-space:normal;word-break:break-word;font-size:13px;font-weight:600;">${escHtml(r.product_name)}</td>
          <td style="font-size:12px;color:var(--text-muted);">${escHtml(r.sku ?? '—')}</td>
          <td style="font-weight:600;white-space:nowrap;">${r.price != null ? Number(r.price).toLocaleString('id-ID') + ' ' + (r.currency || 'IDR') : '—'}</td>
          <td style="font-size:12px;">${escHtml(r.category ?? '—')}</td>
          <td style="max-width:260px;white-space:normal;word-break:break-word;font-size:12px;color:var(--text-muted);">${escHtml(r.description ?? '—')}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
}

function queryDetectionBanner(qd) {
  if (!qd) return '';
  const pricingOn      = qd.is_pricing_query;
  const specOn         = qd.is_spec_query;
  const pricingMatched = qd.pricing_keywords_matched || [];
  const specMatched    = qd.spec_keywords_matched    || [];

  const pill = (label, on, keywords) => {
    const bg   = on ? '#dcfce7' : '#f1f5f9';
    const col  = on ? '#166534' : '#64748b';
    const icon = on ? '✅' : '⭕';
    const kws  = keywords.length
      ? ' ' + keywords.map(k =>
          `<code style="background:${on ? '#bbf7d0' : '#e2e8f0'};color:${on ? '#14532d' : '#475569'};
                        padding:1px 5px;border-radius:3px;font-size:10px;">${escHtml(k)}</code>`
        ).join(' ')
      : '';
    return `<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;
                          background:${bg};color:${col};border-radius:20px;font-size:12px;
                          font-weight:600;white-space:nowrap;">
      ${icon} ${escHtml(label)}${kws}
    </span>`;
  };

  return `
    <div style="margin-bottom:14px;padding:10px 16px;background:#f8fafc;
                border:1px solid var(--border);border-radius:8px;
                display:flex;align-items:center;flex-wrap:wrap;gap:10px;">
      <span style="font-size:12px;font-weight:600;color:var(--text-muted);white-space:nowrap;">DB triggers:</span>
      ${pill('Pricing DB', pricingOn, pricingMatched)}
      ${pill('Product Specs DB', specOn, specMatched)}
      ${(!pricingOn && !specOn)
        ? `<span style="font-size:12px;color:var(--text-muted);font-style:italic;">
             Neither structured DB triggered — only KB (VectorDB + BM25) is searched.
           </span>`
        : ''}
    </div>`;
}

function productSpecsTable(rows, triggered = true) {
  if (!triggered) {
    return `<div style="padding:12px 20px;">
      <p style="color:#c2410c;font-size:13px;margin:0 0 6px;">
        ⚠️ <strong>Product Specs lookup was NOT triggered</strong> for this query.
      </p>
      <p style="color:var(--text-muted);font-size:12px;margin:0;">
        Add a spec keyword to trigger it:
        <code>spesifikasi</code>, <code>fitur</code>, <code>mesin</code>, <code>transmisi</code>,
        <code>hp</code>, <code>cc</code>, <code>sunroof</code>, <code>carplay</code>,
        <code>seat</code>, <code>hybrid</code>, <code>electric</code>, <code>awd</code>, <code>4wd</code>…
      </p>
    </div>`;
  }
  if (!rows || rows.length === 0) return emptyMsg('No product spec records matched this query.');

  const FEAT_LABELS = {
    has_cooling_seat:    'Cooling Seat',   has_heated_seat:    'Heated Seat',
    has_sunroof:         'Sunroof',        has_360_camera:     '360° Cam',
    has_wireless_charge: 'Wireless',       has_cruise_control: 'Cruise Ctrl',
    has_collision_warn:  'Collision Warn', has_lane_assist:    'Lane Assist',
    has_auto_parking:    'Auto Park',      has_apple_carplay:  'CarPlay',
    has_android_auto:    'Android Auto',   has_keyless_entry:  'Keyless',
    has_push_start:      'Push Start',     has_rear_camera:    'Rear Cam',
    has_electric_seat:   'Elec Seat',
  };

  return `
    <div class="table-wrap"><table>
      <thead><tr>
        <th>#</th><th>Brand / Model</th><th>Year</th><th>Body / Engine</th>
        <th>Transmission</th><th>Drive</th><th>Features</th><th>Notes</th>
      </tr></thead>
      <tbody>
        ${rows.map((r, i) => {
          const name    = [r.brand, r.model, r.variant].filter(Boolean).join(' ');
          const engine  = [
            r.engine_type,
            r.engine_cc  ? r.engine_cc  + ' cc' : null,
            r.power_hp   ? r.power_hp   + ' hp' : null,
          ].filter(Boolean).join(' / ');
          const bodyEng = [r.body_type, engine].filter(Boolean).join(' · ');
          const feats   = (r.features || []).map(k =>
            `<span class="badge badge-info" style="font-size:10px;margin:1px;">${FEAT_LABELS[k] || k}</span>`
          ).join('');
          return `<tr>
            <td style="color:var(--text-muted);font-size:12px;">${i + 1}</td>
            <td style="font-weight:600;font-size:13px;white-space:nowrap;">${escHtml(name)}</td>
            <td style="font-size:12px;">${r.year || '—'}</td>
            <td style="font-size:12px;max-width:160px;white-space:normal;">${escHtml(bodyEng || '—')}</td>
            <td>${r.transmission
              ? `<span class="badge badge-info">${escHtml(r.transmission)}</span>` : '—'}</td>
            <td style="font-size:12px;">${escHtml(r.drive_system || '—')}</td>
            <td style="max-width:220px;">${feats ||
              '<span style="color:var(--text-muted);font-size:11px;">none</span>'}</td>
            <td style="max-width:200px;white-space:normal;font-size:11px;color:var(--text-muted);">${escHtml(r.spec_notes || '—')}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
}

function llmContextSection(lc, isSim = false) {
  const rows = lc.sources || [];
  const simBadge = isSim
    ? ' <span style="font-size:10px;background:#e9d5ff;color:#7e22ce;padding:1px 6px;border-radius:8px;font-weight:700;margin-left:6px;">SIMULATED</span>'
    : '';
  const subtitle = isSim
    ? 'Simulated — documents that would be sent to LLM at this threshold'
    : 'These are the documents the LLM would receive as context';

  const bodyHtml = rows.length === 0
    ? emptyMsg('No sources passed the threshold — LLM would receive no context and respond with "I don\'t have that information".')
    : `
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Source #</th><th>Doc ID</th><th>Title sent to LLM</th>
          <th>Combined score</th><th>Vec</th><th>BM25</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `<tr>
            <td style="text-align:center;"><span class="badge badge-info" style="background:#ede9fe;color:#5b21b6;font-size:14px;">[${r.source_num}]</span></td>
            <td><span class="badge badge-neutral">${r.doc_id ?? '—'}</span></td>
            <td style="max-width:320px;white-space:normal;word-break:break-word;font-weight:600;font-size:13px;">${escHtml(r.title)}</td>
            <td><span style="font-weight:700;color:#5b21b6;">${r.score.toFixed(4)}</span></td>
            <td style="font-size:12px;color:#1d4ed8;">${(r.vector_score ?? 0).toFixed(4)}</td>
            <td style="font-size:12px;color:#15803d;">${(r.bm25_score ?? 0).toFixed(4)}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>
      <div style="padding:10px 16px;font-size:12px;color:var(--text-muted);border-top:1px solid var(--border);">
        LLM is instructed to cite as [Source 1], [Source 2]… and return
        <code>{"cited_sources": [1, 2, …]}</code> at the end of its answer.
      </div>`;

  const bg = isSim ? '#fdf4ff' : '#ede9fe';
  return `
    <details class="card" style="margin-bottom:16px;" open>
      <summary class="card-header" style="background:${bg};list-style:none;cursor:pointer;
                      display:flex;align-items:center;justify-content:space-between;user-select:none;">
        <span>
          <span class="card-title" style="color:#5b21b6;">LLM Context Sources (${lc.sources_count})${simBadge}</span>
          <small style="color:#7c3aed;font-weight:400;margin-left:8px;">${subtitle}</small>
        </span>
        <span style="font-size:13px;color:#5b21b6;opacity:.6;">&#9660;</span>
      </summary>
      <div style="padding:0;">${bodyHtml}</div>
    </details>`;
}
