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
  toast: document.getElementById('toast')
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
    els.grid.innerHTML = data.files.map(card).join('');
  } catch (e) {
    els.grid.innerHTML = '<div class="text-sm text-red-600">Failed to load files. Check console.</div>';
    console.error('List error', e);
    toast('Failed to load files', false);
  }
}

async function uploadFile(ev) {
  ev.preventDefault();
  const file = els.inputFile.files[0];
  if (!file) return toast('Choose a file to upload', false);
  els.uploadStatus.textContent = 'Uploading…';
  try {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('publish', els.chkPublish.checked ? 'true' : 'false');

    const res = await fetch(API_BASE, { method: 'POST', body: fd });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Upload failed');
    els.uploadStatus.textContent = 'Done';
    toast('Uploaded successfully');
    els.inputFile.value = '';
    await fetchFiles();
  } catch (e) {
    els.uploadStatus.textContent = '';
    console.error('Upload error', e);
    toast('Upload failed', false);
  }
}

// Events
els.btnRefresh.addEventListener('click', fetchFiles);
els.formUpload.addEventListener('submit', uploadFile);

// Init
fetchFiles();
