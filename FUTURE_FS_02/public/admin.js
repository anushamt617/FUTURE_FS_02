const $ = (id) => document.getElementById(id);
let currentLeadId = null;
let allLeads = [];

function setMessage(id, message, isError = false) {
  const node = $(id);
  node.textContent = message;
  node.classList.toggle('error', isError);
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { ...(options.headers || {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}) }
  });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
function showDashboard(name) {
  $('loginView').classList.add('hidden');
  $('dashboardView').classList.remove('hidden');
  $('adminName').textContent = name || 'Administrator';
  loadLeads();
}
function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}
function makeCell(text, className = '') {
  const td = document.createElement('td');
  td.textContent = text || '—';
  if (className) td.className = className;
  return td;
}
function renderRows(leads) {
  const body = $('leadRows');
  body.replaceChildren();
  if (!leads.length) {
    const row = document.createElement('tr');
    const cell = makeCell('No leads found. Submit an enquiry or add a lead.', 'empty');
    cell.colSpan = 6;
    row.append(cell);
    body.append(row);
    return;
  }
  leads.forEach((lead) => {
    const row = document.createElement('tr');
    const client = document.createElement('td');
    const strong = document.createElement('strong');
    strong.textContent = lead.name;
    const email = document.createElement('small');
    email.textContent = lead.email;
    client.append(strong, email);
    row.append(client, makeCell(lead.source));
    const statusCell = document.createElement('td');
    const select = document.createElement('select');
    select.className = 'status-select';
    ['new', 'contacted', 'converted'].forEach((status) => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status.charAt(0).toUpperCase() + status.slice(1);
      option.selected = lead.status === status;
      select.append(option);
    });
    select.addEventListener('change', async () => {
      try { await api(`/api/leads/${lead._id}`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) }); await loadLeads(); }
      catch (error) { setMessage('dashboardFeedback', error.message, true); }
    });
    statusCell.append(select);
    row.append(statusCell, makeCell(formatDate(lead.followUpAt)), makeCell(formatDate(lead.createdAt)));
    const actions = document.createElement('td');
    const view = document.createElement('button');
    view.className = 'table-action';
    view.textContent = 'View';
    view.addEventListener('click', () => openDetails(lead._id));
    const remove = document.createElement('button');
    remove.className = 'table-action danger-text';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => deleteLead(lead._id, lead.name));
    actions.append(view, remove);
    row.append(actions);
    body.append(row);
  });
}
function updateStats(leads) {
  $('totalCount').textContent = leads.length;
  $('newCount').textContent = leads.filter((lead) => lead.status === 'new').length;
  $('contactedCount').textContent = leads.filter((lead) => lead.status === 'contacted').length;
  $('convertedCount').textContent = leads.filter((lead) => lead.status === 'converted').length;
}
async function loadLeads() {
  try {
    const params = new URLSearchParams();
    if ($('searchInput').value.trim()) params.set('search', $('searchInput').value.trim());
    if ($('statusFilter').value) params.set('status', $('statusFilter').value);
    const data = await api(`/api/leads?${params.toString()}`);
    allLeads = data.leads;
    renderRows(allLeads);
    updateStats(allLeads);
    setMessage('dashboardFeedback', '');
  } catch (error) {
    setMessage('dashboardFeedback', error.message, true);
    if (error.message.includes('log in')) location.reload();
  }
}
async function openDetails(id) {
  const lead = allLeads.find((item) => item._id === id);
  if (!lead) return;
  currentLeadId = id;
  $('detailName').textContent = lead.name;
  $('detailEmail').textContent = `${lead.email}${lead.phone ? ` · ${lead.phone}` : ''}`;
  $('detailMessage').textContent = lead.message || 'No message provided.';
  $('detailStatus').value = lead.status;
  $('detailFollowUp').value = lead.followUpAt ? new Date(lead.followUpAt).toISOString().slice(0, 10) : '';
  $('newNote').value = '';
  renderNotes(lead.notes || []);
  $('detailDialog').showModal();
}
function renderNotes(notes) {
  const list = $('notesList');
  list.replaceChildren();
  if (!notes.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'No notes added yet.';
    list.append(p);
    return;
  }
  notes.slice().reverse().forEach((note) => {
    const item = document.createElement('article');
    item.className = 'note-item';
    const p = document.createElement('p');
    p.textContent = note.text;
    const small = document.createElement('small');
    small.textContent = formatDate(note.createdAt);
    item.append(p, small);
    list.append(item);
  });
}
async function deleteLead(id, name) {
  if (!window.confirm(`Delete the lead for ${name}? This cannot be undone.`)) return;
  try { await api(`/api/leads/${id}`, { method: 'DELETE' }); setMessage('dashboardFeedback', 'Lead deleted.'); await loadLeads(); }
  catch (error) { setMessage('dashboardFeedback', error.message, true); }
}

$('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('loginFeedback', 'Signing in…');
  try {
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: $('loginEmail').value, password: $('loginPassword').value }) });
    showDashboard(data.name);
  } catch (error) { setMessage('loginFeedback', error.message, true); }
});
$('logoutButton').addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST' }); location.reload(); }
  catch (error) { setMessage('dashboardFeedback', error.message, true); }
});
$('addLeadButton').addEventListener('click', () => {
  $('leadForm').reset();
  $('leadSource').value = 'Manually added';
  setMessage('leadFormFeedback', '');
  $('leadDialog').showModal();
});
$('closeDialog').addEventListener('click', () => $('leadDialog').close());
$('cancelLead').addEventListener('click', () => $('leadDialog').close());
$('leadForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    name: $('leadName').value,
    email: $('leadEmail').value,
    phone: $('leadPhone').value,
    source: $('leadSource').value,
    message: $('leadMessage').value
  };
  try {
    await api('/api/leads', { method: 'POST', body: JSON.stringify(payload) });
    $('leadDialog').close();
    setMessage('dashboardFeedback', 'Lead added successfully.');
    await loadLeads();
  } catch (error) { setMessage('leadFormFeedback', error.message, true); }
});
$('closeDetail').addEventListener('click', () => $('detailDialog').close());
$('saveDetails').addEventListener('click', async () => {
  if (!currentLeadId) return;
  try {
    await api(`/api/leads/${currentLeadId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: $('detailStatus').value,
        followUpAt: $('detailFollowUp').value || null
      })
    });
    setMessage('detailFeedback', 'Lead details updated.');
    await loadLeads();
  } catch (error) { setMessage('detailFeedback', error.message, true); }
});
$('addNoteButton').addEventListener('click', async () => {
  if (!currentLeadId) return;
  try {
    const data = await api(`/api/leads/${currentLeadId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ text: $('newNote').value })
    });
    $('newNote').value = '';
    renderNotes(data.lead.notes || []);
    setMessage('detailFeedback', 'Note added.');
    await loadLeads();
  } catch (error) { setMessage('detailFeedback', error.message, true); }
});
$('searchInput').addEventListener('input', () => loadLeads());
$('statusFilter').addEventListener('change', () => loadLeads());

api('/api/auth/me').then((data) => showDashboard(data.name)).catch(() => {
  $('loginView').classList.remove('hidden');
  $('dashboardView').classList.add('hidden');
});
