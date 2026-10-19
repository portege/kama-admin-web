/**
 * debug.js — Search Troubleshooting page
 *
 * Shows a full breakdown of a query through:
 *   1. VectorDB vector search  (score per chunk)
 *   2. SQLite BM25 search       (raw rank + normalised score per chunk)
 *   3. Hybrid fusion           (combined score = vec×w + bm25×w)
 *   4. Threshold filter        (pass / fail per chunk)
 *   5. LLM context             (final ordered list that would be sent to LLM)
 *
 * No LLM call is made — purely for troubleshooting retrieval quality.
 */

// ── Render ────────────────────────────────────────────────────────────────────

function renderDebug() {
  const body = document.getElementById('pageBody');
  body.innerHTML = `
    <div style="max-width:1000px;margin:0 auto;">

      <!-- Query input -->
      <div class="card" style="position:sticky;top:0;z-index:100;box-shadow:0 4px 16px rgba(0,0,0,.18);">
        <div class="card-header" style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);">          <span class="card-title" style="color:#fff;">Search Troubleshooter</span>
          <small style="color:#93c5fd;font-weight:400;">Inspect how a query flows through Vector Search, BM25 Search, hybrid fusion and threshold filtering</small>
        </div>
        <div class="card-body">
          <div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;">
            <div class="form-group" style="flex:1;min-width:260px;margin-bottom:0;">
              <label class="form-label">Query</label>
              <input class="form-control" type="text" id="debugQuery"
                     placeholder="e.g. Spesifikasi Toyota BZ4X"
                     onkeydown="if(event.key==='Enter')runDebugSearch()" />
            </div>
            <div class="form-group" style="width:100px;margin-bottom:0;">
              <label class="form-label">Top-K</label>
              <input class="form-control" type="number" id="debugTopK" value="10" min="1" max="50" />
            </div>
            <div class="form-group" style="width:230px;margin-bottom:0;">
              <label class="form-label" style="display:flex;align-items:center;gap:6px;">
                Sim Threshold
                <span style="font-size:10px;background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:8px;font-weight:700;letter-spacing:.3px;">SIM ONLY</span>
              </label>
              <div style="display:flex;align-items:center;gap:8px;">
                <input type="range" id="debugSimSlider" min="0" max="1" step="0.01" value="0.25"
                       oninput="syncSimThreshold('slider')"
                       style="flex:1;accent-color:#c2410c;cursor:pointer;" />
                <input class="form-control" type="number" id="debugSimThreshold"
                       value="0.25" min="0" max="1" step="0.01"
                       oninput="syncSimThreshold('input')"
                       style="width:72px;padding:6px 8px;" />
              </div>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="display:flex;align-items:center;gap:6px;">
                Sim Method
                <span style="font-size:10px;background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:8px;font-weight:700;letter-spacing:.3px;">SIM ONLY</span>
              </label>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <label style="display:flex;align-items:center;gap:4px;cursor:pointer;padding:5px 10px;
                              border:1px solid var(--border);border-radius:6px;font-size:13px;font-weight:500;
                              white-space:nowrap;">
                  <input type="radio" name="debugSimMethod" value="hybrid" checked
                         onchange="syncSimMethod()" style="accent-color:#854d0e;" /> Hybrid
                </label>
                <label style="display:flex;align-items:center;gap:4px;cursor:pointer;padding:5px 10px;
                              border:1px solid var(--border);border-radius:6px;font-size:13px;font-weight:500;
                              white-space:nowrap;">
                  <input type="radio" name="debugSimMethod" value="vector"
                         onchange="syncSimMethod()" style="accent-color:#1d4ed8;" /> Vector
                </label>
                <label style="display:flex;align-items:center;gap:4px;cursor:pointer;padding:5px 10px;
                              border:1px solid var(--border);border-radius:6px;font-size:13px;font-weight:500;
                              white-space:nowrap;">
                  <input type="radio" name="debugSimMethod" value="bm25"
                         onchange="syncSimMethod()" style="accent-color:#15803d;" /> BM25
                </label>
              </div>
            </div>
          </div>
          <div style="margin-top:12px;">
            <button class="btn btn-primary" onclick="runDebugSearch()" id="debugBtn" style="padding:6px 20px;">
              Run
            </button>
          </div>
        </div>
      </div>

      <!-- Results area -->
      <div id="debugResults" style="margin-top:20px;"></div>
    </div>
  `;
}

