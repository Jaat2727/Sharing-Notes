//================================================================
// Notes Drive - Enhanced Frontend Logic (JavaScript)
//
// Author: Gemini
// Version: 5.0 (Professional Two-Pane Explorer)
//================================================================

/**
 * CRITICAL: Replace this placeholder with your own Google Apps Script deployment URL.
 * To get this URL, deploy your script (Deploy > New Deployment).
 */
const API_BASE = 'https://script.google.com/macros/s/AKfycbwCg8HYQZqpA-M0NeRDjd1he29xRMtXsvaYoZACX2r_loUrfDmb8Y-6Xe1ktapO9vtR/exec';

// --- DOM ELEMENT REFERENCES ---
const els = {
  // File Browser
  grid: document.getElementById('grid'),
  categoryButtons: document.getElementById('category-buttons'),
  searchInput: document.getElementById('search-input'),
  
  // Tree View
  folderTreePane: document.getElementById('folder-tree-pane'),
  folderTree: document.getElementById('folder-tree'),
  toggleTreeView: document.getElementById('toggle-tree-view'),
  refreshTree: document.getElementById('refresh-tree'),
  currentFolderName: document.getElementById('current-folder-name'),
  currentFolderPath: document.getElementById('current-folder-path'),
  createFolderBtn: document.getElementById('create-folder-btn'),
  viewMode: document.getElementById('view-mode'),
  
  // Upload Form
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
  
  // Modals
  previewModal: document.getElementById('preview-modal'),
  previewTitle: document.getElementById('preview-title'),
  previewSubtitle: document.getElementById('preview-subtitle'),
  previewContent: document.getElementById('preview-content'),
  previewMetadata: document.getElementById('preview-metadata'),
  previewDownload: document.getElementById('preview-download'),
  previewView: document.getElementById('preview-view'),
  previewRename: document.getElementById('preview-rename'),
  previewMove: document.getElementById('preview-move'),
  previewDelete: document.getElementById('preview-delete'),
  closePreview: document.getElementById('close-preview'),
  
  createFolderModal: document.getElementById('create-folder-modal'),
  createFolderForm: document.getElementById('create-folder-form'),
  folderName: document.getElementById('folder-name'),
  cancelFolderBtn: document.getElementById('cancel-folder-btn'),
  
  deleteModal: document.getElementById('delete-modal'),
  deleteForm: document.getElementById('delete-form'),
  deleteFileName: document.getElementById('delete-file-name'),
  deleteReason: document.getElementById('delete-reason'),
  cancelDeleteBtn: document.getElementById('cancel-delete-btn'),
  
  // UI Elements
  toast: document.getElementById('toast'),
  adminPanel: document.getElementById('admin-panel'),
  deletionRequestsList: document.getElementById('deletion-requests-list'),
  themeToggle: document.getElementById('theme-toggle'),
  darkIcon: document.getElementById('theme-toggle-dark-icon'),
  lightIcon: document.getElementById('theme-toggle-light-icon'),
};

// --- APP STATE ---
let currentCategory = 'all';
let currentFolderId = null;
let currentFolderPath = [];
let selectedFile = null;
let selectedFiles = [];
let searchDebounceTimer = null;
let folderTree = {};
let isTreeViewVisible = true;
let viewMode = 'grid';
let currentPreviewFile = null;

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

/** Fetches and builds the folder tree structure. */
async function fetchFolderTree() {
  try {
    const res = await fetch(`${API_BASE}?action=getFolderTree&category=${currentCategory}`);
    const data = await res.json();
    if (data.success) {
      folderTree = data.tree;
      renderFolderTree();
    }
  } catch (err) {
    console.error('Error fetching folder tree:', err);
  }
}

