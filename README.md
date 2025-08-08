# Notes Drive — Public Google Drive Dashboard (No OAuth)

A minimal web app to list, download, and upload files to Google Drive using a Google Apps Script (GAS) Web App backend. Frontend is static (Tailwind + Vanilla JS) and can be hosted on GitHub Pages.

## Features

- Public file browser (reads a specific Drive folder)
- Direct download and view links
- Anonymous uploads to a staging folder
- Optional immediate publish to the public folder
- Simple, clean UI

## Config

Update folder IDs in `backend/Code.gs`:

```js
const CONFIG = {
  PUBLIC_FOLDER_ID: '1aNAcrw5nfHm7JGHAlHYy5bq-6GjtL1ln',
  STAGING_FOLDER_ID: '1MH0ajMkl_dd70327xJoWfRvu_az98mnB',
};
```

## Deploy the Apps Script Web App

1. Open https://script.google.com and create a new project.
2. Add two files:
   - `Code.gs` → paste from `backend/Code.gs`
   - `appsscript.json` → paste from `backend/appsscript.json`
3. In the left sidebar, enable Drive API scopes (scopes are already set in manifest).
4. Click "Deploy" → "New deployment" → type: "Web app".
5. Set:
   - Description: Notes Drive API
   - Execute as: Me
   - Who has access: Anyone
6. Deploy. Copy the Web App URL ending with `/exec`.
7. In `frontend/app.js`, replace `API_BASE` with this URL.

Tip: Ensure the PUBLIC folder has files shared as "Anyone with the link - Viewer". The script sets sharing when publishing uploads.

## Host the Frontend on GitHub Pages

1. Create a GitHub repo and push the `frontend/` folder contents.
2. In GitHub → Settings → Pages:
   - Source: Deploy from a branch
   - Branch: `main` (or your default), folder: `/root`
3. Ensure your `index.html` (and `app.js`) are at the repository root (or configure Pages to serve from `/docs`).
4. Open your Pages URL and set `API_BASE` correctly.

Alternatively, host anywhere static (Netlify, Vercel static, etc.).

## API

- GET `?action=list` → returns `{ success, count, files: [ { id, name, mimeType, size, modifiedTime, webViewLink, webContentLink, thumbnailLink } ] }`
- POST (multipart/form-data) with fields:
  - `file`: the binary file
  - `publish`: `true|false` (optional)

## Notes

- This approach avoids OAuth for end users by executing the Apps Script as you. Keep the Web App URL private if you want to limit who can upload; otherwise consider rate limiting or adding a simple shared secret field.
- CORS: Apps Script Web Apps generally work cross-origin. If you face issues, try using a simple HTML form POST or a proxy.
- Security: Anyone with the Web App URL can upload. If needed, add a server-side `UPLOAD_KEY` check comparing a query/header/field value.
