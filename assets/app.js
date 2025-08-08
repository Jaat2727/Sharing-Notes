// Frontend logic for Notes Drive
// Configure your deployed Apps Script Web App URL here:
// Example: https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxx/exec
const GAS_WEB_APP_URL = localStorage.getItem('GAS_WEB_APP_URL') || '';
const ADMIN_TOKEN = () => localStorage.getItem('ADMIN_TOKEN') || '';
const ADMIN_BACKEND_URL = () => localStorage.getItem('ADMIN_BACKEND_URL') || GAS_WEB_APP_URL;
let isAdmin = false;

const state = {
  files: [],
  categories: [],
  tree: null,
  activeTab: 'all',
  compact: false,
  searching: '',
  currentPath: '', // e.g., "Math/Algebra"
  openPaths: new Set(), // which tree paths are expanded
};

// Utility
function $(sel, root = document) { return root.querySelector(sel); }

// Admin functions
async function loadRequests() {
  if (!isAdmin) { $('#adminStatus').textContent = 'Not authorized'; return; }
  const data = await adminApiGet({ action: 'requests' });
  if (!data.ok) throw new Error(data.error || 'Failed to load requests');
  renderRequests(data.requests || []);
}

async function loadUploads() {
  if (!isAdmin) { $('#adminStatus').textContent = 'Not authorized'; return; }
  const data = await adminApiGet({ action: 'uploads' });
  if (!data.ok) throw new Error(data.error || 'Failed to load uploads');
  renderUploads(data.uploads || []);
}

function renderRequests(rows) {
  const tbody = $('#requestsTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  rows.forEach(r => {
    const tr = el('tr', {},
      el('td', {}, r.row),
      el('td', {}, r.timestamp ? new Date(r.timestamp).toLocaleString() : ''),
      el('td', {}, `${r.fileName || ''} (${r.fileId})`),
      el('td', {}, r.reason || ''),
      el('td', {}, r.userEmail || ''),
      el('td', {}, r.status || 'open'),
      el('td', {}, r.note || ''),
      el('td', {},
        (r.status === 'open') ? el('button', { class: 'btn', onclick: () => resolveRequest(r.row) }, 'Mark Resolved') : ''
      ),
    );
    tbody.append(tr);
  });
}

function renderUploads(items) {
  const tbody = $('#uploadsTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  items.forEach(u => {
    const tr = el('tr', {},
      el('td', {}, u.timestamp ? new Date(u.timestamp).toLocaleString() : ''),
      el('td', {}, `${u.fileName || ''} (${u.fileId})`),
      el('td', {}, u.path || ''),
      el('td', {}, u.userEmail || ''),
    );
    tbody.append(tr);
  });
}

async function resolveRequest(row) {
  if (!isAdmin) { $('#adminStatus').textContent = 'Not authorized'; return; }
  const note = prompt('Optional note for this resolution?') || '';
  const res = await adminApiPost({ action: 'resolveRequest', row, status: 'resolved', note });
  if (!res.ok) { alert(res.error || 'Failed'); return; }
  await loadRequests();
}

async function loadAdminData() {
  try {
    $('#adminStatus').textContent = 'Loading...';
    await Promise.all([loadRequests(), loadUploads()]);
    $('#adminStatus').textContent = 'Loaded';
    setTimeout(() => $('#adminStatus').textContent = '', 1200);
  } catch (e) {
    $('#adminStatus').textContent = 'Error loading admin data';
  }
}

async function handleCreateFolder() {
  const name = prompt('Folder name?');
  if (!name) return;
  try {
    await apiPost({ action: 'createFolder', parentPath: state.currentPath, name });
    await Promise.all([loadTree(), loadFiles(), loadCategories()]);
  } catch (e) {
    alert('Failed to create folder: ' + e.message);
  }
}

async function requestDelete(file) {
  const reason = prompt(`Request delete for "${file.name}". Reason? (optional)`);
  if (reason === null) return; // canceled
  try {
    await apiPost({ action: 'requestDelete', fileId: file.id, reason });
    alert('Request sent. The owner will review it.');
  } catch (e) {
    alert('Failed to send request: ' + e.message);
  }
}
function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v);
  });
  children.filter(Boolean).forEach(c => e.append(c));
  return e;
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

function iconFor(mime) {
  if (!mime) return '📄';
  if (mime.includes('pdf')) return '📕';
  if (mime.includes('image')) return '🖼️';
  if (mime.includes('audio')) return '🎵';
  if (mime.includes('video')) return '🎞️';
  if (mime.includes('zip') || mime.includes('compressed')) return '🗜️';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return '📊';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return '📽️';
  if (mime.includes('word') || mime.includes('document')) return '📝';
  return '📄';
}

// API
async function apiGet(params = {}) {
  if (!GAS_WEB_APP_URL) throw new Error('Backend URL not set. Click the "Source" link in footer and follow README to set GAS_WEB_APP_URL.');
  const url = new URL(GAS_WEB_APP_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { method: 'GET', credentials: 'include' });
  if (!res.ok) throw new Error(`GET failed: ${res.status}`);
  return res.json();
}