/** Renders the folder tree in the left pane. */
function renderFolderTree() {
  if (!folderTree || Object.keys(folderTree).length === 0) {
    els.folderTree.innerHTML = '<div class="text-sm text-slate-500 dark:text-slate-400 italic">No folders found</div>';
    return;
  }

  let html = '';
  Object.entries(folderTree).forEach(([category, categoryData]) => {
    if (currentCategory !== 'all' && currentCategory !== category) return;
    
    const isExpanded = currentCategory === category || currentCategory === 'all';
    html += `
      <div class="folder-item" data-folder-id="${categoryData.id}" data-category="${category}">
        <div class="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition ${
          currentFolderId === categoryData.id ? 'bg-blue-100 dark:bg-blue-900/30' : ''
        }">
          <button class="expand-btn w-4 h-4 flex items-center justify-center" data-expanded="${isExpanded}">
            <svg class="h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
          <svg class="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25H16.06a4.5 4.5 0 0 1-4.06-2.56Z" />
          </svg>
          <span class="text-sm font-medium">${categoryData.name}</span>
          <span class="text-xs text-slate-500 ml-auto">${categoryData.fileCount}</span>
        </div>
        <div class="folder-children ml-6 ${isExpanded ? '' : 'hidden'}">
          ${renderFolderChildren(categoryData.children, category)}
        </div>
      </div>
    `;
  });
  
  els.folderTree.innerHTML = html;
}

