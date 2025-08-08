//================================================================
// Notes Drive - Frontend Logic (JavaScript)
//
// Author: Gemini
// Version: 3.0 (Robust & Feature-Complete)
//================================================================

const API_BASE = 'https://script.google.com/macros/s/AKfycbwCg8HYQZqpA-M0NeRDjd1he29xRMtXsvaYoZACX2r_loUrfDmb8Y-6Xe1ktapO9vtR/exec';

// --- DOM ELEMENT REFERENCES ---
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
  themeToggle: document.getElementById('theme-toggle'),
  darkIcon: document.getElementById('theme-toggle-dark-icon'),
  lightIcon: document.getElementById('theme-toggle-light-icon'),
};

// --- APP STATE ---
let currentCategory = 'documents';
let selectedFile = null;
let searchDebounceTimer = null;

// --- UTILITY & THEME FUNCTIONS ---

/** Shows a toast notification. */
function toast(msg, isSuccess = true) {
  els.toast.textContent = msg;
  els.toast.style.backgroundColor = isSuccess ? '#059669' : '#DC2626'; // Green-600 or Red-600
  els.toast.classList.remove('opacity-0', 'translate-y-3');
  setTimeout(() => {
    els.toast.classList.add('opacity-0', 'translate-y-3');
  }, 3000);
}

/** Formats bytes into a human-readable string. */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/** Applies the current theme (dark/light) to the UI. */
function applyTheme(isDark) {
  document.documentElement.classList.toggle('dark', isDark);
  els.darkIcon.classList.toggle('hidden', !isDark);
  els.lightIcon.classList.toggle('hidden', isDark);
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

/** Toggles the color theme. */
const toggleTheme = () => applyTheme(!document.documentElement.classList.contains('dark'));


// --- CORE APPLICATION LOGIC ---

/** Generates the HTML for a single file card. */
function createFileCard(file) {
  const isImg = file.mimeType?.startsWith('image/');
  const iconSvg = `<svg class="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>`;
  const imageTag = `<img src="${file.thumbnailLink}" alt="${file.name}" loading="lazy" class="h-full w-full object-cover transition-transform group-hover:scale-105"/>`;

  return `
    <article class="group flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
      <div class="aspect-[16/10] w-full overflow-hidden rounded-t-xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center">
        ${isImg ? imageTag : iconSvg}
      </div>
      <div class="p-4 flex flex-col flex-grow">
        <h3 class="font-semibold text-sm h-10 line-clamp-2" title="${file.name}">${file.name}</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${formatBytes(file.size)} &bull; ${new Date(file.modifiedTime).toLocaleDateString()}</p>
        <div class="mt-4 flex items-center gap-2">
          <a href="${file.webContentLink}" target="_blank" class="flex-1 text-center rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition">Download</a>
          <a href="${file.webViewLink}" target="_blank" class="flex-1 text-center rounded-lg bg-slate-800 dark:bg-slate-700 px-3 py-1.5 text-sm font-medium text-white dark:text-slate-200 hover:bg-black dark:hover:bg-slate-600 transition">View</a>
        </div>
        <button data-file-id="${file.id}" data-file-name="${file.name}" class="request-delete-btn w-full mt-2 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 px-3 py-1.5 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition">Request Deletion</button>
      </div>
    </article>
  `;
}

/** Fetches and displays files from the backend. */
async function fetchAndRenderFiles(category, searchTerm = '') {
  els.grid.innerHTML = Array(8).fill('<div class="aspect-[16/10] animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"></div>').join('');
  
  try {
    const url = new URL(API_BASE);
    url.searchParams.set('action', 'list');
    url.searchParams.set('category', category);
    if (searchTerm) url.searchParams.set('search', searchTerm);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Server responded with status ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    
    if (data.files?.length) {
      els.grid.innerHTML = data.files.map(createFileCard).join('');
    } else {
      els.grid.innerHTML = `<div class="col-span-full rounded-xl p-8 text-center text-slate-500">No files found.</div>`;
    }
  } catch (err) {
    console.error('Fetch Error:', err);
    els.grid.innerHTML = `<div class="col-span-full rounded-xl border-2 border-dashed border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-8 text-center text-red-600 dark:text-red-300"><strong>Error:</strong> Failed to load files. Check the console for details.</div>`;
  }
}

/** Handles file selection for the upload form. */
function handleFileSelection(e) {
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
        <p class="text-xs text-slate-500 dark:text-slate-400">${formatBytes(file.size)}</p>
      </div>
    </div>`;
  els.previewPanel.classList.remove('hidden');
  els.btnUpload.disabled = false;
  els.uploadStatus.textContent = '';
}

/** Submits the upload form. */
async function handleUpload(e) {
  e.preventDefault();
  if (!selectedFile) return toast('Please select a file to upload.', false);

  els.btnUpload.disabled = true;
  els.uploadStatus.textContent = 'Uploading...';

  // FormData is crucial for sending files and other parameters correctly.
  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('filename', selectedFile.name);
  formData.append('action', 'upload');
  formData.append('publish', els.chkPublish.checked);
  formData.append('category', currentCategory);

  try {
    const res = await fetch(API_BASE, { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`Server error: ${res.statusText}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    
    toast('File uploaded successfully!', true);
    await fetchAndRenderFiles(currentCategory, els.searchInput.value);
    
    // Reset form and state
    els.formUpload.reset();
    selectedFile = null;
    els.previewPanel.classList.add('hidden');
  } catch (err) {
    console.error('Upload Error:', err);
    toast(`Upload failed: ${err.message}`, false);
  } finally {
    els.btnUpload.disabled = false;
    els.uploadStatus.textContent = '';
  }
}


