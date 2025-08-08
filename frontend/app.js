// Frontend for Notes Drive (Enhanced Version v2)
const API_BASE = 'https://script.google.com/macros/s/AKfycbwCg8HYQZqpA-M0NeRDjd1he29xRMtXsvaYoZACX2r_loUrfDmb8Y-6Xe1ktapO9vtR/exec'; // IMPORTANT: Replace with your deployed Apps Script URL

// --- DOM Elements ---
const els = {
  grid: document.getElementById('grid'),
  categoryButtons: document.getElementById('category-buttons'),
  searchInput: document.getElementById('search-input'),
  formUpload: document.getElementById('form-upload'),
  inputFile: document.getElementById('inp-file'),
  chkPublish: document.getElementById('chk-publish'),
  uploadStatus: document.getElementById('upload-status'),
  toast: document.getElementById('toast'),
  dropzone: document.getElementById('dropzone'),
  previewPanel: document.getElementById('preview-panel'),
  previewDetails: document.getElementById('preview-details'),
  btnUpload: document.getElementById('btn-upload'),
  publishCategoryLabel: document.getElementById('publish-category-label'),
  adminPanel: document.getElementById('admin-panel'),
  deletionRequestsList: document.getElementById('deletion-requests-list'),
  deleteModal: document.getElementById('delete-modal'),
  deleteForm: document.getElementById('delete-form'),
  deleteFileName: document.getElementById('delete-file-name'),
  deleteReason: document.getElementById('delete-reason'),
  cancelDeleteBtn: document.getElementById('cancel-delete-btn'),
  themeToggleBtn: document.getElementById('theme-toggle'),
  darkIcon: document.getElementById('theme-toggle-dark-icon'),
  lightIcon: document.getElementById('theme-toggle-light-icon'),
};

let currentCategory = 'documents';
let selectedFile = null;
let searchDebounceTimer;

// --- UTILITY & THEME ---
function toast(msg, ok = true) {
  els.toast.textContent = msg;
  els.toast.style.background = ok ? 'rgba(10, 140, 80, 0.95)' : 'rgba(220, 38, 38, 0.95)';
  els.toast.classList.remove('hidden');
  setTimeout(() => els.toast.classList.add('hidden'), 3000);
}

function fmtBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
}