/** Recursively renders folder children. */
function renderFolderChildren(children, category) {
  if (!children || children.length === 0) return '';
  
  return children.map(folder => {
    const isExpanded = false; // Start collapsed
    return `
      <div class="folder-item" data-folder-id="${folder.id}" data-category="${category}">
        <div class="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition ${
          currentFolderId === folder.id ? 'bg-blue-100 dark:bg-blue-900/30' : ''
        }">
          ${folder.children.length > 0 ? `
            <button class="expand-btn w-4 h-4 flex items-center justify-center" data-expanded="${isExpanded}">
              <svg class="h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          ` : '<div class="w-4 h-4"></div>'}
          <svg class="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25H16.06a4.5 4.5 0 0 1-4.06-2.56Z" />
          </svg>
          <span class="text-sm">${folder.name}</span>
          <span class="text-xs text-slate-500 ml-auto">${folder.fileCount}</span>
        </div>
        <div class="folder-children ml-6 ${isExpanded ? '' : 'hidden'}">
          ${renderFolderChildren(folder.children, category)}
        </div>
      </div>
    `;
  }).join('');
}

/** Fetches files from the backend and renders them in the grid. */
async function fetchAndRenderFiles() {
  const searchTerm = els.searchInput.value;
  
  // Update current folder display
  updateCurrentFolderDisplay();
  
  // Show loading skeletons
  const skeletonCount = viewMode === 'list' ? 6 : 8;
  const skeletonClass = viewMode === 'list' ? 'h-16' : 'aspect-[16/10]';
  els.grid.innerHTML = Array(skeletonCount).fill(`<div class="${skeletonClass} animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"></div>`).join('');
  
  try {
    let url;
    if (currentFolderId) {
      // Fetch files from specific folder
      url = new URL(`${API_BASE}?action=list&folderId=${currentFolderId}&search=${encodeURIComponent(searchTerm)}`);
    } else {
      // Fetch files from category
      url = new URL(`${API_BASE}?action=list&category=${currentCategory}&search=${encodeURIComponent(searchTerm)}`);
    }
    
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Server responded with status ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    
    if (data.files?.length) {
      els.grid.className = getGridClasses();
      els.grid.innerHTML = data.files.map(file => createFileCard(file, viewMode)).join('');
    } else {
      els.grid.innerHTML = `<div class="col-span-full rounded-xl p-8 text-center text-slate-500">No files found matching your criteria.</div>`;
    }
  } catch (err) {
    console.error('Fetch Error:', err);
    els.grid.innerHTML = `<div class="col-span-full rounded-xl border-2 border-dashed border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-8 text-center text-red-600 dark:text-red-300"><strong>Error:</strong> Failed to load files. Please check the API URL in app.js and ensure your script is deployed.</div>`;
  }
}

/** Updates the current folder display information. */
function updateCurrentFolderDisplay() {
  if (currentFolderId) {
    // Find the folder name from the tree
    const folderInfo = findFolderInTree(currentFolderId);
    els.currentFolderName.textContent = folderInfo?.name || 'Unknown Folder';
    els.currentFolderPath.textContent = buildFolderPath(folderInfo);
  } else if (currentCategory === 'all') {
    els.currentFolderName.textContent = 'All Files';
    els.currentFolderPath.textContent = 'Showing all files across categories';
  } else {
    els.currentFolderName.textContent = currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1);
    els.currentFolderPath.textContent = `Category: ${currentCategory}`;
  }
}

/** Finds folder information in the tree structure. */
function findFolderInTree(folderId) {
  for (const [category, categoryData] of Object.entries(folderTree)) {
    if (categoryData.id === folderId) {
      return { name: categoryData.name, category, path: [categoryData.name] };
    }
    const found = findFolderInChildren(categoryData.children, folderId, [categoryData.name]);
    if (found) return found;
  }
  return null;
}

/** Recursively searches for folder in children. */
function findFolderInChildren(children, folderId, path) {
  if (!children) return null;
  
  for (const folder of children) {
    if (folder.id === folderId) {
      return { name: folder.name, path: [...path, folder.name] };
    }
    const found = findFolderInChildren(folder.children, folderId, [...path, folder.name]);
    if (found) return found;
  }
  return null;
}

/** Builds a readable folder path. */
function buildFolderPath(folderInfo) {
  if (!folderInfo) return '';
  return folderInfo.path.join(' > ');
}

/** Returns appropriate grid classes based on view mode. */
function getGridClasses() {
  if (viewMode === 'list') {
    return 'space-y-2';
  }
  return 'grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
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

/** Creates the HTML for a single file card with support for different view modes. */
function createFileCard(file, mode = 'grid') {
  const tagsHTML = file.tags.map(tag => 
    `<span class="inline-block bg-slate-200 dark:bg-slate-700 rounded-full px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">${tag}</span>`
  ).join(' ');

  const iconSvg = `<svg class="h-10 w-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>`;
  const imageTag = `<img src="${file.thumbnailLink}" alt="${file.name}" loading="lazy" class="h-full w-full object-cover transition-transform group-hover:scale-105"/>`;

  if (mode === 'list') {
    return `
      <div class="group flex items-center gap-4 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:shadow-md transition-all cursor-pointer" data-file-id="${file.id}">
        <div class="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center">
          ${file.mimeType?.startsWith('image/') ? imageTag.replace('h-full w-full', 'h-12 w-12') : iconSvg.replace('h-10 w-10', 'h-6 w-6')}
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold text-sm truncate" title="${file.displayName}">${file.displayName}</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">${formatBytes(file.size)} &bull; ${new Date(file.modifiedTime).toLocaleDateString()}</p>
        </div>
        <div class="flex items-center gap-2">
          <button class="preview-btn p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition" data-file='${JSON.stringify(file).replace(/'/g, "&apos;")}'>
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
          </button>
          <a href="${file.webContentLink}" target="_blank" class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
          </a>
        </div>
      </div>
    `;
  }

  // Grid view (default)
  return `
    <article class="group flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer" data-file-id="${file.id}">
      <div class="aspect-[16/10] w-full overflow-hidden rounded-t-xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center preview-trigger" data-file='${JSON.stringify(file).replace(/'/g, "&apos;")}'>
        ${file.mimeType?.startsWith('image/') ? imageTag : iconSvg}
      </div>
      <div class="p-4 flex flex-col flex-grow">
        <h3 class="font-bold text-sm h-10 line-clamp-2" title="${file.displayName}">${file.displayName}</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1" title="Original: ${file.name}">Size: ${formatBytes(file.size)} &bull; ${new Date(file.modifiedTime).toLocaleDateString()}</p>
        <div class="mt-2 h-6 overflow-hidden space-x-1 space-y-1">${tagsHTML || '<span class="text-xs text-slate-400 italic">No tags</span>'}</div>
        <div class="mt-auto pt-3 flex items-center gap-2">
          <button class="preview-btn flex-1 text-center rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition" data-file='${JSON.stringify(file).replace(/'/g, "&apos;")}'>
            Preview
          </button>
          <a href="${file.webContentLink}" target="_blank" class="flex-1 text-center rounded-lg bg-slate-800 dark:bg-slate-700 px-3 py-1.5 text-sm font-medium text-white dark:text-slate-200 hover:bg-black dark:hover:bg-slate-600 transition" onclick="event.stopPropagation()">
            Download
          </a>
        </div>
        <button data-file-id="${file.id}" data-file-name="${file.displayName}" class="request-delete-btn w-full mt-2 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 px-3 py-1.5 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition" onclick="event.stopPropagation()">
          Request Deletion
        </button>
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
  
  // File validation
  const maxSize = 100 * 1024 * 1024; // 100MB limit
  if (file.size > maxSize) {
    toast(`File too large! Maximum size is ${formatBytes(maxSize)}. Selected file is ${formatBytes(file.size)}.`, false);
    resetUploadForm();
    return;
  }
  
  // Check for potentially problematic file types
  const dangerousTypes = ['application/x-executable', 'application/x-msdownload', 'application/x-msdos-program'];
  if (dangerousTypes.includes(file.type)) {
    toast('This file type is not allowed for security reasons.', false);
    resetUploadForm();
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
  const spinner = document.getElementById('upload-spinner');
  const btnText = document.getElementById('upload-btn-text');
  if (spinner) spinner.classList.remove('hidden');
  if (btnText) btnText.textContent = 'Uploading...';
  els.uploadStatus.textContent = 'Preparing upload...';

  try {
    // Enhanced FormData with better file handling
    const formData = new FormData();
    
    // Add file first with proper naming
    formData.append('file', selectedFile, selectedFile.name);
    
    // Add all other parameters
    formData.append('action', 'upload');
    formData.append('filename', selectedFile.name);
    formData.append('publish', els.chkPublish.checked ? 'true' : 'false');
    formData.append('category', category);
    formData.append('displayName', els.displayName.value.trim());
    formData.append('tags', els.tags.value.trim());
    formData.append('sectionId', els.sectionId.value || '');
    formData.append('newSectionName', els.newSectionName.value.trim() || '');
    
    // Debug logging
    console.log('FormData contents:');
    for (let [key, value] of formData.entries()) {
      console.log(`${key}:`, value instanceof File ? `File(${value.name}, ${value.size} bytes)` : value);
    }

    console.log('Uploading file:', {
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type,
      category: category,
      publish: els.chkPublish.checked
    });

    els.uploadStatus.textContent = 'Uploading file...';

    const res = await fetch(API_BASE, { 
      method: 'POST', 
      body: formData,
      // Don't set Content-Type header - let browser set it with boundary for multipart/form-data
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Server error (${res.status}): ${errorText}`);
    }
    
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    
    els.uploadStatus.textContent = 'Upload complete! Refreshing...';
    toast('File uploaded successfully!', true);
    resetUploadForm();
    
    // Refresh the UI to show the new file
    await Promise.all([
      fetchFolderTree(),
      fetchAndRenderFiles()
    ]);
    
  } catch (err) {
    console.error('Upload Error:', err);
    toast(`Upload failed: ${err.message}`, false);
  } finally {
    els.btnUpload.disabled = false;
    const spinner = document.getElementById('upload-spinner');
    const btnText = document.getElementById('upload-btn-text');
    if (spinner) spinner.classList.add('hidden');
    if (btnText) btnText.textContent = 'Upload Now';
    els.uploadStatus.textContent = '';
  }
}