// Admin API uses a (potentially) different deployment that requires login
async function adminApiGet(params = {}) {
  const base = ADMIN_BACKEND_URL();
  if (!base) throw new Error('Admin backend URL not set. Use setAdminBackendUrl(url).');
  const url = new URL(base);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { method: 'GET', credentials: 'include' });
  if (!res.ok) throw new Error(`GET failed: ${res.status}`);
  return res.json();
}

async function adminApiPost(body = {}) {
  const base = ADMIN_BACKEND_URL();
  if (!base) throw new Error('Admin backend URL not set. Use setAdminBackendUrl(url).');
  const res = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`POST failed: ${res.status}`);
  return res.json();
}

async function apiPost(body = {}) {
  if (!GAS_WEB_APP_URL) throw new Error('Backend URL not set. Click the "Source" link in footer and follow README to set GAS_WEB_APP_URL.');
  const res = await fetch(GAS_WEB_APP_URL, {
    method: 'POST',
    // Use a simple content type to avoid CORS preflight
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`POST failed: ${res.status}`);
  return res.json();
}

// Data loaders
async function loadFiles() {
  const { files = [] } = await apiGet({ action: 'list' });
  state.files = files;
  renderFiles();
}

async function loadCategories() {
  const { categories = [] } = await apiGet({ action: 'categories' });
  state.categories = categories;
  renderCategories();
  populateCategoryOptions();
}

async function loadTree() {
  const { tree = null } = await apiGet({ action: 'tree' });
  state.tree = tree;
  // open root by default
  state.openPaths.add('');
  renderTree();
  renderBreadcrumbs();
}

// Renderers
function renderFiles() {
  const grid = $('#fileGrid');
  const empty = $('#emptyState');
  grid.innerHTML = '';
  const q = state.searching.trim().toLowerCase();
  const inPath = (f) => {
    if (!state.currentPath) return true;
    return (f.path || '').startsWith(state.currentPath);
  };
  const filtered = state.files
    .filter(inPath)
    .filter(f => {
      if (!q) return true;
      const pathText = (f.path || '').toLowerCase();
      const nameText = (f.name || '').toLowerCase();
      const categoryText = (f.category || '').toLowerCase();
      return nameText.includes(q) || categoryText.includes(q) || pathText.includes(q);
    });
  if (filtered.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  filtered.forEach(f => {
    const item = el('div', { class: 'item' },
      el('div', { class: 'icon' }, iconFor(f.mimeType)),
      el('div', { class: 'meta' },
        el('h4', { class: 'name' }, f.name),
        el('div', { class: 'info' },
          el('span', { class: 'badge' }, f.category ? `#${f.category}` : 'Uncategorized'),
          el('span', { class: 'badge' }, (f.path || '') || '/'),
          el('span', {}, f.modifiedTime ? new Date(f.modifiedTime).toLocaleString() : ''),
          el('span', {}, f.size ? formatBytes(f.size) : '')
        )
      ),
      el('div', { class: 'actions' },
        el('a', { class: 'btn primary', href: f.downloadUrl, target: '_blank', rel: 'noopener' }, 'Download'),
        el('button', { class: 'btn', onclick: () => requestDelete(f) }, 'Request Delete')
      )
    );
    grid.appendChild(item);
  });
}

function renderCategories() {
  const list = $('#categoryList');
  list.innerHTML = '';
  if (!state.categories.length) {
    list.append(el('div', { class: 'empty' }, 'No categories yet. Upload with a category to create one.'));
    return;
  }
  state.categories.forEach(c => {
    const row = el('div', { class: 'category' },
      el('span', { class: 'name' }, `#${c.name}`),
      el('span', { class: 'muted' }, `${c.count} file${c.count === 1 ? '' : 's'}`)
    );
    list.append(row);
  });
}

function populateCategoryOptions() {
  const dl = $('#categoryOptions');
  dl.innerHTML = '';
  state.categories.forEach(c => {
    dl.append(el('option', { value: c.name }));
  });
}

// Tree & breadcrumbs
function renderBreadcrumbs() {
  const bc = $('#breadcrumb');
  const parts = state.currentPath ? state.currentPath.split('/') : [];
  bc.innerHTML = '';
  // root
  const rootCrumb = el('span', { class: 'crumb' }, '/');
  rootCrumb.onclick = () => { state.currentPath = ''; renderBreadcrumbs(); renderFiles(); };
  bc.append(rootCrumb);
  let pathAcc = '';
  parts.forEach((p, idx) => {
    bc.append(el('span', { class: 'sep' }, '›'));
    pathAcc = pathAcc ? `${pathAcc}/${p}` : p;
    const crumb = el('span', { class: 'crumb' }, p);
    crumb.onclick = () => { state.currentPath = pathAcc; renderBreadcrumbs(); renderFiles(); };
    bc.append(crumb);
  });
}

function renderTree() {
  const container = $('#treeView');
  container.innerHTML = '';
  if (!state.tree) { container.textContent = 'No folders'; return; }

  function makeNode(node, pathParts) {
    const path = pathParts.join('/');
    const isOpen = state.openPaths.has(path);
    const hasChildren = (node.children || []).length > 0;
    const row = el('div', { class: 'node' });
    const toggle = el('div', { class: 'toggle' }, hasChildren ? (isOpen ? '−' : '+') : '·');
    toggle.onclick = (e) => {
      e.stopPropagation();
      if (!hasChildren) return;
      if (isOpen) state.openPaths.delete(path); else state.openPaths.add(path);
      renderTree();
    };
    const name = el('span', {}, node.name || '/');
    const count = el('span', { class: 'count' }, String(node.fileCount || 0));
    row.append(toggle, name, count);
    row.onclick = () => { state.currentPath = path; renderBreadcrumbs(); renderFiles(); };

    const wrapper = el('div', {});
    wrapper.append(row);
    if (hasChildren && isOpen) {
      const kids = el('div', { class: 'children' });
      node.children.forEach(ch => {
        kids.append(makeNode(ch, path ? pathParts.concat([ch.name]) : [ch.name]));
      });
      wrapper.append(kids);
    }
    return wrapper;
  }

  // root path is ''
  container.append(makeNode({ ...state.tree, name: '/' }, []));
}

// Upload
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleUpload(e) {
  e.preventDefault();
  const status = $('#uploadStatus');
  const file = $('#fileInput').files[0];
  const category = $('#categorySelect').value.trim();
  if (!file) { status.textContent = 'Select a file'; return; }
  status.textContent = 'Uploading...';
  try {
    const content64 = await toBase64(file);
    const payload = {
      action: 'upload',
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      contentBase64: content64,
      category: category || null,
    };
    const res = await apiPost(payload);
    if (res && res.ok) {
      status.textContent = 'Uploaded ✔';
      $('#uploadForm').reset();
      await Promise.all([loadFiles(), loadCategories()]);
    } else {
      throw new Error(res && res.error || 'Upload failed');
    }
  } catch (err) {
    console.error(err);
    status.textContent = `Error: ${err.message}`;
  }
}

// Tabs and interactions
function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
}

function bindEvents() {
  // Tabs
  document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  // Search
  $('#searchInput').addEventListener('input', (e) => { state.searching = e.target.value; renderFiles(); });
  // Refresh
  $('#refreshBtn').addEventListener('click', async () => { await Promise.all([loadFiles(), loadCategories(), loadTree()]); });
  // Upload
  $('#uploadForm').addEventListener('submit', handleUpload);
  // Compact toggle
  const compactToggle = $('#compactToggle');
  compactToggle.addEventListener('change', () => {
    state.compact = compactToggle.checked;
    document.body.classList.toggle('compact', state.compact);
  });
  // New folder
  $('#newFolderBtn').addEventListener('click', handleCreateFolder);

  // Admin
  const tokenInput = $('#adminTokenInput');
  if (tokenInput) tokenInput.value = ADMIN_TOKEN();
  $('#saveAdminTokenBtn')?.addEventListener('click', () => {
    localStorage.setItem('ADMIN_TOKEN', tokenInput.value.trim());
    $('#adminStatus').textContent = 'Saved token';
    setTimeout(() => $('#adminStatus').textContent = '', 1500);
  });
  $('#loadAdminBtn')?.addEventListener('click', loadAdminData);
  $('#refreshRequestsBtn')?.addEventListener('click', loadRequests);
  $('#refreshUploadsBtn')?.addEventListener('click', loadUploads);
}

async function init() {
  bindEvents();
  try {
    await Promise.all([loadFiles(), loadCategories(), loadTree()]);
    // Gate admin UI
    try {
      const who = await adminApiGet({ action: 'whoami' });
      isAdmin = !!(who && who.ok && who.isAdmin);
    } catch {}
    const adminTabBtn = document.querySelector('.tab[data-tab="admin"]');
    const adminPanel = document.getElementById('tab-admin');
    if (!isAdmin) {
      adminTabBtn?.classList.add('hidden');
      adminPanel?.classList.add('hidden');
    } else {
      adminTabBtn?.classList.remove('hidden');
      adminPanel?.classList.remove('hidden');
    }
  } catch (e) {
    console.error(e);
    $('#fileGrid').innerHTML = '';
    $('#emptyState').classList.remove('hidden');
    $('#emptyState').textContent = 'Configure GAS web app URL. See README.';
  }
}

init();

// Helper: Allow setting GAS URL from console
window.setBackendUrl = function(url) {
  localStorage.setItem('GAS_WEB_APP_URL', url);
  alert('Saved backend URL. Refresh the page.');
};

// Helper: set admin backend URL (use admin deployment URL with Google-account access)
window.setAdminBackendUrl = function(url) {
  localStorage.setItem('ADMIN_BACKEND_URL', url);
  alert('Saved admin backend URL. Refresh the page.');
};
