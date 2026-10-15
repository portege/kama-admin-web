/**
 * users.js — User CRUD management
 */

let _editingUserId = null;
let _currentUserId = null;

async function renderUsers() {
  const body = document.getElementById('pageBody');
  const me = JSON.parse(sessionStorage.getItem('admin_user') || '{}');
  _currentUserId = me.id;
  const isSuperadmin = me.role === 'superadmin';

  body.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">👥 User Management</span>
        <div style="display:flex;gap:8px;">
          ${isSuperadmin ? '<button class="btn btn-primary btn-sm" onclick="openUserModal()">＋ Add User</button>' : ''}
          <button class="btn btn-secondary btn-sm" onclick="loadUsers()">🔄 Refresh</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="usersTableBody">
            <tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">Loading…</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- User modal -->
    <div class="modal-overlay hidden" id="userModal">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title" id="userModalTitle">Add User</span>
          <button class="modal-close" onclick="closeUserModal()">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Username <span style="color:var(--danger)">*</span></label>
            <input class="form-control" id="um-username" placeholder="e.g. john_doe" required />
          </div>
          <div class="form-group">
            <label class="form-label" id="um-pw-label">Password <span style="color:var(--danger)">*</span></label>
            <input class="form-control" type="password" id="um-password" placeholder="Enter password" />
            <small class="text-muted" id="um-pw-hint"></small>
          </div>
          <div class="form-group">
            <label class="form-label">Role</label>
            <select class="form-control" id="um-role">
              <option value="editor">Editor</option>
              <option value="analyst">Analyst</option>
              <option value="manager">Manager</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </div>
          <div class="form-group" id="um-active-group">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
              <input type="checkbox" id="um-active" checked style="width:16px;height:16px;" />
              <span class="form-label" style="margin:0;">Active</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeUserModal()">Cancel</button>
          <button class="btn btn-primary" id="userModalSaveBtn" onclick="saveUser()">Save</button>
        </div>
      </div>
    </div>
  `;

  await loadUsers();
}

async function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">Loading…</td></tr>';
  try {
    const data = await adminFetch('/users');
    const users = data.users || [];
    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">👤</div><p>No users found.</p></div></td></tr>';
      return;
    }
    const me = JSON.parse(sessionStorage.getItem('admin_user') || '{}');
    const isSuperadmin = me.role === 'superadmin';

    tbody.innerHTML = users.map(u => {
      const isMe = u.id === _currentUserId;
      let roleBadge;
      if (u.role === 'superadmin') {
        roleBadge = '<span class="badge badge-warning">Super Admin</span>';
      } else if (u.role === 'manager') {
        roleBadge = '<span class="badge badge-primary">Manager</span>';
      } else if (u.role === 'analyst') {
        roleBadge = '<span class="badge badge-info">Analyst</span>';
      } else {
        roleBadge = '<span class="badge badge-success">Editor</span>';
      }
      const statusBadge = u.is_active
        ? '<span class="badge badge-success">Active</span>'
        : '<span class="badge badge-danger">Inactive</span>';
      return `
        <tr>
          <td>${u.id}</td>
          <td>
            <strong>${esc(u.username)}</strong>
            ${isMe ? ' <span class="badge badge-neutral">You</span>' : ''}
          </td>
          <td>${roleBadge}</td>
          <td>${statusBadge}</td>
          <td>${u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
          <td>
            <div class="td-actions">
              <button class="btn btn-secondary btn-sm btn-icon" title="Edit"
                onclick="openUserModal(${JSON.stringify(u).replace(/"/g,'&quot;')})">✏️</button>
              ${isSuperadmin && !isMe
                ? `<button class="btn btn-danger btn-sm btn-icon" title="Delete" onclick="deleteUser(${u.id}, '${esc(u.username)}')">🗑️</button>`
                : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:var(--danger);padding:16px;">${err.message}</td></tr>`;
    showToast(err.message, 'error');
  }
}

function openUserModal(user = null) {
  _editingUserId = user?.id ?? null;
  const isEdit = !!user;
  document.getElementById('userModalTitle').textContent = isEdit ? 'Edit User' : 'Add User';
  document.getElementById('um-username').value = user?.username || '';
  document.getElementById('um-password').value = '';
  document.getElementById('um-role').value = user?.role || 'editor';
  document.getElementById('um-active').checked = user ? !!user.is_active : true;
  document.getElementById('um-pw-label').innerHTML = isEdit
    ? 'New Password <small class="text-muted">(leave blank to keep current)</small>'
    : 'Password <span style="color:var(--danger)">*</span>';
  document.getElementById('userModal').classList.remove('hidden');
}

function closeUserModal() {
  document.getElementById('userModal').classList.add('hidden');
  _editingUserId = null;
}

async function saveUser() {
  const username = document.getElementById('um-username').value.trim();
  const password = document.getElementById('um-password').value;
  const role     = document.getElementById('um-role').value;
  const isActive = document.getElementById('um-active').checked;

  if (!username) { showToast('Username is required', 'warning'); return; }
  if (!_editingUserId && !password) { showToast('Password is required for new users', 'warning'); return; }

  const payload = { username, role, is_active: isActive };
  if (password) payload.password = password;

  const btn = document.getElementById('userModalSaveBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    if (_editingUserId) {
      await adminFetch(`/users/${_editingUserId}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('User updated', 'success');
    } else {
      await adminFetch('/users', { method: 'POST', body: JSON.stringify(payload) });
      showToast('User created', 'success');
    }
    closeUserModal();
    await loadUsers();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save';
  }
}

async function deleteUser(id, username) {
  if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
  try {
    await adminFetch(`/users/${id}`, { method: 'DELETE' });
    showToast(`User "${username}" deleted`, 'success');
    await loadUsers();
  } catch (err) { showToast(err.message, 'error'); }
}

async function changeMyPassword() {
  const newPw  = document.getElementById('newPw').value;
  const confirm = document.getElementById('confirmPw').value;
  if (!newPw) { showToast('Enter a new password', 'warning'); return; }
  if (newPw !== confirm) { showToast('Passwords do not match', 'warning'); return; }
  if (newPw.length < 6) { showToast('Password must be at least 6 characters', 'warning'); return; }

  try {
    await adminFetch(`/users/${_currentUserId}`, {
      method: 'PUT',
      body: JSON.stringify({ password: newPw }),
    });
    document.getElementById('newPw').value = '';
    document.getElementById('confirmPw').value = '';
    showToast('Password updated successfully', 'success');
    // Hide the default password warning
    document.getElementById('defaultPwdWarning')?.classList.add('hidden');
  } catch (err) { showToast(err.message, 'error'); }
}