// --- ENHANCED PREVIEW & MODAL FUNCTIONS ---

/** Shows the enhanced file preview modal. */
function showFilePreview(file) {
  currentPreviewFile = file;
  
  // Update modal header
  els.previewTitle.textContent = file.displayName;
  els.previewSubtitle.textContent = `${formatBytes(file.size)} • ${new Date(file.modifiedTime).toLocaleDateString()}`;
  
  // Update action buttons
  els.previewDownload.href = file.webContentLink;
  els.previewView.href = file.webViewLink;
  
  // Render preview content
  renderPreviewContent(file);
  
  // Render metadata
  renderPreviewMetadata(file);
  
  // Show modal
  els.previewModal.classList.remove('hidden');
  els.previewModal.classList.add('flex');
}

/** Renders the preview content based on file type. */
function renderPreviewContent(file) {
  const { mimeType, thumbnailLink, webViewLink, name } = file;
  
  if (mimeType?.startsWith('image/')) {
    els.previewContent.innerHTML = `
      <img src="${thumbnailLink}" alt="${name}" class="max-w-full max-h-full object-contain rounded-lg shadow-lg" 
           onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE5LjUgMTQuMjVWMTEuNjI1QTMuMzc1IDMuMzc1IDAgMCAwIDE2LjEyNSA4LjI1SDE0LjYyNUExLjEyNSAxLjEyNSAwIDAgMSAxMy41IDcuMTI1VjUuNjI1QTMuMzc1IDMuMzc1IDAgMCAwIDEwLjEyNSAyLjI1SDguMjVNOC4yNSAxNUgxNS43NU04LjI1IDE4SDEyTTEwLjUgMi4yNUg1LjYyNUM0Ljk5NiAyLjI1IDQuNSAyLjc0NiA0LjUgMy4zNzVWMjAuNjI1QzQuNSAyMS4yNTQgNC45OTYgMjEuNzUgNS42MjUgMjEuNzVIMTguMzc1QzE5LjAwNCAyMS43NSAxOS41IDIxLjI1NCAxOS41IDIwLjYyNVYxMS4yNUE5IDkgMCAwIDAgMTAuNSAyLjI1WiIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+Cg=='; this.alt='Preview not available';" />
    `;
  } else if (mimeType?.includes('pdf')) {
    els.previewContent.innerHTML = `
      <div class="w-full h-full flex flex-col items-center justify-center text-center">
        <svg class="h-16 w-16 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 18.75h-3.5a3.375 3.375 0 01-3.375-3.375V8.25m0 0V5.625c0-1.036.84-1.875 1.875-1.875h3.5c1.036 0 1.875.84 1.875 1.875v16.5A3.375 3.375 0 0116.125 22.5z" />
        </svg>
        <h3 class="text-lg font-semibold mb-2">PDF Document</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Click "View in Drive" to open this PDF</p>
        <a href="${webViewLink}" target="_blank" class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
          Open PDF
        </a>
      </div>
    `;
  } else {
    els.previewContent.innerHTML = `
      <div class="w-full h-full flex flex-col items-center justify-center text-center">
        <svg class="h-16 w-16 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <h3 class="text-lg font-semibold mb-2">${name}</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Preview not available for this file type</p>
        <div class="flex gap-2">
          <a href="${webViewLink}" target="_blank" class="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition">
            View in Drive
          </a>
          <a href="${file.webContentLink}" target="_blank" class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">
            Download
          </a>
        </div>
      </div>
    `;
  }
}

