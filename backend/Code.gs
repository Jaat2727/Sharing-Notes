/**
 * Notes Drive - Google Apps Script backend
 *
 * Features:
 * - List files (and categories as subfolders) from a shared Drive folder
 * - Upload files (optionally into a category subfolder)
 * - Return public download links
 *
 * Setup:
 * 1) Set the Script Property 'FOLDER_ID' to the ID of your shared Drive folder.
 * 2) Deploy as Web App with access: "Anyone" (or "Anyone with Google account" if you prefer)
 * 3) Use the web app URL in your frontend as GAS_WEB_APP_URL
 */

/**
 * Read script property for folder id.
 */
function getRootFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('FOLDER_ID');
  if (!id) throw new Error('Script property FOLDER_ID is not set.');
  var folder = DriveApp.getFolderById(id);
  return folder;
}

/**
 * JSON helpers
 */
function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

function error_(message) {
  return jsonOutput_({ ok: false, error: message });
}

/** Admin check: prefer email, fallback to token */
function getActiveEmail_() {
  try { return Session.getActiveUser().getEmail() || ''; } catch (e) { return ''; }
}
function isAdminRequest_(e) {
  var props = PropertiesService.getScriptProperties();
  var adminEmail = (props.getProperty('ADMIN_EMAIL') || '').trim().toLowerCase();
  var email = getActiveEmail_().trim().toLowerCase();
  if (adminEmail && email && email === adminEmail) return true;
  // Fallback token support
  var token = props.getProperty('ADMIN_TOKEN');
  if (!token) return false;
  var hdr = e && e.parameter && (e.parameter.adminToken || e.parameter.token);
  return hdr === token;
}

/**
 * Build a public download URL for a file ID.
 * If the folder (or file) is shared as "Anyone with link - Viewer", this works.
 */
function downloadUrl_(fileId) {
  return 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(fileId);
}

/**
 * Collect files under root (and category subfolders).
 */
function listFiles_() {
  var root = getRootFolder_();
  var items = [];

  function walk_(folder, pathParts) {
    // files in this folder
    var files = folder.getFiles();
    while (files.hasNext()) {
      var f = files.next();
      items.push({
        id: f.getId(),
        name: f.getName(),
        mimeType: f.getMimeType(),
        size: f.getSize(),
        modifiedTime: f.getLastUpdated(),
        category: pathParts.length ? pathParts[0] : null,
        path: pathParts.join('/'),
        downloadUrl: downloadUrl_(f.getId())
      });
    }
    // subfolders
    var folders = folder.getFolders();
    while (folders.hasNext()) {
      var sub = folders.next();
      var nextPath = pathParts.concat([sub.getName()]);
      walk_(sub, nextPath);
    }
  }

  walk_(root, []);
  items.sort(function(a, b){ return new Date(b.modifiedTime) - new Date(a.modifiedTime); });
  return items;
}

/**
 * Aggregate categories with counts.
 */
function listCategories_() {
  var root = getRootFolder_();
  var result = [];
  var folders = root.getFolders();
  while (folders.hasNext()) {
    var cat = folders.next();
    var cnt = 0;
    var files = cat.getFiles();
    while (files.hasNext()) { files.next(); cnt++; }
    result.push({ name: cat.getName(), count: cnt });
  }
  // Sort alpha
  result.sort(function(a, b){ return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1; });
  return result;
}

/**
 * Build a nested tree of folders under root.
 */
function listTree_() {
  var root = getRootFolder_();

  function nodeFor_(folder) {
    var node = {
      id: folder.getId(),
      name: folder.getName(),
      path: '', // will be filled by caller
      children: [],
      fileCount: 0
    };
    var cnt = 0;
    var files = folder.getFiles();
    while (files.hasNext()) { files.next(); cnt++; }
    node.fileCount = cnt;
    var sub = folder.getFolders();
    while (sub.hasNext()) {
      node.children.push(nodeFor_(sub.next()));
    }
    return node;
  }

  var tree = nodeFor_(root);

  function setPaths_(n, parts) {
    n.path = parts.join('/');
    n.children.forEach(function(c){ setPaths_(c, parts.concat([c.name])); });
  }
  setPaths_(tree, []);
  return tree;
}