// ── API call ──────────────────────────────────────────────────────────────────

async function runDebugSearch() {
  const query = document.getElementById('debugQuery').value.trim();
  if (!query) { showToast('Enter a query first', 'warning'); return; }

  const topK = parseInt(document.getElementById('debugTopK').value) || 10;
  const btn  = document.getElementById('debugBtn');
  const out  = document.getElementById('debugResults');

  btn.disabled = true;
  btn.textContent = 'Running…';
  out.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);">⏳ Searching…</div>`;

  try {
    const data = await adminFetch('/debug/search', {
      method: 'POST',
      body: JSON.stringify({ query, top_k: topK }),
    });
    if (!data) return; // 401 already triggered logout redirect
    window._debugData = data;

    const config = data.config || {
      relevance_threshold: 0.35,
      search_method: 'hybrid',
      top_k: topK,
      vector_weight: data.weights?.vector ?? 0.5,
      bm25_weight: data.weights?.bm25 ?? 0.5,
      chunk_size: 500,
      chunk_overlap: 50,
    };

    // Sync sim controls to actual values returned from server
    const simSlider = document.getElementById('debugSimSlider');
    const simInput  = document.getElementById('debugSimThreshold');
    if (simSlider) simSlider.value = config.relevance_threshold ?? 0.35;
    if (simInput)  simInput.value  = config.relevance_threshold ?? 0.35;
    const actualMethod = config.search_method || 'hybrid';
    const methodRadio = document.querySelector(`input[name="debugSimMethod"][value="${actualMethod}"]`);
    if (methodRadio) methodRadio.checked = true;
    renderDebugResults(data);
  } catch (err) {
    out.innerHTML = `<div class="card"><div class="card-body" style="color:var(--danger);">❌ ${err.message}</div></div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Run';
  }
}

// ── Render results ────────────────────────────────────────────────────────────

function renderDebugResults(d) {
  const cfg = d.config || {
    top_k: 10,
    vector_weight: d.weights?.vector ?? 0.5,
    bm25_weight: d.weights?.bm25 ?? 0.5,
    relevance_threshold: 0.35,
    search_method: 'hybrid',
    chunk_size: 500,
    chunk_overlap: 50,
  };
  const out = document.getElementById('debugResults');

  out.innerHTML = `
    <!-- ① Config banner -->
    <div class="card" style="margin-bottom:16px;">
      <div class="card-body" style="display:flex;flex-wrap:wrap;gap:24px;align-items:center;">
        <div>
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;">Query</div>
          <div style="font-weight:600;font-size:15px;">"${escHtml(d.query)}"</div>
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          ${configBadge('Top-K', cfg.top_k)}
          ${configBadge('Vector weight', cfg.vector_weight)}
          ${configBadge('BM25 weight', cfg.bm25_weight)}
          ${configBadge('Chunk size', cfg.chunk_size ?? '—')}
          ${configBadge('Chunk overlap', cfg.chunk_overlap ?? '—')}
          <div style="text-align:center;">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;">Search Method</div>
            <div id="debugMethodBadge" style="font-weight:700;font-size:16px;">${cfg.search_method || 'hybrid'}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;">Threshold</div>
            <div id="debugThresholdBadge" style="font-weight:700;font-size:16px;">${cfg.relevance_threshold}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ①b Query detection banner -->
    ${queryDetectionBanner(d.query_detection)}

    <!-- ①c Intent Router -->
    ${intentRouterCard(d.router)}

    <!-- ② Summary row -->
    <div id="debugSummaryRow" style="display:grid;grid-template-columns:repeat(9,1fr);gap:12px;margin-bottom:16px;">
      ${summaryCard('To LLM', d.llm_context.sources_count, '#ede9fe', '#6d28d9')}
      ${summaryCard('Passed', d.threshold_filter.passed, '#dcfce7', '#166534')}
      ${summaryCard('Hybrid', d.hybrid.total, '#fef9c3', '#854d0e')}
      ${summaryCard('Vector Search', d.vectordb.count, '#dbeafe', '#1d4ed8')}
      ${summaryCard('BM25 Search', d.bm25.count, '#dcfce7', '#15803d')}
      ${summaryCard('Pricing', d.pricing ? d.pricing.count : 0, '#fce7f3', '#9d174d')}
      ${summaryCard('Product Specs', d.product_specs ? d.product_specs.count : 0, '#fff7ed', '#c2410c')}
      ${summaryCard('Financing', d.financing && d.financing.triggered ? (d.financing.error ? 'ERR' : 'OK') : '—', '#e0f2fe', '#0369a1')}
      ${summaryCard('Shipping', d.shipping && d.shipping.triggered ? (d.shipping.error ? 'ERR' : d.shipping.options.length || 0) : '—', '#fce7f3', '#be123c')}
    </div>

    <!-- ③ LLM context sources (first, open) -->
    <div id="debugLLMSection">${llmContextSection(d.llm_context)}</div>

    <!-- ④ Threshold filter detail -->
    <div id="debugThresholdSection">${thresholdSection(d.threshold_filter)}</div>

    <!-- ⑤ Hybrid fusion -->
    <div id="debugHybridSection">${collapsibleSection(
        'hybrid', 'Hybrid Fusion — Combined Scoring (' + d.hybrid.total + ')',
        '#fef9c3', '#854d0e',
        hybridTable(d.hybrid.results, cfg.relevance_threshold)
    )}</div>

    <!-- ⑥ VectorDB results -->
    <div id="debugChromaSection">${collapsibleSection('Vector Search', 'Vector Search (' + d.vectordb.count + ')', '#dbeafe', '#1e40af', chromaTable(d.vectordb.results, null, false, d.search_inputs?.vector_query))}</div>

    <!-- ⑦ BM25 results -->
    <div id="debugBM25Section">${collapsibleSection('BM25 Search', 'BM25 Search (' + d.bm25.count + ')', '#dcfce7', '#166634', bm25Table(d.bm25.results, null, false, d.search_inputs?.bm25_query, d.search_inputs?.bm25_tokens))}</div>

    <!-- ⑧ Pricing results -->
    ${collapsibleSection('pricing', 'Pricing Search (' + (d.pricing ? d.pricing.count : 0) + ')' + (d.pricing && !d.pricing.triggered ? ' — not triggered' : ''), '#fce7f3', '#9d174d', pricingTable(d.pricing ? d.pricing.results : [], d.pricing ? d.pricing.triggered : false))}

    <!-- ⑨ Product Specs results -->
    <div id="debugProductSpecsSection">${collapsibleSection('product_specs', 'Product Specs Search (' + (d.product_specs ? d.product_specs.count : 0) + ')' + (d.product_specs && !d.product_specs.triggered ? ' — not triggered' : ''), '#fff7ed', '#c2410c', productSpecsTable(d.product_specs ? d.product_specs.results : [], d.product_specs ? d.product_specs.triggered : false))}</div>

    <!-- ⑩ Financing simulation -->
    <div id="debugFinancingSection">${collapsibleSection('financing',
      'Financing Simulation'
      + (d.financing && d.financing.rates && d.financing.rates.length ? ' (' + d.financing.rates.length + ' rates)' : '')
      + (d.financing && !d.financing.triggered ? ' — not triggered' : '')
      + (d.financing && d.financing.error ? ' — error' : ''),
      '#e0f2fe', '#0369a1', financingDebugBody(d.financing))}</div>

    <!-- ⑪ Shipping query -->
    <div id="debugShippingSection">${collapsibleSection('shipping',
      'Shipping Query'
      + (d.shipping && d.shipping.options && d.shipping.options.length ? ' (' + d.shipping.options.length + ' options)' : '')
      + (d.shipping && !d.shipping.triggered ? ' — not triggered' : '')
      + (d.shipping && d.shipping.error ? ' — error' : ''),
      '#fce7f3', '#be123c', shippingDebugBody(d.shipping))}</div>
  `;
}

// ── Table renderers, helpers, etc. are provided by query-core.js ──────────────

// ── Intent Router card ────────────────────────────────────────────────────────

function intentRouterCard(router) {
  if (!router) {
    return `
      <div class="card" style="margin-bottom:16px;opacity:0.5;">
        <div class="card-header" style="background:#f0fdf4;">
          <span class="card-title" style="color:#166534;">Intent Router</span>
          <span style="font-size:12px;color:#166534;font-weight:400;">— data not available</span>
        </div>
      </div>`;
  }

  if (!router.enabled) {
    return `
      <div class="card" style="margin-bottom:16px;opacity:0.6;">
        <div class="card-header" style="background:#f5f5f5;">
          <span class="card-title" style="color:#6b7280;">Intent Router</span>
          <span class="badge" style="background:#d1d5db;color:#374151;margin-left:8px;">DISABLED</span>
        </div>
        <div class="card-body" style="font-size:13px;color:var(--text-muted);">
          Set <code>INTENT_ROUTER_ENABLED=true</code> in <code>.env</code> to enable LLM-powered intent classification.
        </div>
      </div>`;
  }

  const used = router.router_used;
  const conf = router.confidence != null ? (router.confidence * 100).toFixed(0) : '—';
  const confColor = router.confidence >= 0.8 ? '#166534' : router.confidence >= 0.6 ? '#854d0e' : '#dc2626';

  let dispatchHtml = '';
  if (router.dispatch) {
    const d = router.dispatch;
    dispatchHtml = `
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
        <div style="font-weight:600;font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Data Sources (Router Decision)</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <span class="badge" style="background:${d.enable_kb ? '#dcfce7' : '#fee2e2'};color:${d.enable_kb ? '#166534' : '#dc2626'};">
            ${d.enable_kb ? '✓' : '✗'} Knowledge Base
          </span>
          <span class="badge" style="background:${d.enable_pricing ? '#dcfce7' : '#fee2e2'};color:${d.enable_pricing ? '#166534' : '#dc2626'};">
            ${d.enable_pricing ? '✓' : '✗'} Pricing
          </span>
          <span class="badge" style="background:${d.enable_specs ? '#dcfce7' : '#fee2e2'};color:${d.enable_specs ? '#166534' : '#dc2626'};">
            ${d.enable_specs ? '✓' : '✗'} Product Specs
          </span>
          <span class="badge" style="background:${d.enable_financing ? '#e0f2fe' : '#fee2e2'};color:${d.enable_financing ? '#0369a1' : '#dc2626'};">
            ${d.enable_financing ? '✓' : '✗'} Financing
          </span>
        </div>
      </div>`;

    // Show effective routing after admin source-restriction overrides
    const ss = window._debugData && window._debugData.source_settings;
    if (ss) {
      const overrideRows = [
        { label: 'Pricing DB',   effectiveOn: ss.pricing_enabled },
        { label: 'Specs DB',     effectiveOn: ss.specs_enabled },
        { label: 'Financing DB', effectiveOn: ss.financing_enabled },
      ].filter(r => !r.effectiveOn);

      if (overrideRows.length > 0) {
        dispatchHtml += `
          <div style="margin-top:10px;padding:8px 12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;">
            <div style="font-weight:700;font-size:11px;color:#c2410c;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;">⚠️ Admin Settings Override — Routing Disabled</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              ${overrideRows.map(r => `<span class="badge" style="background:#fee2e2;color:#dc2626;">🚫 ${r.label} — routing OFF → falls back to KB</span>`).join('')}
            </div>
          </div>`;
      }
    }
  } else {
    dispatchHtml = `
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
        <div style="font-size:12px;color:#854d0e;">⚠️ Low confidence — falling back to keyword detection</div>
      </div>`;
  }

  return `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header" style="background:linear-gradient(135deg,#f0fdf4 0%,#ecfdf5 100%);display:flex;align-items:center;gap:8px;">
        <span class="card-title" style="color:#166534;">Intent Router</span>
        ${used
          ? `<span class="badge" style="background:#10b981;color:#fff;">ACTIVE</span>`
          : `<span class="badge" style="background:#f59e0b;color:#fff;">FALLBACK</span>`
        }
        ${router.model ? `<span style="font-size:11px;color:var(--text-muted);margin-left:auto;">${router.model}</span>` : ''}
      </div>
      <div class="card-body">
        <div style="display:flex;gap:32px;flex-wrap:wrap;align-items:flex-start;">
          <div style="min-width:120px;">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;">Intent</div>
            <div style="font-size:20px;font-weight:700;">${router.intent || '—'}</div>
          </div>
          <div style="min-width:100px;">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;">Confidence</div>
            <div style="font-size:20px;font-weight:700;color:${confColor};">${conf}%</div>
          </div>
          <div style="min-width:100px;">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;">Latency</div>
            <div style="font-size:20px;font-weight:700;">${router.latency_ms != null ? router.latency_ms + 'ms' : '—'}</div>
          </div>
          ${router.entities && router.entities.length > 0 ? `
          <div style="flex:1;min-width:160px;">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Entities</div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;">
              ${router.entities.map(e => `<span class="badge badge-info">${escHtml(e)}</span>`).join('')}
            </div>
          </div>
          ` : ''}
        </div>
        ${dispatchHtml}
      </div>
    </div>`;
}

// chromaTable() — provided by query-core.js

// bm25Table() — provided by query-core.js

// hybridTable() — provided by query-core.js

// thresholdSection() — provided by query-core.js

// pricingTable() — provided by query-core.js

// queryDetectionBanner() — provided by query-core.js

// productSpecsTable() — provided by query-core.js

// llmContextSection() — provided by query-core.js

// financingDebugBody — renders the inner body of the financing collapsible section
function financingDebugBody(fin) {
  if (!fin) return '<p style="color:var(--text-muted);">No financing data.</p>';

  const rates = fin.rates || [];
  const queriedTenor = (fin.entities || {}).tenor_months;
  const displayRates = queriedTenor ? rates.filter(r => r.tenor_months === queriedTenor) : rates;
  const showRates = displayRates.length ? displayRates : rates;

  // ── Error banner when triggered but something went wrong ──
  let errorHtml = '';
  if (fin.triggered && fin.error) {
    errorHtml = `<div style="color:#be123c;font-size:13px;margin-bottom:12px;">${escHtml(fin.error)}</div>`;
  }

  // ── Entities chips ──
  const entitiesHtml = _finEntitiesHtml(fin.entities);

  if (!rates.length) {
    return `${errorHtml}<div style="padding:12px 20px;font-size:13px;color:var(--text-muted);">No financing rates configured.</div>`;
  }

  const tenorLabel = queriedTenor
    ? (displayRates.length ? `${queriedTenor} bulan` : `${queriedTenor} bulan — not found, showing all`)
    : 'All tenors';

  return `
    ${errorHtml}
    ${entitiesHtml ? `<div style="padding:8px 20px 0;">${entitiesHtml}</div>` : ''}
    <div class="table-wrap"><table>
      <thead>
        <tr>
          <th>Tenor</th>
          <th>Annual Rate</th>
          <th>Label</th>
        </tr>
      </thead>
      <tbody>
        ${showRates.map(r => {
          const isMatch = queriedTenor && r.tenor_months === queriedTenor;
          return `<tr${isMatch ? ' style="background:#f0f9ff;"' : ''}>
            <td${isMatch ? ' style="font-weight:600;"' : ''}>${r.tenor_months} bulan</td>
            <td style="font-weight:600;color:#0369a1;">${r.annual_rate_pct}%</td>
            <td style="color:var(--text-muted);">${escHtml(r.label || '—')}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
}

function _finEntitiesHtml(entities) {
  if (!entities || !Object.keys(entities).length) return '';
  const pairs = Object.entries(entities).map(([k, v]) =>
    `<span class="badge badge-info" style="font-size:11px;">${escHtml(k)}: ${escHtml(String(v))}</span>`
  ).join(' ');
  return `<div style="margin-top:8px;"><span style="font-size:11px;color:var(--text-muted);margin-right:6px;">Entities:</span>${pairs}</div>`;
}

// shippingDebugBody — renders the inner body of the shipping collapsible section
function shippingDebugBody(ship) {
  if (!ship) return '<p style="color:var(--text-muted);">No shipping data.</p>';

  // ── Error banner when triggered but something went wrong ──
  let errorHtml = '';
  if (ship.triggered && ship.error) {
    errorHtml = `<div style="color:#be123c;font-size:13px;margin-bottom:12px;">${escHtml(ship.error)}</div>`;
  }

  if (!ship.options || !ship.options.length) {
    return `${errorHtml}<div style="padding:12px 20px;font-size:13px;color:var(--text-muted);">No shipping options found.</div>`;
  }

  return `
    ${errorHtml}
    <div style="padding:8px 20px 0;"><span style="font-size:11px;color:var(--text-muted);">From: </span><span style="font-weight:600;">${escHtml(ship.origin_name || '—')}</span> → <span style="font-size:11px;color:var(--text-muted);">To: </span><span style="font-weight:600;">${escHtml(ship.destination_name || '—')}</span></div>
    <div class="table-wrap"><table>
      <thead>
        <tr>
          <th>Courier</th>
          <th>Service</th>
          <th>Description</th>
          <th>Cost (IDR)</th>
          <th>ETD</th>
        </tr>
      </thead>
      <tbody>
        ${ship.options.map(opt => {
          const costFmt = opt.cost_idr ? `Rp ${opt.cost_idr.toLocaleString('id-ID')}` : '—';
          return `<tr>
            <td style="font-weight:600;color:#be123c;">${escHtml(opt.courier || '—')}</td>
            <td>${escHtml(opt.service || '—')}</td>
            <td style="color:var(--text-muted);">${escHtml(opt.description || '—')}</td>
            <td style="text-align:right;font-weight:600;">${costFmt}</td>
            <td>${escHtml(opt.etd_days || '—')}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// scoreBar, configBadge, summaryCard, emptyMsg, escHtml — provided by query-core.js

// ── Threshold simulation ──────────────────────────────────────────────────────

/**
 * Called whenever the slider or number input changes.
 * Keeps both controls in sync, then re-renders affected sections.
 */
function syncSimThreshold(source) {
  const slider = document.getElementById('debugSimSlider');
  const input  = document.getElementById('debugSimThreshold');
  if (!slider || !input) return;

  if (source === 'slider') {
    input.value = parseFloat(slider.value).toFixed(2);
  } else {
    const v = Math.min(1, Math.max(0, parseFloat(input.value) || 0));
    input.value = v.toFixed(2);
    slider.value = v;
  }

  if (window._debugData) reapplySimView();
}

/** Called when the Sim Method radio changes. */
function syncSimMethod() {
  if (window._debugData) reapplySimView();
}

/**
 * Master re-render: reads BOTH sim threshold + sim method controls,
 * re-derives pass/fail/LLM from the selected source, and updates all
 * affected sections. Does NOT call the server or change any settings.
 */
function reapplySimView() {
  const d = window._debugData;
  if (!d) return;

  const simThresholdInput = document.getElementById('debugSimThreshold');
  if (!simThresholdInput) return;
  const simThreshold = parseFloat(simThresholdInput.value);

  const simMethodEl = document.querySelector('input[name="debugSimMethod"]:checked');
  const simMethod   = simMethodEl ? simMethodEl.value : 'hybrid';

  const safeConfig = d.config || {
    search_method: 'hybrid',
    relevance_threshold: 0.35,
  };
  const actualMethod    = safeConfig.search_method || 'hybrid';
  const actualThreshold = safeConfig.relevance_threshold ?? 0.35;
  const isSimMethod    = simMethod !== actualMethod;
  const isSimThreshold = Math.abs(simThreshold - actualThreshold) > 0.001;
  const isSim          = isSimMethod || isSimThreshold;

  // ── Build result pool for the simulated search method ──
  let pool;
  if (simMethod === 'vector') {
    pool = (d.vectordb.results || []).map(r => ({
      chunk_id: r.chunk_id, doc_id: r.doc_id, title: r.title,
      combined_score: r.score, vector_score: r.score, bm25_score: 0,
    }));
  } else if (simMethod === 'bm25') {
    pool = (d.bm25.results || []).map(r => ({
      chunk_id: r.chunk_id, doc_id: r.doc_id, title: r.title,
      combined_score: r.score, vector_score: 0, bm25_score: r.score,
    }));
  } else {
    pool = d.hybrid.results || [];
  }

  const passed = pool.filter(r => r.combined_score > simThreshold);
  const failed = pool.filter(r => r.combined_score <= simThreshold);
  const llmSrc = passed.slice(0, 5).map((r, i) => ({
    source_num: i + 1,
    doc_id: r.doc_id,
    title: r.title,
    score: r.combined_score,
    vector_score: r.vector_score,
    bm25_score: r.bm25_score,
  }));

  // ── Threshold badge ──
  const tBadge = document.getElementById('debugThresholdBadge');
  if (tBadge) {
    tBadge.innerHTML = isSimThreshold
      ? `<del style="color:var(--text-muted);font-size:12px;font-weight:400;">${actualThreshold}</del>
         <strong style="color:#c2410c;"> ${simThreshold.toFixed(2)}</strong>
         <span style="display:inline-block;margin-left:4px;font-size:9px;background:#fef3c7;
                      color:#92400e;padding:1px 5px;border-radius:8px;font-weight:700;
                      vertical-align:middle;">SIM</span>`
      : `${actualThreshold}`;
  }

  // ── Method badge ──
  const mBadge = document.getElementById('debugMethodBadge');
  if (mBadge) {
    const methodIcon = { hybrid: '', vector: '', bm25: '' };
    mBadge.innerHTML = isSimMethod
      ? `<del style="color:var(--text-muted);font-size:12px;font-weight:400;">${actualMethod}</del>
         <strong style="color:#c2410c;"> ${methodIcon[simMethod] || ''} ${simMethod}</strong>
         <span style="display:inline-block;margin-left:4px;font-size:9px;background:#fef3c7;
                      color:#92400e;padding:1px 5px;border-radius:8px;font-weight:700;
                      vertical-align:middle;">SIM</span>`
      : `${methodIcon[actualMethod] || ''} ${actualMethod}`;
  }

  // ── Summary row ──
  const summaryEl = document.getElementById('debugSummaryRow');
  if (summaryEl) {
    const simLabel = isSim ? ' SIM' : '';
    summaryEl.innerHTML =
      summaryCard(
        `📤 To LLM${simLabel}`, llmSrc.length,
        isSim ? '#fdf4ff' : '#ede9fe',
        isSim ? '#7e22ce'  : '#6d28d9'
      ) +
      summaryCard(
        `✅ Passed${simLabel}`, passed.length,
        isSim ? '#fff7ed' : '#dcfce7',
        isSim ? '#c2410c'  : '#166534'
      ) +
      summaryCard('Hybrid', d.hybrid.total, '#fef9c3', '#854d0e') +
      summaryCard('Vector Search', d.vectordb.count, '#dbeafe', '#1d4ed8') +
      summaryCard('BM25', d.bm25.count, '#dcfce7', '#15803d') +
      summaryCard('Pricing', d.pricing ? d.pricing.count : 0, '#fce7f3', '#9d174d') +
      summaryCard('Product Specs', d.product_specs ? d.product_specs.count : 0, '#fff7ed', '#c2410c') +
      summaryCard('Financing', d.financing && d.financing.triggered ? (d.financing.error ? 'ERR' : 'OK') : '—', '#e0f2fe', '#0369a1');
    summaryEl.style.gridTemplateColumns = 'repeat(8,1fr)';
  }

  // ── Hybrid section ──
  const hybridEl = document.getElementById('debugHybridSection');
  if (hybridEl) {
    if (simMethod === 'hybrid') {
      hybridEl.innerHTML = collapsibleSection(
        'hybrid', 'Hybrid Fusion — Combined Scoring (' + d.hybrid.total + ')',
        '#fef9c3', '#854d0e',
        hybridTable(d.hybrid.results, simThreshold, isSimThreshold),
        true
      );
    } else {
      const mLabel = simMethod === 'vector' ? '🔵 Vector' : '🟢 BM25';
      hybridEl.innerHTML = `
        <div class="card" style="margin-bottom:16px;opacity:0.4;">
          <div class="card-header" style="background:#fef9c3;display:flex;align-items:center;gap:8px;">
            <span class="card-title" style="color:#854d0e;">⚡ Hybrid Fusion</span>
            <span style="font-size:12px;color:#854d0e;font-weight:400;">— not used in ${mLabel} sim mode</span>
          </div>
        </div>`;
    }
  }

  // ── VectorDB section ──
  const chromaEl = document.getElementById('debugChromaSection');
  if (chromaEl) {
    if (simMethod === 'vector') {
      chromaEl.innerHTML = collapsibleSection(
        'Vector Search', 'Vector Search (' + d.vectordb.count + ')', '#dbeafe', '#1e40af',
        chromaTable(d.vectordb.results, simThreshold, isSimThreshold, d.search_inputs?.vector_query), true
      );
    } else if (simMethod === 'bm25') {
      chromaEl.innerHTML = `
        <div class="card" style="margin-bottom:16px;opacity:0.4;">
          <div class="card-header" style="background:#dbeafe;display:flex;align-items:center;gap:8px;">
            <span class="card-title" style="color:#1e40af;">Vector Search</span>
            <span style="font-size:12px;color:#1e40af;font-weight:400;">— not used in 🟢 BM25 sim mode</span>
          </div>
        </div>`;
    } else {
      chromaEl.innerHTML = collapsibleSection(
        'chroma', 'Vector Search (' + d.vectordb.count + ')', '#dbeafe', '#1e40af',
        chromaTable(d.vectordb.results, null, false, d.search_inputs?.vector_query)
      );
    }
  }

  // ── BM25 section ──
  const bm25El = document.getElementById('debugBM25Section');
  if (bm25El) {
    if (simMethod === 'bm25') {
      bm25El.innerHTML = collapsibleSection(
        'bm25', 'BM25 Search (' + d.bm25.count + ') — SIM', '#dcfce7', '#166534',
        bm25Table(d.bm25.results, simThreshold, isSimThreshold, d.search_inputs?.bm25_query, d.search_inputs?.bm25_tokens), true
      );
    } else if (simMethod === 'vector') {
      bm25El.innerHTML = `
        <div class="card" style="margin-bottom:16px;opacity:0.4;">
          <div class="card-header" style="background:#dcfce7;display:flex;align-items:center;gap:8px;">
            <span class="card-title" style="color:#166534;">BM25 Search</span>
            <span style="font-size:12px;color:#166534;font-weight:400;">— not used in 🔵 Vector sim mode</span>
          </div>
        </div>`;
    } else {
      bm25El.innerHTML = collapsibleSection(
        'bm25', 'BM25 Search (' + d.bm25.count + ')', '#dcfce7', '#166634',
        bm25Table(d.bm25.results, null, false, d.search_inputs?.bm25_query, d.search_inputs?.bm25_tokens)
      );
    }
  }

  // ── Threshold section ──
  const threshEl = document.getElementById('debugThresholdSection');
  if (threshEl) {
    threshEl.innerHTML = thresholdSection(
      { threshold: simThreshold, passed: passed.length, failed: failed.length, failed_items: failed },
      isSim
    );
  }

  // ── LLM context section ──
  const llmEl = document.getElementById('debugLLMSection');
  if (llmEl) {
    llmEl.innerHTML = llmContextSection(
      { sources_count: llmSrc.length, sources: llmSrc },
      isSim
    );
  }
}
