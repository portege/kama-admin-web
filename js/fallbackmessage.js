/**
 * fallbackmessage.js — Fallback / No-Info Message Settings
 *
 * Lets admins configure what the AI replies when no relevant information
 * is found in the knowledge base. Separate messages for English and
 * Indonesian. Maximum 250 characters each.
 */

const FALLBACK_MAX_LEN = 250;

async function renderFallbackMessage() {
  const body = document.getElementById('pageBody');
  const user = JSON.parse(sessionStorage.getItem('admin_user') || '{}');
  const canEdit = ['superadmin', 'manager', 'analyst'].includes(user.role);

  body.innerHTML = `
    <div style="max-width:760px;margin:0 auto;">

      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <span class="card-title">Fallback Message</span>
          <small style="color:var(--text-muted);font-weight:400;">
            Shown to users when the AI cannot find any relevant information in the knowledge base.
          </small>
        </div>
        <div class="card-body">

          <div style="background:var(--bg-subtle,#f9fafb);border:1px solid var(--border);
                      border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:13px;
                      color:var(--text-muted);line-height:1.6;">
            <strong>How it works:</strong> When a query returns no results from the knowledge base,
            pricing database, or product specs, the system returns this message instead of
            hallucinating an answer. The correct language version is selected automatically based
            on the user's query language.
          </div>

          <!-- English message -->
          <div class="form-group">
            <label class="form-label" for="fallbackMsgEn">
              🇬🇧 English Message
              <span id="fallbackEnCount" style="font-weight:400;font-size:12px;color:var(--text-muted);margin-left:8px;">0 / ${FALLBACK_MAX_LEN}</span>
            </label>
            <textarea
              id="fallbackMsgEn"
              class="form-control"
              rows="3"
              maxlength="${FALLBACK_MAX_LEN}"
              placeholder="e.g. Sorry, I don't have information on that topic."
              style="resize:vertical;font-size:14px;"
              oninput="_fbUpdateCount('fallbackMsgEn','fallbackEnCount')"
              ${canEdit ? '' : 'disabled'}
            ></textarea>
            <small class="form-help">Displayed when the user's query is detected as English.</small>
          </div>

          <!-- Indonesian message -->
          <div class="form-group" style="margin-top:16px;">
            <label class="form-label" for="fallbackMsgId">
              🇮🇩 Indonesian Message (Bahasa)
              <span id="fallbackIdCount" style="font-weight:400;font-size:12px;color:var(--text-muted);margin-left:8px;">0 / ${FALLBACK_MAX_LEN}</span>
            </label>
            <textarea
              id="fallbackMsgId"
              class="form-control"
              rows="3"
              maxlength="${FALLBACK_MAX_LEN}"
              placeholder="e.g. Maaf, saya tidak memiliki informasi mengenai topik tersebut."
              style="resize:vertical;font-size:14px;"
              oninput="_fbUpdateCount('fallbackMsgId','fallbackIdCount')"
              ${canEdit ? '' : 'disabled'}
            ></textarea>
            <small class="form-help">Displayed when the user's query is detected as Indonesian (Bahasa).</small>
          </div>

          ${canEdit ? `
          <div style="margin-top:20px;display:flex;gap:10px;align-items:center;">
            <button class="btn btn-primary" id="fallbackSaveBtn" onclick="saveFallbackMessage()">
              Save Changes
            </button>
            <button class="btn btn-secondary" onclick="loadFallbackMessage()">
              Reset
            </button>
          </div>
          ` : `
          <p style="margin-top:16px;font-size:12px;color:var(--text-muted);">
            You don't have permission to edit these settings.
          </p>
          `}

        </div>
      </div>

      <!-- Preview card -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Live Preview</span>
          <small style="color:var(--text-muted);font-weight:400;">How the message appears in the chat widget</small>
        </div>
        <div class="card-body">
          <div style="display:flex;gap:20px;flex-wrap:wrap;">
            <div style="flex:1;min-width:240px;">
              <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:6px;">English</div>
              <div id="fallbackPreviewEn"
                   style="background:var(--bg-subtle,#f3f4f6);border-radius:10px;
                          padding:10px 14px;font-size:14px;color:var(--text);
                          border-left:3px solid #6d28d9;line-height:1.5;">—</div>
            </div>
            <div style="flex:1;min-width:240px;">
              <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:6px;">Indonesian</div>
              <div id="fallbackPreviewId"
                   style="background:var(--bg-subtle,#f3f4f6);border-radius:10px;
                          padding:10px 14px;font-size:14px;color:var(--text);
                          border-left:3px solid #dc2626;line-height:1.5;">—</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  `;

  await loadFallbackMessage();
}

function _fbUpdateCount(textareaId, countId) {
  const ta = document.getElementById(textareaId);
  const counter = document.getElementById(countId);
  if (!ta || !counter) return;
  const len = ta.value.length;
  counter.textContent = `${len} / ${FALLBACK_MAX_LEN}`;
  counter.style.color = len > FALLBACK_MAX_LEN * 0.9 ? '#dc2626' : 'var(--text-muted)';

  // Live preview
  const previewId = textareaId === 'fallbackMsgEn' ? 'fallbackPreviewEn' : 'fallbackPreviewId';
  const preview = document.getElementById(previewId);
  if (preview) preview.textContent = ta.value.trim() || '—';
}

async function loadFallbackMessage() {
  try {
    const data = await adminFetch('/settings/fallback-message');
    const enEl = document.getElementById('fallbackMsgEn');
    const idEl = document.getElementById('fallbackMsgId');
    if (enEl) {
      enEl.value = data.message_en || '';
      _fbUpdateCount('fallbackMsgEn', 'fallbackEnCount');
    }
    if (idEl) {
      idEl.value = data.message_id || '';
      _fbUpdateCount('fallbackMsgId', 'fallbackIdCount');
    }
  } catch (err) {
    showToast('Failed to load fallback message settings: ' + err.message, 'error');
  }
}

async function saveFallbackMessage() {
  const enVal = (document.getElementById('fallbackMsgEn')?.value || '').trim();
  const idVal = (document.getElementById('fallbackMsgId')?.value || '').trim();

  if (!enVal) { showToast('English fallback message cannot be empty', 'warning'); return; }
  if (!idVal) { showToast('Indonesian fallback message cannot be empty', 'warning'); return; }
  if (enVal.length > FALLBACK_MAX_LEN) { showToast(`English message exceeds ${FALLBACK_MAX_LEN} characters`, 'warning'); return; }
  if (idVal.length > FALLBACK_MAX_LEN) { showToast(`Indonesian message exceeds ${FALLBACK_MAX_LEN} characters`, 'warning'); return; }

  const btn = document.getElementById('fallbackSaveBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    await adminFetch('/settings/fallback-message', {
      method: 'PUT',
      body: JSON.stringify({ message_en: enVal, message_id: idVal }),
    });
    showToast('Fallback message saved ✓', 'success');
  } catch (err) {
    showToast('Failed to save: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
  }
}
