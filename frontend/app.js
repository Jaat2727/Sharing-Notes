// Frontend for Notes Drive
// Replace with your deployed Apps Script Web App URL
const API_BASE = 'https://script.google.com/macros/s/AKfycbwCg8HYQZqpA-M0NeRDjd1he29xRMtXsvaYoZACX2r_loUrfDmb8Y-6Xe1ktapO9vtR/exec'; // e.g. https://script.google.com/macros/s/AKfycbx.../exec

const els = {
  grid: document.getElementById('grid'),
  count: document.getElementById('stat-count'),
  refreshed: document.getElementById('stat-refreshed'),
  btnRefresh: document.getElementById('btn-refresh'),
  formUpload: document.getElementById('form-upload'),
  inputFile: document.getElementById('inp-file'),
  chkPublish: document.getElementById('chk-publish'),
  uploadStatus: document.getElementById('upload-status'),
  toast: document.getElementById('toast'),
  dropzone: document.getElementById('dropzone'),
  dzOverlay: document.getElementById('dz-overlay'),
  selected: document.getElementById('selected-files'),
  progress: document.getElementById('progress'),
  btnUpload: document.getElementById('btn-upload')
};

function toast(msg, ok = true) {
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  els.toast.style.background = ok ? 'rgba(21, 128, 61, 0.95)' : 'rgba(185, 28, 28, 0.95)';
  setTimeout(() => els.toast.classList.add('hidden'), 2200);
}

function fmtBytes(bytes) {
  if (!bytes || bytes <= 0) return '—';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}

function card(file) {
  const isImg = (file.mimeType || '').startsWith('image/');
  const thumb = isImg ? file.thumbnailLink : 'https://cdn.jsdelivr.net/gh/tabler/tabler-icons/icons/file.svg';
  const date = file.modifiedTime ? new Date(file.modifiedTime).toLocaleString() : '';
  return `
    <article class="group rounded-xl border bg-white p-4 shadow-sm hover:shadow transition">
      <div class="aspect-video w-full overflow-hidden rounded-lg bg-slate-100">
        <img src="${thumb}" alt="${file.name}" class="h-full w-full object-cover object-center group-hover:scale-[1.02] transition"/>
      </div>
      <div class="mt-3 space-y-1">
        <h3 class="line-clamp-1 font-medium">${file.name}</h3>
        <div class="text-xs text-slate-500">${fmtBytes(file.size)} • ${date}</div>
        <div class="mt-2 flex gap-2">
          <a href="${file.webContentLink}" target="_blank" class="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50">Download</a>
          <a href="${file.webViewLink}" target="_blank" class="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-black">View</a>
        </div>
      </div>
    </article>
  `;
}

async function fetchFiles() {
  els.grid.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const sk = document.createElement('div');
    sk.className = 'h-48 animate-pulse rounded-xl border bg-white';
    els.grid.appendChild(sk);
  }
  try {
    const res = await fetch(API_BASE + '?action=list', { method: 'GET' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed');
    els.count.textContent = data.count;
    els.refreshed.textContent = new Date().toLocaleString();
    if (!data.files || data.files.length === 0) {
      els.grid.innerHTML = '<div class="rounded-xl border bg-white p-6 text-sm text-slate-500">No files yet. Upload something to get started.</div>';
    } else {
      els.grid.innerHTML = data.files.map(card).join('');
    }
  } catch (e) {
    els.grid.innerHTML = '<div class="text-sm text-red-600">Failed to load files. Check console.</div>';
    console.error('List error', e);
    toast('Failed to load files', false);
  }
}

function renderSelected(list) {
  if (!list || list.length === 0) {
    els.selected.textContent = 'No files selected';
    els.btnUpload.disabled = true;
    return;
  }
  els.btnUpload.disabled = false;
  const items = Array.from(list).map(f => `<div class="flex items-center justify-between gap-3"><span class="truncate">${f.name}</span><span class="text-xs text-slate-500">${fmtBytes(f.size)}</span></div>`);
  els.selected.innerHTML = items.join('');
}

function setUploadingState(isUploading) {
  els.btnUpload.disabled = isUploading;
  els.inputFile.disabled = isUploading;
}

function xhrUpload(file, publish) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', API_BASE, true);
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300 && data.success) return resolve(data);
        reject(new Error(data.error || `Upload failed (${xhr.status})`));
      } catch (err) {
        reject(err);
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    if (xhr.upload && typeof xhr.upload.addEventListener === 'function') {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          els.progress.style.width = pct + '%';
        }
      });
    }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('publish', publish ? 'true' : 'false');
    xhr.send(fd);
  });
}

async function uploadFile(ev) {
  ev.preventDefault();
  const files = els.inputFile.files;
  if (!files || files.length === 0) return toast('Choose files to upload', false);
  setUploadingState(true);
  els.uploadStatus.textContent = 'Uploading…';
  els.progress.style.width = '0%';
  try {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      els.uploadStatus.textContent = `Uploading ${i + 1} / ${files.length}…`;
      await xhrUpload(f, els.chkPublish.checked);
    }
    els.uploadStatus.textContent = 'Done';
    toast('Uploaded successfully');
    els.inputFile.value = '';
    renderSelected([]);
    els.progress.style.width = '100%';
    await fetchFiles();
  } catch (e) {
    console.error('Upload error', e);
    toast(e.message || 'Upload failed', false);
  } finally {
    setTimeout(() => { els.progress.style.width = '0%'; }, 800);
    els.uploadStatus.textContent = '';
    setUploadingState(false);
  }
}

// Events
els.btnRefresh.addEventListener('click', fetchFiles);
els.formUpload.addEventListener('submit', uploadFile);

// Drag & drop
['dragenter','dragover'].forEach(evt => {
  document.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); if (els.dzOverlay) els.dzOverlay.classList.remove('hidden'); }, false);
});
['dragleave','drop'].forEach(evt => {
  document.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); if (els.dzOverlay) els.dzOverlay.classList.add('hidden'); }, false);
});
document.addEventListener('drop', (e) => {
  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;
  els.inputFile.files = files;
  renderSelected(files);
});
els.inputFile.addEventListener('change', () => renderSelected(els.inputFile.files));

// Init
fetchFiles();
renderSelected([]);
