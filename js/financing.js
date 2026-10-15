/**
 * financing.js — Admin panel for financing interest rates
 *
 * Single universal rate table: one rate per tenor, applicable to all loan types.
 */

// ── Section renderer ─────────────────────────────────────────────────────────

async function loadFinancingSection() {
  const container = document.getElementById('pageBody');
  container.innerHTML = `
    <div class="section-header" style="display:flex;align-items:center;gap:10px;">
      <h2 style="margin:0;">Repayment Calculator</h2>
    </div>
    <div id="financing-alert" style="display:none;" class="alert"></div>

    <!-- Tabs Navigation -->
    <div class="card" style="margin-bottom:20px;">
      <div style="border-bottom:1px solid var(--border);padding:0;">
        <div style="display:flex;gap:0;">
          <button class="financing-tab active" data-tab="rates" onclick="_switchFinancingTab('rates')" style="
            padding:12px 20px;border:none;background:transparent;cursor:pointer;
            font-weight:600;font-size:14px;color:var(--primary,#0ea5e9);
            border-bottom:2px solid var(--primary,#0ea5e9);transition:all 0.2s;
          ">
            Interest Rates
          </button>
          <span style="color:var(--border);padding:12px 0;font-size:14px;">|</span>
          <button class="financing-tab" data-tab="intent" onclick="_switchFinancingTab('intent')" style="
            padding:12px 20px;border:none;background:transparent;cursor:pointer;
            font-weight:500;font-size:14px;color:var(--text-muted);
            border-bottom:2px solid transparent;transition:all 0.2s;
          ">
            Intent Rules
          </button>
          <span style="color:var(--border);padding:12px 0;font-size:14px;">|</span>
          <button class="financing-tab" data-tab="reference" onclick="_switchFinancingTab('reference')" style="
            padding:12px 20px;border:none;background:transparent;cursor:pointer;
            font-weight:500;font-size:14px;color:var(--text-muted);
            border-bottom:2px solid transparent;transition:all 0.2s;
          ">
            OJK Reference
          </button>
        </div>
      </div>

      <!-- Tab: Interest Rates -->
      <div class="financing-tab-content" data-tab="rates" style="display:block;">
        <div class="card-header">
          <span class="card-title">Manage Interest Rates</span>
          <small style="color:var(--text-muted);font-weight:400;">
            Configure tenor periods and annual interest rates
          </small>
        </div>
        <div class="card-body">
          <h3 style="margin:0 0 12px;font-size:15px;">Add New Tenor</h3>
          <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
            <div>
              <label style="display:block;font-size:12px;margin-bottom:4px;">Tenor (months)</label>
              <input type="number" id="fin-new-tenor" placeholder="e.g. 96" min="1" style="width:120px;" class="inline-input">
            </div>
            <div>
              <label style="display:block;font-size:12px;margin-bottom:4px;">Annual Rate (%)</label>
              <input type="number" id="fin-new-rate" placeholder="e.g. 9.0" step="0.1" min="0" max="100" style="width:110px;" class="inline-input">
            </div>
            <div>
              <label style="display:block;font-size:12px;margin-bottom:4px;">Label (optional)</label>
              <input type="text" id="fin-new-label" placeholder="e.g. 8 Tahun" style="width:160px;" class="inline-input">
            </div>
            <div>
              <button class="btn btn-primary" onclick="_addFinancingRate()">+ Add</button>
            </div>
          </div>

          <div id="financing-table-wrap" style="margin-top:24px;">
            <div class="loading-spinner">Loading…</div>
          </div>
        </div>
      </div>

      <!-- Tab: Intent Rules -->
      <div class="financing-tab-content" data-tab="intent" style="display:none;">
        <div class="card-header">
          <span class="card-title">Financing — Intent Trigger Rules</span>
        </div>
        <div class="card-body" id="financingIntentRulesContainer"></div>
      </div>

      <!-- Tab: OJK Reference -->
      <div class="financing-tab-content" data-tab="reference" style="display:none;">
        <div class="card-header">
          <span class="card-title">OJK / Bank Indonesia Reference</span>
        </div>
        <div class="card-body">
          ${_ojkReferenceHtml()}
        </div>
      </div>
    </div>
  `;

  await _loadFinancingRates();
  
  // Render intent rules in its container
  const intentContainer = document.getElementById('financingIntentRulesContainer');
  if (intentContainer) {
    intentContainer.innerHTML = `
      <p style="font-size:13px;color:var(--text-muted);margin:0 0 12px;">
        These keywords guide the AI intent classifier to recognise
        <strong>financing / repayment</strong>-related queries.
        Click <strong>×</strong> on a tag to remove it. Type a keyword below and press
        <kbd style="font-size:11px;padding:1px 5px;border:1px solid var(--border);border-radius:3px;">Enter</kbd>
        or <kbd style="font-size:11px;padding:1px 5px;border:1px solid var(--border);border-radius:3px;">,</kbd>
        to add. Changes take effect immediately — no restart required.
      </p>

      <div id="intentChips_financing" onclick="_intentFocusInput('intentKwInput_financing')" style="
        display:flex;flex-wrap:wrap;gap:6px;align-items:center;
        min-height:44px;padding:8px 10px;
        border:1px solid var(--border);border-radius:8px;
        background:var(--card-bg,#fff);cursor:text;
      ">
        <input
          id="intentKwInput_financing"
          type="text"
          placeholder="Add keyword…"
          autocomplete="off"
          style="
            border:none;outline:none;background:transparent;
            font-size:13px;min-width:140px;flex:1;padding:2px 4px;
            color:var(--text-primary);
          "
          onkeydown="_intentInputKeydown(event,'financing','intentChips_financing','intentKwInput_financing')"
          onblur="_intentInputBlur('financing','intentChips_financing','intentKwInput_financing')"
        />
      </div>
      <small style="color:var(--text-muted);font-size:12px;margin-top:4px;display:block;">
        Press <strong>Enter</strong> or <strong>,</strong> to confirm. Backspace on empty input removes the last tag.
      </small>

      <div style="display:flex;align-items:center;gap:12px;margin-top:14px;">
        <button class="btn btn-primary btn-sm" onclick="_saveIntentRules('financing','intentRulesStatus_financing')">
          💾 Save Keywords
        </button>
        <button class="btn btn-secondary btn-sm" onclick="_resetIntentRules('financing','intentChips_financing','intentKwInput_financing','intentRulesStatus_financing')">
          ↩ Reset to Default
        </button>
        <span id="intentRulesStatus_financing" style="font-size:12px;color:var(--text-muted);"></span>
      </div>
    `;
    _loadIntentRules('financing', 'intentChips_financing', 'intentKwInput_financing');
  }
}

