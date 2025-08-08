// Notes Drive - Google Apps Script backend
// Web App for public listing and uploads without OAuth (execute as Me, access: Anyone)

const CONFIG = {
  PUBLIC_FOLDER_ID: '1aNAcrw5nfHm7JGHAlHYy5bq-6GjtL1ln',
  STAGING_FOLDER_ID: '1MH0ajMkl_dd70327xJoWfRvu_az98mnB',
};

/** Utility: JSON response */
function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Utility: format file metadata for frontend */
function toFileDTO(file) {
  const id = file.getId();
  const name = file.getName();
  const mimeType = file.getMimeType();
  const size = file.getSize();
  const lastUpdated = file.getLastUpdated();
  const webViewLink = 'https://drive.google.com/file/d/' + id + '/view';
  const downloadLink = 'https://drive.google.com/uc?export=download&id=' + id;
  const thumbnailLink = 'https://drive.google.com/thumbnail?sz=w320&id=' + id;
  return {
    id: id,
    name: name,
    mimeType: mimeType,
    size: size || 0,
    modifiedTime: lastUpdated ? lastUpdated.toISOString() : null,
    webViewLink: webViewLink,
    webContentLink: downloadLink,
    thumbnailLink: thumbnailLink,
  };
}

/** GET: list files in PUBLIC folder (default) */
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || 'list';

    if (action === 'list') {
      var folder = DriveApp.getFolderById(CONFIG.PUBLIC_FOLDER_ID);
      var files = folder.getFiles();
      var out = [];
      while (files.hasNext()) {
        var file = files.next();
        out.push(toFileDTO(file));
      }
      // Sort by last updated desc
      out.sort(function (a, b) {
        return new Date(b.modifiedTime) - new Date(a.modifiedTime);
      });
      return json({ success: true, count: out.length, files: out });
    }

    return json({ success: false, error: 'Unknown action' });
  } catch (err) {
    return json({ success: false, error: err && err.message ? err.message : String(err) });
  }
}

/** POST: upload file(s) into STAGING. Optional publish=true to move to PUBLIC and make public */
function doPost(e) {
  try {
    var params = (e && e.parameter) || {};
    var publish = String(params.publish || 'false').toLowerCase() === 'true';

    var stagingFolder = DriveApp.getFolderById(CONFIG.STAGING_FOLDER_ID);
    var publicFolder = DriveApp.getFolderById(CONFIG.PUBLIC_FOLDER_ID);

    var filesCreated = [];

    if (e && e.files) {
      // Support common names: 'file' or 'files'
      var fileBlobs = [];
      if (e.files.file) fileBlobs = fileBlobs.concat(e.files.file);
      if (e.files.files) fileBlobs = fileBlobs.concat(e.files.files);
      if (!Array.isArray(fileBlobs)) fileBlobs = [fileBlobs];

      fileBlobs.forEach(function (blob) {
        if (!blob) return;
        var created = stagingFolder.createFile(blob);
        created.setDescription('Uploaded via Notes Drive Web App');
        var fileObj = created;
        if (publish) {
          // Move to PUBLIC and make anyone-with-link viewer
          fileObj = created.moveTo(publicFolder);
          try {
            fileObj.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          } catch (shareErr) {
            // Ignore if permission already set
          }
        }
        filesCreated.push(toFileDTO(fileObj));
      });
    }

    return json({ success: true, published: publish, files: filesCreated });
  } catch (err) {
    return json({ success: false, error: err && err.message ? err.message : String(err) });
  }
}

/** OPTIONS stub for CORS preflight (Apps Script ignores custom headers, but harmless) */
function doOptions() {
  return json({ ok: true });
}
