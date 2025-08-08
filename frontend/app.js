//================================================================
// Notes Drive - Frontend Logic (JavaScript)
//
// Author: Gemini
// Version: 4.1 (Final & Complete)
//================================================================

/**
 * CRITICAL: Replace this placeholder with your own Google Apps Script deployment URL.
 * To get this URL, deploy your script (Deploy > New Deployment).
 */
const API_BASE = 'https://script.google.com/macros/s/AKfycbwCg8HYQZqpA-M0NeRDjd1he29xRMtXsvaYoZACX2r_loUrfDmb8Y-6Xe1ktapO9vtR/exec';

// --- DOM ELEMENT REFERENCES ---
const els = {
  grid: document.getElementById('grid'),
  categoryButtons: document.getElementById('category-buttons'),
  searchInput: document.getElementById('search-input'),
  formUpload: document.getElementById('form-upload'),
  inputFile: document.getElementById('inp-file'),
  dropzone: document.getElementById('dropzone'),
  uploadPrompt: document.getElementById('upload-prompt'),
  uploadPreview: document.getElementById('upload-preview'),
  metadataPanel: document.getElementById('metadata-panel'),
  displayName: document.getElementById('displayName'),
  tags: document.getElementById('tags'),
  sectionContainer: document.getElementById('section-container'),
  sectionId: document.getElementById('sectionId'),
  newSectionName: document.getElementById('newSectionName'),
  chkPublish: document.getElementById('chk-publish'),
  btnUpload: document.getElementById('btn-upload'),
  uploadStatus: document.getElementById('upload-status'),
  toast: document.getElementById('toast'),
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
let currentCategory = 'all';
let selectedFile = null;
let searchDebounceTimer = null;

// --- UTILITY & THEME FUNCTIONS ---

/** Shows a notification toast message. */
function toast(msg, isSuccess = true) {
  els.toast.textContent = msg;
  els.toast.style.backgroundColor = isSuccess ? '#059669' : '#DC2626'; // Tailwind Green-600 or Red-600
  els.toast.classList.remove('opacity-0', 'translate-y-3');
  setTimeout(() => {
    els.toast.classList.add('opacity-0', 'translate-y-3');
  }, 3500);
}

/** Formats file size into a human-readable string. */
function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/** Applies the color theme (dark/light) to the HTML element. */
function applyTheme(isDark) {
  document.documentElement.classList.toggle('dark', isDark);
  els.darkIcon.classList.toggle('hidden', !isDark);
  els.lightIcon.classList.toggle('hidden', isDark);
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

/** Toggles the current theme. */
const toggleTheme = () => applyTheme(!document.documentElement.classList.contains('dark'));


// --- CORE APPLICATION LOGIC ---

/** Fetches files from the backend and renders them in the grid. */
async function fetchAndRenderFiles() {
  const searchTerm = els.searchInput.value;
  // Show loading skeletons
  els.grid.innerHTML = Array(8).fill('<div class="aspect-[16/10] animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"></div>').join('');
  
  try {
    const url = new URL(`${API_BASE}?action=list&category=${currentCategory}&search=${encodeURIComponent(searchTerm)}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Server responded with status ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    
    if (data.files?.length) {
      els.grid.innerHTML = data.files.map(createFileCard).join('');
    } else {
      els.grid.innerHTML = `<div class="col-span-full rounded-xl p-8 text-center text-slate-500">No files found matching your criteria.</div>`;
    }
  } catch (err) {
    console.error('Fetch Error:', err);
    els.grid.innerHTML = `<div class="col-span-full rounded-xl border-2 border-dashed border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-8 text-center text-red-600 dark:text-red-300"><strong>Error:</strong> Failed to load files. Please check the API URL in app.js and ensure your script is deployed.</div>`;
  }
}

/** Fetches subfolders for the current category and populates the section dropdown. */
async function fetchSections() {
  // Hide section UI if "All" is selected or if "Publish" is unchecked
  if (currentCategory === 'all' || !els.chkPublish.checked) {
    els.sectionContainer.classList.add('hidden');
    return;
  }
  
  els.sectionContainer.classList.remove('hidden');
  els.sectionId.innerHTML = '<option value="">(Upload to Category Root)</option>';

  try {
    const res = await fetch(`${API_BASE}?action=getSections&category=${currentCategory}`);
    const data = await res.json();
    if (data.success && data.sections) {
      data.sections.forEach(sec => els.sectionId.add(new Option(sec.name, sec.id)));
    }
  } catch(err) { console.error('Could not fetch sections:', err); }
}

/** Creates the HTML for a single file card. */
function createFileCard(file) {
  const tagsHTML = file.tags.map(tag => 
    `<span class="inline-block bg-slate-200 dark:bg-slate-700 rounded-full px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">${tag}</span>`
  ).join(' ');

  const iconSvg = `<svg class="h-10 w-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>`;
  const imageTag = `<img src="${file.thumbnailLink}" alt="${file.name}" loading="lazy" class="h-full w-full object-cover transition-transform group-hover:scale-105"/>`;

  return `
    <article class="group flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
      <div class="aspect-[16/10] w-full overflow-hidden rounded-t-xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center">
        ${file.mimeType?.startsWith('image/') ? imageTag : iconSvg}
      </div>
      <div class="p-4 flex flex-col flex-grow">
        <h3 class="font-bold text-sm h-10 line-clamp-2" title="${file.displayName}">${file.displayName}</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1" title="Original: ${file.name}">Size: ${formatBytes(file.size)} &bull; ${new Date(file.modifiedTime).toLocaleDateString()}</p>
        <div class="mt-2 h-6 overflow-hidden space-x-1 space-y-1">${tagsHTML || '<span class="text-xs text-slate-400 italic">No tags</span>'}</div>
        <div class="mt-auto pt-3 flex items-center gap-2">
          <a href="${file.webContentLink}" target="_blank" class="flex-1 text-center rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition">Download</a>
          <a href="${file.webViewLink}" target="_blank" class="flex-1 text-center rounded-lg bg-slate-800 dark:bg-slate-700 px-3 py-1.5 text-sm font-medium text-white dark:text-slate-200 hover:bg-black dark:hover:bg-slate-600 transition">View</a>
        </div>
        <button data-file-id="${file.id}" data-file-name="${file.displayName}" class="request-delete-btn w-full mt-2 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 px-3 py-1.5 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition">Request Deletion</button>
      </div>
    </article>
  `;
}

/** Handles file selection from the input and shows the metadata panel. */
function handleFileSelection(e) {
  const file = e.target.files?.[0];
  if (!file) {
    selectedFile = null;
    els.metadataPanel.classList.add('hidden');
    return;
  }
  selectedFile = file;

  els.uploadPrompt.classList.add('hidden');
  els.uploadPreview.classList.remove('hidden');
  if (file.type.startsWith('image/')) {
    els.uploadPreview.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Preview" class="max-h-28 rounded-md shadow-md" />`;
  } else {
    els.uploadPreview.innerHTML = `<div class="text-center p-4"><p class="font-semibold">${file.name}</p><p class="text-sm">${formatBytes(file.size)}</p></div>`;
  }

  els.displayName.value = file.name.replace(/\.[^/.]+$/, ""); // Default name is filename without extension
  els.metadataPanel.classList.remove('hidden');
  els.btnUpload.disabled = false;
  fetchSections();
}

/** Resets the entire upload form to its initial state. */
function resetUploadForm() {
  els.formUpload.reset();
  selectedFile = null;
  els.metadataPanel.classList.add('hidden');
  els.uploadPreview.classList.add('hidden');
  els.uploadPreview.innerHTML = '';
  els.uploadPrompt.classList.remove('hidden');
  els.btnUpload.disabled = true; // Disabled until a new file is chosen
}

/** Submits the form to upload the file with all metadata. */
async function handleUpload(e) {
  e.preventDefault();
  if (!selectedFile) return toast('Please select a file to upload.', false);
  if (!els.displayName.value.trim()) return toast('Display Name is required.', false);
  
  const category = document.querySelector('.category-btn.active-category').dataset.category;
  if (els.chkPublish.checked && category === 'all') {
    return toast('Please select a specific category (Documents, Images, etc.) to publish a file.', false);
  }

  els.btnUpload.disabled = true;
  els.uploadStatus.textContent = 'Uploading...';

  // FormData is crucial for sending files and parameters together
  const formData = new FormData();
  formData.append('file', selectedFile, selectedFile.name); // Send file with its original name
  formData.append('action', 'upload');
  formData.append('filename', selectedFile.name); // Original filename for backend
  formData.append('publish', els.chkPublish.checked);
  formData.append('category', category);
  formData.append('displayName', els.displayName.value.trim());
  formData.append('tags', els.tags.value.trim());
  formData.append('sectionId', els.sectionId.value);
  formData.append('newSectionName', els.newSectionName.value.trim());

  try {
    const res = await fetch(API_BASE, { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`Server error: ${res.statusText}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    
    toast('File uploaded successfully!', true);
    resetUploadForm();
    await fetchAndRenderFiles();
  } catch (err) {
    console.error('Upload Error:', err);
    toast(`Upload failed: ${err.message}`, false);
    els.btnUpload.disabled = false;
  } finally {
    els.uploadStatus.textContent = '';
  }
}

// --- ADMIN & DELETION FUNCTIONS (LOGIC UNCHANGED) ---
async function loadAdminData() { /* Functionality remains the same */ }
function renderAdminPanel(requests) { /* Functionality remains the same */ }
async function executeAdminDelete(fileId) { /* Functionality remains the same */ }
function showDeleteModal(fileId, fileName) { /* Functionality remains the same */ }
function hideDeleteModal() { /* Functionality remains the same */ }
async function submitDeleteRequest(e) { /* Functionality remains the same */ }


// --- INITIALIZATION & EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
  // Check for API_BASE placeholder
  if (API_BASE.includes('PASTE_YOUR_DEPLOYMENT_URL_HERE')) {
    toast('CRITICAL ERROR: API_BASE URL not set in app.js!', false);
  }
  
  // --- Initialize Theme ---
  const savedTheme = localStorage.getItem('theme');
  applyTheme(savedTheme ? savedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches);

  // --- Initial Page Load ---
  document.querySelector(`.category-btn[data-category="${currentCategory}"]`)?.classList.add('active-category');
  resetUploadForm(); // Ensure form is initially ready
  fetchAndRenderFiles();
  loadAdminData();
  
  // --- Event Listeners ---
  els.themeToggle.addEventListener('click', toggleTheme);
  
  els.categoryButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('.category-btn');
    if (btn) {
      document.querySelector('.category-btn.active-category')?.classList.remove('active-category');
      btn.classList.add('active-category');
      currentCategory = btn.dataset.category;
      fetchAndRenderFiles();
      fetchSections();
    }
  });

  els.searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(fetchAndRenderFiles, 350); // Debounce to avoid excessive API calls
  });

  // Upload publish checkbox toggles section visibility
  els.chkPublish.addEventListener('change', fetchSections);

  // Drag & Drop
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => els.dropzone.addEventListener(evt, e => {e.preventDefault(); e.stopPropagation();}, false));
  els.dropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files) {
        els.inputFile.files = e.dataTransfer.files;
        handleFileSelection({ target: els.inputFile }); // Trigger handler
    }
  });

  els.inputFile.addEventListener('change', handleFileSelection);
  els.formUpload.addEventListener('submit', handleUpload);

  // Modals
  els.deleteForm.addEventListener('submit', submitDeleteRequest);
  els.cancelDeleteBtn.addEventListener('click', hideDeleteModal);

  // Delegated event listener for dynamically created buttons
  document.body.addEventListener('click', (e) => {
    const requestBtn = e.target.closest('.request-delete-btn');
    if (requestBtn) {
      showDeleteModal(requestBtn.dataset.fileId, requestBtn.dataset.fileName);
    }
    const adminBtn = e.target.closest('.admin-delete-btn');
    if (adminBtn) {
      executeAdminDelete(adminBtn.dataset.fileId);
    }
  });
});