/**
 * Create a subfolder under the given path.
 * parentPath like "Math/Algebra" or "" for root.
 */
function createFolder_(parentPath, name) {
  if (!name) throw new Error('Folder name required');
  var folder = getRootFolder_();
  if (parentPath) {
    var parts = parentPath.split('/').filter(function(x){ return x; });
    for (var i = 0; i < parts.length; i++) {
      var it = folder.getFoldersByName(parts[i]);
      if (!it.hasNext()) folder = folder.createFolder(parts[i]);
      else folder = it.next();
    }
  }
  var exists = folder.getFoldersByName(name);
  if (exists.hasNext()) return { id: exists.next().getId(), name: name };
  var created = folder.createFolder(name);
  return { id: created.getId(), name: created.getName() };
}

/**
 * Delete request logging
 */
function getOrCreateRequestSheet_() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('REQUEST_SHEET_ID');
  var ss, sheet;
  if (sheetId) {
    ss = SpreadsheetApp.openById(sheetId);
  } else {
    ss = SpreadsheetApp.create('Notes Drive Requests');
    props.setProperty('REQUEST_SHEET_ID', ss.getId());
  }
  sheet = ss.getSheetByName('Requests') || ss.insertSheet('Requests');
  var headers = ['Timestamp', 'File ID', 'File Name', 'Reason', 'UserEmail', 'Status', 'Note'];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    // ensure headers length
    var firstRow = sheet.getRange(1, 1, 1, sheet.getMaxColumns()).getValues()[0];
    for (var i = 0; i < headers.length; i++) {
      if (!firstRow[i]) sheet.getRange(1, i+1).setValue(headers[i]);
    }
  }
  return sheet;
}

function logDeleteRequest_(fileId, reason, userEmail) {
  var name = '';
  try { name = DriveApp.getFileById(fileId).getName(); } catch (e) { name = ''; }
  var sheet = getOrCreateRequestSheet_();
  sheet.appendRow([new Date(), fileId, name, reason || '', userEmail || '', 'open', '']);
}

function getDeleteRequests_() {
  var sheet = getOrCreateRequestSheet_();
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var values = sheet.getRange(2, 1, last-2+1, 7).getValues();
  var res = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    res.push({
      row: i + 2,
      timestamp: r[0],
      fileId: r[1],
      fileName: r[2],
      reason: r[3],
      userEmail: r[4],
      status: r[5] || 'open',
      note: r[6] || ''
    });
  }
  return res;
}

function resolveDeleteRequest_(row, status, note) {
  var sheet = getOrCreateRequestSheet_();
  if (row < 2) throw new Error('Invalid row');
  sheet.getRange(row, 6).setValue(status || 'resolved');
  if (note !== undefined) sheet.getRange(row, 7).setValue(note);
}

/** Upload logs */
function getOrCreateUploadsSheet_() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('REQUEST_SHEET_ID');
  var ss = sheetId ? SpreadsheetApp.openById(sheetId) : null;
  if (!ss) {
    ss = SpreadsheetApp.create('Notes Drive Requests');
    props.setProperty('REQUEST_SHEET_ID', ss.getId());
  }
  var sheet = ss.getSheetByName('Uploads') || ss.insertSheet('Uploads');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'File ID', 'File Name', 'Path', 'UserEmail']);
  }
  return sheet;
}

function logUpload_(fileId, name, path, userEmail) {
  var sheet = getOrCreateUploadsSheet_();
  sheet.appendRow([new Date(), fileId, name, path || '', userEmail || '']);
}

/**
 * Create or find a subfolder for a category name under root.
 */
function getOrCreateCategoryFolder_(category) {
  var root = getRootFolder_();
  var it = root.getFoldersByName(category);
  if (it.hasNext()) return it.next();
  return root.createFolder(category);
}

/**
 * Upload a file given base64 content, mimeType, and filename.
 */
