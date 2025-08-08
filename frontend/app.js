// Frontend for Notes Drive (Enhanced Version)
const API_BASE = 'https://script.google.com/macros/s/AKfycbwCg8HYQZqpA-M0NeRDjd1he29xRMtXsvaYoZACX2r_loUrfDmb8Y-6Xe1ktapO9vtR/exec'; // IMPORTANT: Replace with your deployed Apps Script URL

// --- DOM Elements ---
const els = {
  grid: document.getElementById('grid'),
  categoryButtons: document.getElementById('category-buttons'),
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
  // Admin Panel
  adminPanel: document.getElementById('admin-panel'),
  deletionRequestsList: document.getElementById('deletion-requests-list'),
  // Delete Modal
  deleteModal: document.getElementById('delete-modal'),
  deleteForm: document.getElementById('delete-form'),
  deleteFileName: document.getElementById('delete-file-name'),
  deleteReason: document.getElementById('delete-reason'),
  cancelDeleteBtn: document.getElementById('cancel-delete-btn'),
};

let currentCategory = 'documents';
let selectedFile = null;

// --- Utility Functions ---
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

// --- Core Functions ---

/** Generates the HTML for a single file card */
function card(file) {
  const isImg = (file.mimeType || '').startsWith('image/');
  const thumb = isImg ? file.thumbnailLink : 'https://cdn.jsdelivr.net/gh/tabler/tabler-icons@latest/icons/file.svg';
  const date = file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : '';
  return `
    <article class="group rounded-xl border bg-white p-4 shadow-sm hover:shadow-lg transition-all duration-300">
      <div class="aspect-video w-full overflow-hidden rounded-lg bg-slate-100">
        <img src="${thumb}" alt="${file.name}" class="h-full w-full object-cover object-center transition-transform group-hover:scale-105"/>
      </div>
      <div class="mt-3">
        <h3 class="line-clamp-2 font-semibold text-sm h-10">${file.name}</h3>
        <p class="text-xs text-slate-500 mt-1">${fmtBytes(file.size)} &bull; ${date}</p>
        <div class="mt-3 flex items-center gap-2">
          <a href="${file.webContentLink}" target="_blank" class="flex-1 text-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 transition">Download</a>
          <a href="${file.webViewLink}" target="_blank" class="flex-1 text-center rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-black transition">View</a>
        </div>
        <button data-file-id="${file.id}" data-file-name="${file.name}" class="request-delete-btn w-full mt-2 rounded-lg border border-red-200 text-red-600 px-3 py-1.5 text-xs font-medium hover:bg-red-50 transition">Request Deletion</button>
      </div>
    </article>
  `;
}