/** Renders the file metadata in the preview sidebar. */
function renderPreviewMetadata(file) {
  const tagsHTML = file.tags.length > 0 
    ? file.tags.map(tag => `<span class="inline-block bg-slate-200 dark:bg-slate-700 rounded-full px-2 py-1 text-xs font-medium">${tag}</span>`).join(' ')
    : '<span class="text-sm text-slate-500 italic">No tags</span>';

  els.previewMetadata.innerHTML = `
    <div>
      <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Display Name</label>
      <p class="text-sm text-slate-900 dark:text-white">${file.displayName}</p>
    </div>
    <div>
      <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Original Name</label>
      <p class="text-sm text-slate-600 dark:text-slate-400">${file.name}</p>
    </div>
    <div>
      <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">File Size</label>
      <p class="text-sm text-slate-900 dark:text-white">${formatBytes(file.size)}</p>
    </div>
    <div>
      <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">File Type</label>
      <p class="text-sm text-slate-900 dark:text-white">${file.mimeType}</p>
    </div>
    <div>
      <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Modified</label>
      <p class="text-sm text-slate-900 dark:text-white">${new Date(file.modifiedTime).toLocaleString()}</p>
    </div>
    <div>
      <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tags</label>
      <div class="space-x-1 space-y-1">${tagsHTML}</div>
    </div>
  `;
}

/** Hides the file preview modal. */
function hideFilePreview() {
  els.previewModal.classList.add('hidden');
  els.previewModal.classList.remove('flex');
  currentPreviewFile = null;
}

/** Shows the create folder modal. */
function showCreateFolderModal() {
  els.createFolderModal.classList.remove('hidden');
  els.createFolderModal.classList.add('flex');
  els.folderName.focus();
}

/** Hides the create folder modal. */
function hideCreateFolderModal() {
  els.createFolderModal.classList.add('hidden');
  els.createFolderModal.classList.remove('flex');
  els.folderName.value = '';
}

/** Creates a new folder. */
async function createNewFolder(e) {
  e.preventDefault();
  const folderName = els.folderName.value.trim();
  if (!folderName) return;

  try {
    const data = {
      action: 'createFolder',
      folderName: folderName,
      category: currentCategory === 'all' ? 'documents' : currentCategory,
      parentFolderId: currentFolderId
    };

    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await res.json();
    if (result.success) {
      toast('Folder created successfully!', true);
      hideCreateFolderModal();
      await fetchFolderTree();
      await fetchAndRenderFiles();
    } else {
      throw new Error(result.error);
    }
  } catch (err) {
    console.error('Create folder error:', err);
    toast(`Failed to create folder: ${err.message}`, false);
  }
}

/** Toggles the tree view visibility. */
function toggleTreeView() {
  isTreeViewVisible = !isTreeViewVisible;
  els.folderTreePane.classList.toggle('hidden', !isTreeViewVisible);
  els.toggleTreeView.textContent = isTreeViewVisible ? 'Hide Tree' : 'Show Tree';
}