function uploadFile_(payload) {
  if (!payload || !payload.contentBase64 || !payload.filename) {
    throw new Error('Missing upload parameters.');
  }
  var bytes = Utilities.base64Decode(payload.contentBase64);
  var blob = Utilities.newBlob(bytes, payload.mimeType || 'application/octet-stream', payload.filename);

  var targetFolder = getRootFolder_();
  if (payload.category) {
    targetFolder = getOrCreateCategoryFolder_(payload.category);
  }

  var file = targetFolder.createFile(blob);

  // Ensure at least link-share view at file level if needed (optional). If the root folder is already link-shared, this is not required.
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {
    // Some domains may restrict programmatic sharing. Ignore if fails.
  }

  var out = {
    id: file.getId(),
    name: file.getName(),
    downloadUrl: downloadUrl_(file.getId())
  };
  try {
    var email = '';
    try { email = Session.getActiveUser().getEmail() || ''; } catch (x) { email = ''; }
    // We only know top-level category path from payload
    var path = payload.category ? payload.category : '';
    logUpload_(out.id, out.name, path, email);
  } catch (e) {}
  return out;
}

/**
 * GET entrypoint
 * Supported: action=list, action=categories
 */
function doGet(e) {
  try {
    var action = e && e.parameter && e.parameter.action;
    if (action === 'list') {
      return jsonOutput_({ ok: true, files: listFiles_() });
    }
    if (action === 'categories') {
      return jsonOutput_({ ok: true, categories: listCategories_() });
    }
    if (action === 'tree') {
      return jsonOutput_({ ok: true, tree: listTree_() });
    }
    if (action === 'whoami') {
      var props = PropertiesService.getScriptProperties();
      var adminEmail = (props.getProperty('ADMIN_EMAIL') || '').trim().toLowerCase();
      var email = getActiveEmail_();
      var isAdmin = adminEmail && email && email.toLowerCase() === adminEmail;
      return jsonOutput_({ ok: true, email: email || null, isAdmin: !!isAdmin });
    }
    if (action === 'requests') {
      if (!isAdminRequest_(e)) return error_('Unauthorized');
      return jsonOutput_({ ok: true, requests: getDeleteRequests_() });
    }
    if (action === 'uploads') {
      if (!isAdminRequest_(e)) return error_('Unauthorized');
      var sheet = getOrCreateUploadsSheet_();
      var last = sheet.getLastRow();
      var uploads = [];
      if (last >= 2) {
        var vals = sheet.getRange(2, 1, last-1, 5).getValues();
        for (var i = 0; i < vals.length; i++) {
          var r = vals[i];
          uploads.push({ timestamp: r[0], fileId: r[1], fileName: r[2], path: r[3], userEmail: r[4] });
        }
      }
      return jsonOutput_({ ok: true, uploads: uploads });
    }
    // Default help
    return jsonOutput_({ ok: true, message: 'Use action=list or action=categories. POST with action=upload for uploads.' });
  } catch (err) {
    return error_(String(err));
  }
}

/**
 * POST entrypoint
 * We expect Content-Type: text/plain and JSON string in body.
 */
function doPost(e) {
  try {
    var body = e && e.postData && e.postData.contents;
    if (!body) return error_('Empty body');
    var payload = JSON.parse(body);
    if (payload.action === 'upload') {
      var info = uploadFile_(payload);
      return jsonOutput_({ ok: true, file: info });
    }
    if (payload.action === 'createFolder') {
      var created = createFolder_(payload.parentPath || '', payload.name || '');
      return jsonOutput_({ ok: true, folder: created });
    }
    if (payload.action === 'requestDelete') {
      var email = '';
      try { email = Session.getActiveUser().getEmail() || ''; } catch (x) { email = ''; }
      logDeleteRequest_(payload.fileId, payload.reason, email);
      return jsonOutput_({ ok: true });
    }
    if (payload.action === 'resolveRequest') {
      if (!isAdminRequest_({ parameter: { adminToken: payload.adminToken } })) return error_('Unauthorized');
      resolveDeleteRequest_(payload.row, payload.status || 'resolved', payload.note || '');
      return jsonOutput_({ ok: true });
    }
    return error_('Unknown action');
  } catch (err) {
    return error_(String(err));
  }
}