// ── OJK Reference Table ───────────────────────────────────────────────────────

function _ojkReferenceHtml() {
  const style = `style="border-collapse:collapse;width:100%;font-size:13px;"`;
  const th = `style="background:#f0f4ff;padding:8px 12px;text-align:left;border:1px solid #dde3f0;white-space:nowrap;"`;
  const td = `style="padding:7px 12px;border:1px solid #dde3f0;vertical-align:top;"`;
  const tdC = `style="padding:7px 12px;border:1px solid #dde3f0;text-align:center;"`;
  const note = `style="font-size:11px;color:#888;margin-top:6px;"`;

  return `
    <p style="margin:0 0 16px;font-size:13px;color:#666;">
      Estimasi suku bunga kredit konsumer berdasarkan BI Rate April 2026 (4,75%) dan spread rata-rata bank umum nasional.
      Gunakan sebagai referensi saat mengisi tabel interest rates.
    </p>

    <h4 style="margin:0 0 8px;font-size:13px;font-weight:600;">Kredit Kendaraan Bermotor (KKB) — Mobil</h4>
    <table ${style}>
      <thead>
        <tr>
          <th ${th}>Tenor</th>
          <th ${th}>Bunga Efektif / Tahun</th>
          <th ${th}>Catatan</th>
        </tr>
      </thead>
      <tbody>
        <tr><td ${td}>12 bulan (1 tahun)</td><td ${tdC}>5.75 – 7.5%</td><td ${td}>Tenor pendek, bunga lebih rendah</td></tr>
        <tr><td ${td}>24 bulan (2 tahun)</td><td ${tdC}>6.25 – 8.0%</td><td ${td}>—</td></tr>
        <tr><td ${td}>36 bulan (3 tahun)</td><td ${tdC}>7.0 – 9.0%</td><td ${td}>Paling umum dipilih</td></tr>
        <tr><td ${td}>48 bulan (4 tahun)</td><td ${tdC}>7.5 – 9.5%</td><td ${td}>—</td></tr>
        <tr><td ${td}>60 bulan (5 tahun)</td><td ${tdC}>8.0 – 10.0%</td><td ${td}>Batas tenor umum leasing</td></tr>
        <tr><td ${td}>72 bulan (6 tahun)</td><td ${tdC}>8.5 – 10.5%</td><td ${td}>Tersedia di bank tertentu</td></tr>
      </tbody>
    </table>
    <p ${note}>Sumber: estimasi berdasarkan BI Rate 4,75% (Apr 2026) + spread KKB rata-rata bank umum (BCA, BRI, Mandiri, BNI).</p>

    <h4 style="margin:24px 0 8px;font-size:13px;font-weight:600;">Kredit Pemilikan Rumah (KPR)</h4>
    <table ${style}>
      <thead>
        <tr>
          <th ${th}>Tenor</th>
          <th ${th}>Bunga Efektif / Tahun</th>
          <th ${th}>Catatan</th>
        </tr>
      </thead>
      <tbody>
        <tr><td ${td}>60 bulan (5 tahun)</td><td ${tdC}>6.5 – 8.5%</td><td ${td}>KPR subsidi FLPP: 5,0% (tetap)</td></tr>
        <tr><td ${td}>120 bulan (10 tahun)</td><td ${tdC}>7.5 – 10.0%</td><td ${td}>Fixed biasanya hanya 1–3 tahun pertama</td></tr>
        <tr><td ${td}>180 bulan (15 tahun)</td><td ${tdC}>8.0 – 10.5%</td><td ${td}>Setelah fixed → floating BI Rate + spread</td></tr>
        <tr><td ${td}>240 bulan (20 tahun)</td><td ${tdC}>8.5 – 11.0%</td><td ${td}>—</td></tr>
        <tr><td ${td}>300 bulan (25 tahun)</td><td ${tdC}>9.0 – 11.5%</td><td ${td}>Tenor maksimal umum KPR komersial</td></tr>
      </tbody>
    </table>
    <p ${note}>Sumber: estimasi berdasarkan BI Rate 4,75% (Apr 2026), data OJK Portal SLIK, dan Sarana Multigriya Finansial (SMF).</p>

    <h4 style="margin:24px 0 8px;font-size:13px;font-weight:600;">Kredit Tanpa Agunan (KTA) / Personal Loan</h4>
    <table ${style}>
      <thead>
        <tr>
          <th ${th}>Tenor</th>
          <th ${th}>Bunga Efektif / Tahun</th>
          <th ${th}>Catatan</th>
        </tr>
      </thead>
      <tbody>
        <tr><td ${td}>12 bulan (1 tahun)</td><td ${tdC}>11.0 – 16.0%</td><td ${td}>Cicilan ringan, bunga tinggi per cicilan</td></tr>
        <tr><td ${td}>24 bulan (2 tahun)</td><td ${tdC}>12.0 – 18.0%</td><td ${td}>Paling umum untuk KTA</td></tr>
        <tr><td ${td}>36 bulan (3 tahun)</td><td ${tdC}>13.0 – 20.0%</td><td ${td}>Batas tenor KTA sebagian besar bank</td></tr>
        <tr><td ${td}>48 bulan (4 tahun)</td><td ${tdC}>13.5 – 21.0%</td><td ${td}>Hanya bank/fintech tertentu</td></tr>
        <tr><td ${td}>60 bulan (5 tahun)</td><td ${tdC}>14.0 – 22.0%</td><td ${td}>Tenor maksimal KTA konvensional</td></tr>
      </tbody>
    </table>
    <p ${note}>Sumber: estimasi berdasarkan BI Rate 4,75% (Apr 2026), POJK No. 10/2022, spread KTA bank umum. Bunga flat ≈ efektif ÷ 1.8.</p>

    <p style="font-size:11px;color:#aaa;margin-top:16px;border-top:1px solid #eee;padding-top:10px;">
      BI Rate: 4,75% &bull; Lending Facility Rate: 5,50% &bull; Data posisi April 2026 (Bank Indonesia / Trading Economics).
      Angka di atas merupakan estimasi — suku bunga aktual dapat berbeda tergantung kebijakan masing-masing bank, profil debitur, dan kondisi pasar.
    </p>
  `;
}