/** Changes the view mode between grid and list. */
function changeViewMode(newMode) {
  viewMode = newMode;
  els.viewMode.value = viewMode;
  fetchAndRenderFiles();
}

// --- ADMIN & DELETION FUNCTIONS ---

async function loadAdminData() {
  try {
    const res = await fetch(`${API_BASE}?action=getAdminData`);
    const data = await res.json();
    if (data.success) {
      renderAdminPanel(data.deletionRequests);
    }
  } catch (err) {
    console.error('Admin data error:', err);
  }
}

function renderAdminPanel(requests) {
  if (!requests || requests.length === 0) {
    els.adminPanel.classList.add('hidden');
    return;
  }
  
  els.adminPanel.classList.remove('hidden');
  els.deletionRequestsList.innerHTML = requests.map(req => `
    <div class="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-amber-200 dark:border-amber-800">
      <div class="flex-1">
        <p class="font-medium text-sm">${req.fileName}</p>
        <p class="text-xs text-slate-500 dark:text-slate-400">${req.reason}</p>
        <p class="text-xs text-slate-400">${new Date(req.timestamp).toLocaleString()}</p>
      </div>
      <button class="admin-delete-btn ml-4 rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 transition" data-file-id="${req.fileId}">
        Delete
      </button>
    </div>
  `).join('');
}

async function executeAdminDelete(fileId) {
  if (!confirm('Are you sure you want to permanently delete this file?')) return;
  
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'executeDelete', fileId })
    });
    
    const data = await res.json();
    if (data.success) {
      toast('File deleted successfully!', true);
      await loadAdminData();
      await fetchAndRenderFiles();
    } else {
      throw new Error(data.error);
    }
  } catch (err) {
    console.error('Delete error:', err);
    toast(`Delete failed: ${err.message}`, false);
  }
}

function showDeleteModal(fileId, fileName) {
  els.deleteFileName.textContent = fileName;
  els.deleteForm.dataset.fileId = fileId;
  els.deleteModal.classList.remove('hidden');
  els.deleteModal.classList.add('flex');
  els.deleteReason.focus();
}

function hideDeleteModal() {
  els.deleteModal.classList.add('hidden');
  els.deleteModal.classList.remove('flex');
  els.deleteReason.value = '';
  delete els.deleteForm.dataset.fileId;
}