/** Fetches and displays files for the current category */
async function fetchFiles(category) {
  els.grid.innerHTML = Array(8).fill('<div class="h-64 animate-pulse rounded-xl bg-white/80"></div>').join('');
  try {
    const res = await fetch(`${API_BASE}?action=list&category=${category}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    
    if (!data.files || data.files.length === 0) {
      els.grid.innerHTML = `<div class="col-span-full rounded-xl border bg-white p-8 text-center text-slate-500">No files found in the "${category}" category.</div>`;
    } else {
      els.grid.innerHTML = data.files.map(card).join('');
    }
  } catch (e) {
    els.grid.innerHTML = `<div class="col-span-full rounded-xl border border-red-200 bg-red-50 p-6 text-red-700"><strong>Error:</strong> Failed to load files. ${e.message}</div>`;
    console.error('List error', e);
  }
}

/** Handles file selection for upload */
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
      <div class="flex-shrink-0 h-10 w-10 rounded-lg bg-slate-200 flex items-center justify-center">
        <svg class="h-6 w-6 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
      </div>
      <div>
        <p class="font-medium text-slate-800 truncate max-w-xs">${file.name}</p>
        <p class="text-xs text-slate-500">${fmtBytes(file.size)}</p>
      </div>
    </div>`;
  els.previewPanel.classList.remove('hidden');
  els.btnUpload.disabled = false;
  els.uploadStatus.textContent = '';
}

/** Handles the file upload process */
async function uploadFile(e) {
  e.preventDefault();
  if (!selectedFile) return toast('Please select a file to upload.', false);

  els.btnUpload.disabled = true;
  els.uploadStatus.textContent = 'Uploading...';

  const formData = new FormData();
  formData.append('action', 'upload');
  formData.append('publish', els.chkPublish.checked);
  formData.append('category', currentCategory);
  formData.append('filename', selectedFile.name);
  formData.append('file', selectedFile);

  try {
    const res = await fetch(API_BASE, { method: 'POST', body: selectedFile });
    const data = await res.json();

    if (!data.success) throw new Error(data.error);
    
    toast('File uploaded successfully!', true);
    await fetchFiles(currentCategory); // Refresh the list
    els.formUpload.reset();
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

// --- Admin Functions ---
async function checkAndLoadAdminPanel() {
  try {
    // We use a trick: try to fetch admin data. If it succeeds, user is admin.
    const res = await fetch(`${API_BASE}?action=getAdminData`);
    if (!res.ok) return; // Fails for non-admins, which is expected
    const data = await res.json();
    if (data.success) {
      els.adminPanel.classList.remove('hidden');
      renderAdminPanel(data.deletionRequests);
    }
  } catch (e) {
    // This will likely fail due to CORS or auth for non-admins, which is fine.
    console.log('Admin check failed (this is normal for non-admin users).');
  }
}

function renderAdminPanel(requests) {
  if (!requests || requests.length === 0) {
    els.deletionRequestsList.innerHTML = '<p class="text-slate-500">No pending requests.</p>';
    return;
  }
  els.deletionRequestsList.innerHTML = requests.map(req => `
    <div class="p-3 rounded-lg bg-amber-100/60 border border-amber-200 flex items-center justify-between">
      <div>
        <p class="font-semibold text-amber-900">${req.fileName}</p>
        <p class="text-xs text-amber-700 italic">Reason: "${req.reason}"</p>
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'executeDelete', fileId: fileId })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    toast('File deleted successfully.', true);
    fetchFiles(currentCategory); // Refresh file list
    checkAndLoadAdminPanel(); // Refresh admin panel
  } catch (e) {
    toast(`Deletion failed: ${e.message}`, false);
    console.error('Admin delete error', e);
  }
}


// --- Deletion Request Modal Functions ---
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'requestDelete', fileId, reason })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    toast('Deletion request submitted for review.', true);
    closeDeleteModal();
  } catch (e) {
    toast(`Request failed: ${e.message}`, false);
    console.error('Delete request error', e);
  }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
  // Initial file fetch
  fetchFiles(currentCategory);
  checkAndLoadAdminPanel();

  // Category switching
  els.categoryButtons.addEventListener('click', (e) => {
    if (e.target.matches('.category-btn')) {
      document.querySelector('.category-btn.active-category').classList.remove('active-category');
      e.target.classList.add('active-category');
      currentCategory = e.target.dataset.category;
      els.publishCategoryLabel.textContent = currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1);
      fetchFiles(currentCategory);
    }
  });

  // File upload
  els.inputFile.addEventListener('change', handleFileSelect);
  els.formUpload.addEventListener('submit', uploadFile);

  // Drag and drop
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
    els.dropzone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
  });
  els.dropzone.addEventListener('drop', (e) => {
    els.inputFile.files = e.dataTransfer.files;
    handleFileSelect({ target: els.inputFile }); // Manually trigger handler
  });

  // Dynamic event listeners for buttons on cards/admin panel
  document.body.addEventListener('click', (e) => {
    if (e.target.matches('.request-delete-btn')) {
      const { fileId, fileName } = e.target.dataset;
      openDeleteModal(fileId, fileName);
    }
    if (e.target.matches('.admin-delete-btn')) {
      executeAdminDelete(e.target.dataset.fileId);
    }
  });

  // Delete modal listeners
  els.deleteForm.addEventListener('submit', submitDeleteRequest);
  els.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
});