// --- ADMIN & DELETION LOGIC ---

/** Checks if the current user is an admin and loads the admin panel. */
async function loadAdminData() {
  try {
    const res = await fetch(`${API_BASE}?action=getAdminData`);
    if (!res.ok) return; // Fail silently for non-admins
    const data = await res.json();
    if (data.success) {
      els.adminPanel.classList.remove('hidden');
      renderAdminPanel(data.deletionRequests);
    }
  } catch (err) { /* Silently fail if admin check fails */ }
}

/** Renders the admin panel with pending deletion requests. */
function renderAdminPanel(requests) {
  if (!requests?.length) {
    els.deletionRequestsList.innerHTML = '<p class="text-amber-700 dark:text-amber-400">No pending requests.</p>';
    return;
  }
  els.deletionRequestsList.innerHTML = requests.map(req => `
    <div class="p-3 rounded-lg bg-amber-100/60 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
      <div>
        <p class="font-semibold text-amber-900 dark:text-amber-200">${req.fileName}</p>
        <p class="text-xs text-amber-700 dark:text-amber-400 italic">Reason: "${req.reason}"</p>
      </div>
      <button data-file-id="${req.fileId}" class="admin-delete-btn flex-shrink-0 self-end sm:self-center rounded-md bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700 transition">Delete File</button>
    </div>
  `).join('');
}

/** Admin action to permanently delete a file. */
async function executeAdminDelete(fileId) {
  if (!confirm('Are you sure you want to permanently delete this file? This cannot be undone.')) return;

  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'executeDelete', fileId })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    toast('File deleted successfully.', true);
    await fetchAndRenderFiles(currentCategory, els.searchInput.value);
    await loadAdminData();
  } catch (err) {
    toast(`Deletion failed: ${err.message}`, false);
    console.error('Admin Delete Error:', err);
  }
}

/** Shows the modal for submitting a deletion request. */
function showDeleteModal(fileId, fileName) {
  els.deleteFileName.textContent = fileName;
  els.deleteForm.dataset.fileId = fileId;
  els.deleteModal.classList.remove('hidden');
  els.deleteModal.classList.add('flex');
}

/** Hides the deletion request modal. */
function hideDeleteModal() {
  els.deleteModal.classList.add('hidden');
  els.deleteModal.classList.remove('flex');
  els.deleteForm.reset();
}

/** Submits a user's request to delete a file. */
async function submitDeleteRequest(e) {
  e.preventDefault();
  const fileId = e.target.dataset.fileId;
  const reason = els.deleteReason.value;
  if (!reason.trim()) return toast('A reason is required.', false);

  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'requestDelete', fileId, reason })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    toast('Deletion request submitted for review.', true);
    hideDeleteModal();
  } catch (err) {
    toast(`Request failed: ${err.message}`, false);
    console.error('Delete Request Error:', err);
  }
}

// --- INITIALIZATION & EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
  // --- Initialize Theme ---
  const savedTheme = localStorage.getItem('theme');
  applyTheme(savedTheme ? savedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches);

  // --- Initial Render ---
  document.querySelector(`.category-btn[data-category="${currentCategory}"]`)?.classList.add('active-category');
  fetchAndRenderFiles(currentCategory);
  loadAdminData();
  
  // --- Bind Events ---
  els.themeToggle.addEventListener('click', toggleTheme);
  
  els.categoryButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('.category-btn');
    if (btn) {
      document.querySelector('.category-btn.active-category')?.classList.remove('active-category');
      btn.classList.add('active-category');
      currentCategory = btn.dataset.category;
      els.publishCategoryLabel.textContent = currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1);
      fetchAndRenderFiles(currentCategory, els.searchInput.value);
    }
  });

  els.searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      fetchAndRenderFiles(currentCategory, els.searchInput.value);
    }, 350); // Debounce API calls for a better experience
  });
  
  // Drag and Drop
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => els.dropzone.addEventListener(evt, e => {e.preventDefault(); e.stopPropagation();}, false));
  els.dropzone.addEventListener('drop', (e) => {
    els.inputFile.files = e.dataTransfer.files;
    handleFileSelection({ target: els.inputFile });
  });

  els.inputFile.addEventListener('change', handleFileSelection);
  els.formUpload.addEventListener('submit', handleUpload);

  // Modal and dynamically created element events
  els.deleteForm.addEventListener('submit', submitDeleteRequest);
  els.cancelDeleteBtn.addEventListener('click', hideDeleteModal);
  document.body.addEventListener('click', (e) => {
    const reqBtn = e.target.closest('.request-delete-btn');
    if (reqBtn) showDeleteModal(reqBtn.dataset.fileId, reqBtn.dataset.fileName);

    const adminBtn = e.target.closest('.admin-delete-btn');
    if (adminBtn) executeAdminDelete(adminBtn.dataset.fileId);
  });
});