async function submitDeleteRequest(e) {
  e.preventDefault();
  const fileId = els.deleteForm.dataset.fileId;
  const reason = els.deleteReason.value.trim();
  
  if (!reason) {
    toast('Please provide a reason for deletion.', false);
    return;
  }
  
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'requestDelete', fileId, reason })
    });
    
    const data = await res.json();
    if (data.success) {
      toast('Deletion request submitted successfully!', true);
      hideDeleteModal();
    } else {
      throw new Error(data.error);
    }
  } catch (err) {
    console.error('Delete request error:', err);
    toast(`Request failed: ${err.message}`, false);
  }
}


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
  resetUploadForm();
  fetchFolderTree();
  fetchAndRenderFiles();
  loadAdminData();
  
  // --- Core Event Listeners ---
  els.themeToggle.addEventListener('click', toggleTheme);
  
  // Category selection
  els.categoryButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('.category-btn');
    if (btn) {
      document.querySelector('.category-btn.active-category')?.classList.remove('active-category');
      btn.classList.add('active-category');
      currentCategory = btn.dataset.category;
      currentFolderId = null; // Reset folder selection
      fetchFolderTree();
      fetchAndRenderFiles();
      fetchSections();
    }
  });

  // Search with debouncing
  els.searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(fetchAndRenderFiles, 350);
  });

  // --- Tree View Event Listeners ---
  els.toggleTreeView.addEventListener('click', toggleTreeView);
  els.refreshTree.addEventListener('click', fetchFolderTree);
  els.createFolderBtn.addEventListener('click', showCreateFolderModal);
  els.viewMode.addEventListener('change', (e) => changeViewMode(e.target.value));

  // Folder tree navigation (delegated)
  els.folderTree.addEventListener('click', (e) => {
    const folderItem = e.target.closest('.folder-item');
    const expandBtn = e.target.closest('.expand-btn');
    
    if (expandBtn) {
      // Toggle folder expansion
      e.stopPropagation();
      const isExpanded = expandBtn.dataset.expanded === 'true';
      const children = folderItem.querySelector('.folder-children');
      const icon = expandBtn.querySelector('svg');
      
      if (children && icon) {
        expandBtn.dataset.expanded = !isExpanded;
        children.classList.toggle('hidden', isExpanded);
        icon.classList.toggle('rotate-90', !isExpanded);
      }
    } else if (folderItem) {
      // Select folder
      e.stopPropagation();
      
      // Remove previous selection
      document.querySelectorAll('.folder-item > div').forEach(div => 
        div.classList.remove('bg-blue-100', 'dark:bg-blue-900/30')
      );
      
      // Add selection to clicked folder
      const folderDiv = folderItem.querySelector('div');
      if (folderDiv) {
        folderDiv.classList.add('bg-blue-100', 'dark:bg-blue-900/30');
      }
      
      // Update current selection
      currentFolderId = folderItem.dataset.folderId;
      currentCategory = folderItem.dataset.category;
      
      console.log('Folder selected:', { currentFolderId, currentCategory });
      
      // Update category button if needed
      if (currentCategory) {
        document.querySelector('.category-btn.active-category')?.classList.remove('active-category');
        const categoryBtn = document.querySelector(`[data-category="${currentCategory}"]`);
        if (categoryBtn) {
          categoryBtn.classList.add('active-category');
        }
      }
      
      // Fetch files for selected folder
      fetchAndRenderFiles();
    }
  });

  // --- Modal Event Listeners ---
  
  // Preview Modal
  els.closePreview.addEventListener('click', hideFilePreview);
  els.previewModal.addEventListener('click', (e) => {
    if (e.target === els.previewModal) hideFilePreview();
  });
  
  // Preview action buttons
  els.previewRename.addEventListener('click', () => {
    if (currentPreviewFile) {
      const newName = prompt('Enter new display name:', currentPreviewFile.displayName);
      if (newName && newName !== currentPreviewFile.displayName) {
        renameFile(currentPreviewFile.id, newName);
      }
    }
  });
  
  els.previewMove.addEventListener('click', () => {
    if (currentPreviewFile) {
      showMoveFileModal(currentPreviewFile);
    }
  });
  
  els.previewDelete.addEventListener('click', () => {
    if (currentPreviewFile) {
      hideFilePreview();
      showDeleteModal(currentPreviewFile.id, currentPreviewFile.displayName);
    }
  });
  
  // Create Folder Modal
  els.createFolderForm.addEventListener('submit', createNewFolder);
  els.cancelFolderBtn.addEventListener('click', hideCreateFolderModal);
  els.createFolderModal.addEventListener('click', (e) => {
    if (e.target === els.createFolderModal) hideCreateFolderModal();
  });
  
  // Delete Modal
  els.deleteForm.addEventListener('submit', submitDeleteRequest);
  els.cancelDeleteBtn.addEventListener('click', hideDeleteModal);
  els.deleteModal.addEventListener('click', (e) => {
    if (e.target === els.deleteModal) hideDeleteModal();
  });

  // --- Upload Form Event Listeners ---
  els.chkPublish.addEventListener('change', fetchSections);
  els.inputFile.addEventListener('change', handleFileSelection);
  els.formUpload.addEventListener('submit', handleUpload);

  // Enhanced Drag & Drop with multiple file support
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => 
    els.dropzone.addEventListener(evt, e => {e.preventDefault(); e.stopPropagation();}, false)
  );
  
  els.dropzone.addEventListener('dragover', () => {
    els.dropzone.classList.add('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
  });
  
  els.dropzone.addEventListener('dragleave', () => {
    els.dropzone.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
  });
  
  els.dropzone.addEventListener('drop', (e) => {
    els.dropzone.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
    if (e.dataTransfer.files?.length > 0) {
      if (e.dataTransfer.files.length === 1) {
        els.inputFile.files = e.dataTransfer.files;
        handleFileSelection({ target: els.inputFile });
      } else {
        // Multiple files - show notification for future enhancement
        toast(`${e.dataTransfer.files.length} files selected. Multi-file upload coming soon!`, false);
      }
    }
  });

  // --- Delegated Event Listeners for Dynamic Content ---
  document.body.addEventListener('click', (e) => {
    // File preview triggers
    const previewBtn = e.target.closest('.preview-btn');
    const previewTrigger = e.target.closest('.preview-trigger');
    
    if (previewBtn || previewTrigger) {
      e.preventDefault();
      e.stopPropagation();
      const fileData = (previewBtn || previewTrigger).dataset.file;
      if (fileData) {
        try {
          const file = JSON.parse(fileData.replace(/&apos;/g, "'"));
          showFilePreview(file);
        } catch (err) {
          console.error('Error parsing file data:', err);
          toast('Error opening file preview', false);
        }
      }
    }
    
    // File card clicks (for grid view)
    const fileCard = e.target.closest('[data-file-id]');
    if (fileCard && !e.target.closest('button') && !e.target.closest('a')) {
      const fileData = fileCard.querySelector('.preview-trigger, .preview-btn')?.dataset.file;
      if (fileData) {
        try {
          const file = JSON.parse(fileData.replace(/&apos;/g, "'"));
          showFilePreview(file);
        } catch (err) {
          console.error('Error parsing file data:', err);
        }
      }
    }
    
    // Delete request buttons
    const requestBtn = e.target.closest('.request-delete-btn');
    if (requestBtn) {
      e.stopPropagation();
      showDeleteModal(requestBtn.dataset.fileId, requestBtn.dataset.fileName);
    }
    
    // Admin delete buttons
    const adminBtn = e.target.closest('.admin-delete-btn');
    if (adminBtn) {
      executeAdminDelete(adminBtn.dataset.fileId);
    }
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // ESC key closes modals
    if (e.key === 'Escape') {
      if (!els.previewModal.classList.contains('hidden')) {
        hideFilePreview();
      } else if (!els.createFolderModal.classList.contains('hidden')) {
        hideCreateFolderModal();
      } else if (!els.deleteModal.classList.contains('hidden')) {
        hideDeleteModal();
      }
    }
    
    // Ctrl/Cmd + K focuses search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      els.searchInput.focus();
    }
  });
});