// ── Load + render ─────────────────────────────────────────────────────────────

async function _loadFinancingRates() {
  try {
    const data = await adminFetch('/financing/rates');
    _renderFinancingTable(data.rates || []);
  } catch (err) {
    document.getElementById('financing-table-wrap').innerHTML =
      `<div class="alert alert-error">Failed to load rates: ${esc(String(err))}</div>`;
  }
}

function _renderFinancingTable(rates) {
  const wrap = document.getElementById('financing-table-wrap');
  if (!rates.length) {
    wrap.innerHTML = '<p class="text-muted">No rates found. Run <code>python setup_financing_db.py</code> on the server.</p>';
    return;
  }

  let html = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Tenor</th>
          <th>Annual Rate (%)</th>
          <th>Label</th>
          <th>Active</th>
          <th>Last Updated</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const r of rates) {
    const years = r.tenor_months >= 12 ? ` <span class="text-muted">(${Math.floor(r.tenor_months / 12)} yr)</span>` : '';
    html += `
      <tr id="fin-row-${r.id}">
        <td><strong>${r.tenor_months} mo</strong>${years}</td>
        <td>
          <input type="number" id="fin-rate-${r.id}" value="${r.annual_rate_pct}"
            step="0.1" min="0" max="100" style="width:80px;" class="inline-input">
        </td>
        <td>
          <input type="text" id="fin-label-${r.id}" value="${esc(r.label || '')}"
            placeholder="e.g. 4 Tahun" style="width:160px;" class="inline-input">
        </td>
        <td>
          <label class="toggle-switch">
            <input type="checkbox" id="fin-active-${r.id}" ${r.is_active ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </td>
        <td class="text-muted" style="font-size:12px;">${r.updated_at || '—'}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="_saveFinancingRate(${r.id})">Save</button>
          <button class="btn btn-sm btn-danger" onclick="_deleteFinancingRate(${r.id}, ${r.tenor_months})" style="margin-left:6px;">Delete</button>
        </td>
      </tr>
    `;
  }

  html += '</tbody></table>';
  wrap.innerHTML = html;
}