function applyTheme(isDark) {
  if (isDark) {
    document.documentElement.classList.add('dark');
    els.darkIcon.classList.remove('hidden');
    els.lightIcon.classList.add('hidden');
  } else {
    document.documentElement.classList.remove('dark');
    els.darkIcon.classList.add('hidden');
    els.lightIcon.classList.remove('hidden');
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  applyTheme(isDark);
}

// --- CORE FUNCTIONS ---
function card(file) {
  const isImg = (file.mimeType || '').startsWith('image/');
  const thumb = isImg ? file.thumbnailLink : 'https://cdn.jsdelivr.net/gh/tabler/tabler-icons@latest/icons/file-text.svg';
  const date = file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : 'N/A';
  return `
    <article class="group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
      <div class="aspect-video w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700">
        <img src="${thumb}" alt="${file.name}" class="h-full w-full object-contain p-2 md:object-cover md:p-0 transition-transform group-hover:scale-105"/>
      </div>
      <div class="mt-3">
        <h3 class="line-clamp-2 font-semibold text-sm h-10">${file.name}</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${fmtBytes(file.size)} &bull; ${date}</p>
        <div class="mt-3 flex items-center gap-2">
          <a href="${file.webContentLink}" target="_blank" class="flex-1 text-center rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition">Download</a>
          <a href="${file.webViewLink}" target="_blank" class="flex-1 text-center rounded-lg bg-slate-800 dark:bg-slate-700 px-3 py-1.5 text-sm font-medium text-white dark:text-slate-200 hover:bg-black dark:hover:bg-slate-600 transition">View</a>
        </div>
        <button data-file-id="${file.id}" data-file-name="${file.name}" class="request-delete-btn w-full mt-2 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 px-3 py-1.5 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition">Request Deletion</button>
      </div>
    </article>
  `;
}

async function fetchFiles(category, searchTerm = '') {
  els.grid.innerHTML = Array(8).fill('<div class="h-64 animate-pulse rounded-xl bg-white/80 dark:bg-slate-800/80"></div>').join('');
  try {
    const url = new URL(API_BASE);
    url.searchParams.append('action', 'list');
    url.searchParams.append('category', category);
    if (searchTerm) {
      url.searchParams.append('search', searchTerm);
    }
    
    const res = await fetch(url);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    
    if (!data.files || data.files.length === 0) {
      els.grid.innerHTML = `<div class="col-span-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center text-slate-500 dark:text-slate-400">No files found.</div>`;
    } else {
      els.grid.innerHTML = data.files.map(card).join('');
    }
  } catch (e) {
    els.grid.innerHTML = `<div class="col-span-full rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/50"><strong>Error:</strong> Failed to load files. ${e.message}</div>`;
  }
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) {
    selectedFile = null;
    els.previewPanel.classList.add('hidden');
    return;
  }
  selectedFile = file;
  els.previewDetails.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="flex-shrink-0 h-10 w-10 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
        <svg class="h-6 w-6 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
      </div>
      <div>
        <p class="font-medium text-slate-800 dark:text-slate-200 truncate max-w-xs">${file.name}</p>
        <p class="text-xs text-slate-500 dark:text-slate-400">${fmtBytes(file.size)}</p>
      </div>
    </div>`;
  els.previewPanel.classList.remove('hidden');
  els.btnUpload.disabled = false;
  els.uploadStatus.textContent = '';
}

async function uploadFile(e) {
  e.preventDefault();
  if (!selectedFile) return toast('Please select a file to upload.', false);

  els.btnUpload.disabled = true;
  els.uploadStatus.textContent = 'Uploading...';

  // THIS IS THE CRITICAL FIX: Use FormData to send all parameters
  const formData = new FormData();
  formData.append('action', 'upload');
  formData.append('publish', els.chkPublish.checked);
  formData.append('category', currentCategory);
  formData.append('filename', selectedFile.name);
  formData.append('file', selectedFile);

  try {
    const res = await fetch(API_BASE, { method: 'POST', body: formData });
    const data = await res.json();

    if (!data.success) throw new Error(data.error);
    
    toast('File uploaded successfully!', true);
    await fetchFiles(currentCategory, els.searchInput.value); // Refresh the list
    els.formUpload.reset();
    handleFileSelect({ target: els.inputFile }); // Reset preview
    selectedFile = null;
    els.previewPanel.classList.add('hidden');

  } catch (e) {
    console.error('Upload error', e);
    toast(`Upload failed: ${e.message}`, false);
  } finally {
    els.btnUpload.disabled = false;
    els.uploadStatus.textContent = '';
  }
}

// --- ADMIN & DELETION ---
async function checkAndLoadAdminPanel() {
  try {
    const res = await fetch(`${API_BASE}?action=getAdminData`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.success) {
      els.adminPanel.classList.remove('hidden');
      renderAdminPanel(data.deletionRequests);
    }
  } catch (e) {
    console.log('Admin check failed (normal for non-admin users).');
  }
}

function renderAdminPanel(requests) {
  if (!requests || requests.length === 0) {
    els.deletionRequestsList.innerHTML = '<p class="text-amber-700 dark:text-amber-400">No pending requests.</p>';
    return;
  }
  els.deletionRequestsList.innerHTML = requests.map(req => `
    <div class="p-3 rounded-lg bg-amber-100/60 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800/50 flex items-center justify-between">
      <div>
        <p class="font-semibold text-amber-900 dark:text-amber-200">${req.fileName}</p>
        <p class="text-xs text-amber-700 dark:text-amber-400 italic">Reason: "${req.reason}"</p>
      </div>
      <button data-file-id="${req.fileId}" class="admin-delete-btn rounded-md bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700">Delete File</button>
    </div>
  `).join('');
}

async function executeAdminDelete(fileId) {
  if (!confirm(`Are you sure you want to permanently delete this file?`)) return;
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      body: JSON.stringify({ action: 'executeDelete', fileId: fileId })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    toast('File deleted successfully.', true);
    fetchFiles(currentCategory, els.searchInput.value);
    checkAndLoadAdminPanel();
  } catch (e) {
    toast(`Deletion failed: ${e.message}`, false);
  }
}

function openDeleteModal(fileId, fileName) {
  els.deleteFileName.textContent = fileName;
  els.deleteForm.dataset.fileId = fileId;
  els.deleteModal.classList.remove('hidden');
  els.deleteModal.classList.add('flex');
}

function closeDeleteModal() {
  els.deleteModal.classList.add('hidden');
  els.deleteModal.classList.remove('flex');
  els.deleteForm.reset();
}

async function submitDeleteRequest(e) {
  e.preventDefault();
  const fileId = e.target.dataset.fileId;
  const reason = els.deleteReason.value;
  if (!reason.trim()) return toast('Please provide a reason.', false);

  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      body: JSON.stringify({ action: 'requestDelete', fileId, reason })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    toast('Deletion request submitted for review.', true);
    closeDeleteModal();
  } catch (e) {
    toast(`Request failed: ${e.message}`, false);
  }
}

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
  // Theme setup
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const savedTheme = localStorage.getItem('theme');
  applyTheme(savedTheme ? savedTheme === 'dark' : prefersDark);

  // Initial state setup
  document.querySelector(`.category-btn[data-category="${currentCategory}"]`).classList.add('active-category');
  fetchFiles(currentCategory);
  checkAndLoadAdminPanel();

  // Theme toggle
  els.themeToggleBtn.addEventListener('click', toggleTheme);
  
  // Category switching
  els.categoryButtons.addEventListener('click', (e) => {
    if (e.target.matches('.category-btn')) {
      document.querySelector('.category-btn.active-category').classList.remove('active-category');
      e.target.classList.add('active-category');
      currentCategory = e.target.dataset.category;
      els.publishCategoryLabel.textContent = currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1);
      fetchFiles(currentCategory, els.searchInput.value);
    }
  });

  // Search input
  els.searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      fetchFiles(currentCategory, els.searchInput.value);
    }, 300); // Debounce to avoid excessive API calls
  });

  // File upload
  els.inputFile.addEventListener('change', handleFileSelect);
  els.formUpload.addEventListener('submit', uploadFile);
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
    els.dropzone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
  });
  els.dropzone.addEventListener('drop', (e) => {
    els.inputFile.files = e.dataTransfer.files;
    handleFileSelect({ target: els.inputFile });
  });

  // Dynamic event listeners for buttons
  document.body.addEventListener('click', (e) => {
    if (e.target.matches('.request-delete-btn')) {
      openDeleteModal(e.target.dataset.fileId, e.target.dataset.fileName);
    }
    if (e.target.matches('.admin-delete-btn')) {
      executeAdminDelete(e.target.dataset.fileId);
    }
  });

  // Delete modal listeners
  els.deleteForm.addEventListener('submit', submitDeleteRequest);
  els.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
});