// --- ADDITIONAL HELPER FUNCTIONS ---

/** Renames a file's display name. */
async function renameFile(fileId, newDisplayName) {
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'renameFile', 
        fileId, 
        newDisplayName 
      })
    });
    
    const data = await res.json();
    if (data.success) {
      toast('File renamed successfully!', true);
      if (currentPreviewFile && currentPreviewFile.id === fileId) {
        currentPreviewFile.displayName = newDisplayName;
        els.previewTitle.textContent = newDisplayName;
        renderPreviewMetadata(currentPreviewFile);
      }
      await Promise.all([fetchFolderTree(), fetchAndRenderFiles()]);
    } else {
      throw new Error(data.error);
    }
  } catch (err) {
    console.error('Rename error:', err);
    toast(`Rename failed: ${err.message}`, false);
  }
}

/** Shows move file modal with folder selection */
function showMoveFileModal(file) {
  const targetFolders = [];
  
  // Get all available folders from the tree
  const folderItems = document.querySelectorAll('.folder-item[data-folder-id]');
  folderItems.forEach(item => {
    const folderId = item.dataset.folderId;
    const folderName = item.textContent.trim();
    if (folderId && folderName) {
      targetFolders.push({ id: folderId, name: folderName });
    }
  });
  
  if (targetFolders.length === 0) {
    toast('No target folders available for moving', false);
    return;
  }
  
  // Create simple selection dialog
  const options = targetFolders.map(folder => `${folder.name} (${folder.id})`).join('\n');
  const selection = prompt(`Move "${file.displayName}" to which folder?\n\n${options}\n\nEnter folder name or ID:`);
  
  if (selection) {
    const targetFolder = targetFolders.find(f => 
      f.name.toLowerCase().includes(selection.toLowerCase()) || 
      f.id === selection
    );
    
    if (targetFolder) {
      moveFile(file.id, targetFolder.id);
    } else {
      toast('Invalid folder selection', false);
    }
  }
}

/** Moves a file to a different folder */
async function moveFile(fileId, targetFolderId) {
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'moveFile', 
        fileId, 
        targetFolderId 
      })
    });
    
    const data = await res.json();
    if (data.success) {
      toast('File moved successfully!', true);
      hideFilePreview();
      await Promise.all([fetchFolderTree(), fetchAndRenderFiles()]);
    } else {
      throw new Error(data.error);
    }
  } catch (err) {
    console.error('Move error:', err);
    toast(`Move failed: ${err.message}`, false);
  }
}