// ── Add handler ───────────────────────────────────────────────────────────────

async function _addFinancingRate() {
  const tenorInput = document.getElementById('fin-new-tenor');
  const rateInput  = document.getElementById('fin-new-rate');
  const labelInput = document.getElementById('fin-new-label');

  const tenor = parseInt(tenorInput.value, 10);
  const rate  = parseFloat(rateInput.value);
  const label = labelInput.value.trim() || null;

  if (!tenor || tenor < 1) { _showFinancingAlert('Please enter a valid tenor (months).', 'error'); return; }
  if (isNaN(rate) || rate < 0) { _showFinancingAlert('Please enter a valid annual rate.', 'error'); return; }

  const btn = document.querySelector('[onclick="_addFinancingRate()"]');
  btn.textContent = 'Adding…';
  btn.disabled = true;

  try {
    await adminFetch('/financing/rates', {
      method: 'POST',
      body: JSON.stringify({ tenor_months: tenor, annual_rate_pct: rate, label }),
    });
    tenorInput.value = '';
    rateInput.value  = '';
    labelInput.value = '';
    _showFinancingAlert(`Tenor ${tenor}mo added successfully.`, 'success');
    await _loadFinancingRates();
  } catch (err) {
    _showFinancingAlert(`Add failed: ${esc(String(err))}`, 'error');
  } finally {
    btn.textContent = '+ Add';
    btn.disabled = false;
  }
}

// ── Delete handler ────────────────────────────────────────────────────────────

async function _deleteFinancingRate(id, tenorMonths) {
  if (!confirm(`Delete tenor ${tenorMonths} months? This cannot be undone.`)) return;
  try {
    await adminFetch(`/financing/rates/${id}`, { method: 'DELETE' });
    _showFinancingAlert(`Tenor ${tenorMonths}mo deleted.`, 'success');
    await _loadFinancingRates();
  } catch (err) {
    _showFinancingAlert(`Delete failed: ${esc(String(err))}`, 'error');
  }
}

// ── Save handler ──────────────────────────────────────────────────────────────

async function _saveFinancingRate(id) {
  const rateInput = document.getElementById(`fin-rate-${id}`);
  const labelInput = document.getElementById(`fin-label-${id}`);
  const activeInput = document.getElementById(`fin-active-${id}`);

  const payload = {
    annual_rate_pct: parseFloat(rateInput.value),
    label: labelInput.value.trim() || null,
    is_active: activeInput.checked,
  };

  if (isNaN(payload.annual_rate_pct) || payload.annual_rate_pct < 0) {
    _showFinancingAlert('Invalid rate value.', 'error');
    return;
  }

  const btn = document.querySelector(`#fin-row-${id} .btn-primary`);
  const origText = btn.textContent;
  btn.textContent = 'Saving…';
  btn.disabled = true;

  try {
    await adminFetch(`/financing/rates/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    _showFinancingAlert(`Rate #${id} saved successfully.`, 'success');
    btn.textContent = '✓ Saved';
    setTimeout(() => { btn.textContent = origText; btn.disabled = false; }, 1800);
  } catch (err) {
    _showFinancingAlert(`Save failed: ${esc(String(err))}`, 'error');
    btn.textContent = origText;
    btn.disabled = false;
  }
}

// ── Alert helper ──────────────────────────────────────────────────────────────

function _showFinancingAlert(msg, type = 'success') {
  const el = document.getElementById('financing-alert');
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3500);
}

// Alias so navigate()'s globalName fallback ('renderFinancing') also works
const renderFinancing = loadFinancingSection;

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

function _switchFinancingTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.financing-tab').forEach(btn => {
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
  document.querySelectorAll('.financing-tab-content').forEach(content => {
    content.style.display = content.dataset.tab === tabName ? 'block' : 'none';
  });
}
