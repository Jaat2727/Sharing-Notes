# Notes Drive (GitHub Pages + Google Drive backend)

Public, free file hub with optional uploads to a shared Google Drive folder.

- Frontend: Static site (GitHub Pages)
- Backend: Google Apps Script Web App (Drive API via built-in services)
- Auth: Minimal — set Web App access to "Anyone" for public uploads, or "Anyone with Google account" to require login.

---

## Features
- List and download files from a shared Drive folder (includes subfolders as categories)
- Upload files (optionally assign a category = subfolder)
- Search, refresh, compact view toggle
- Notion-like clean UI

---

## 1) Set up the Google Drive backend (Apps Script)

1. **Create a shared folder on Google Drive**
   - Create a folder, e.g., `Notes Drive Shared`.
   - Optional but recommended: Share the folder as "Anyone with the link can view" so downloads work without auth.

2. **Create Apps Script project**
   - Go to https://script.new
   - Delete any default file code and create these files matching the `backend/` folder in this repo:
     - `Code.gs`
     - `appsscript.json` (manifest)
   - Paste contents from `backend/Code.gs` and `backend/appsscript.json`.

3. **Set Script Property**
   - In Apps Script: Project Settings → Script properties → Add property
   - Key: `FOLDER_ID`
   - Value: the ID of your shared Drive folder (the long string in the folder URL)

4. **Deploy as Web App**
   - Click Deploy → Manage deployments → New deployment
   - Type: Web app
   - Execute as: Me
   - Who has access: 
     - "Anyone" → public uploads allowed
     - or "Anyone with Google account" → requires login to upload
   - Deploy and copy the Web app URL (ends with `/exec`)

5. **Permissions**
   - First call to the web app will prompt authorization.
   - Scopes used are in `backend/appsscript.json` (Drive read/write).

---

## 2) Connect frontend to backend

- Open `assets/app.js` and set your Apps Script web app URL. You can do this without editing the file:
  - Open the site in the browser → open DevTools Console → run:
    ```js
    setBackendUrl('https://script.google.com/macros/s/AKfycb.../exec')
    ```
  - Refresh the page. The value is saved in `localStorage`.
- Or edit the code: set `GAS_WEB_APP_URL` default in `assets/app.js`.

---

## 3) Run locally and deploy to GitHub Pages

- This is a static site. You can simply open `index.html` in a browser to test.
- To deploy:
  1. Create a GitHub repo and push these files.
  2. In GitHub → Settings → Pages → Build and deployment → Source: `Deploy from a branch`.
  3. Branch: `main` (or `master`) and folder `/ (root)`.
  4. Save. After a minute, your site will be live at `https://<username>.github.io/<repo>/`.

---

## 4) Usage notes

- **Downloads**: We generate `https://drive.google.com/uc?export=download&id=<fileId>` links. Ensure the file or parent folder is shared for public view.
- **Categories**: Each category is a subfolder under the root shared folder.
- **Refreshing**: Use the Refresh button in the header; can be automated by periodic reload if desired.
- **Uploads**: Files are uploaded in base64 via POST with `text/plain` content-type (avoids CORS preflight). Apps Script decodes and writes to Drive.
- **Auth**: For truly public uploads, choose "Anyone" in Web App access. For a bit more control, use "Anyone with Google account".

---

## 5) Optional: Restrict file types / size

- In `backend/Code.gs` `uploadFile_()`, add checks for `payload.mimeType` or content length before writing.
- In `assets/app.js`, add client-side checks on `file.size` or `file.type`.

---

## 6) Troubleshooting

- "Backend URL not set" → In the browser console, run `setBackendUrl('<your web app URL>')`.
- 403/404 on download → Ensure Drive folder or the file is link-shared for viewing.
- Upload fails due to sharing policy → Your Workspace admin may block `ANYONE_WITH_LINK`. Remove `file.setSharing(...)` or ensure folder sharing.
- CORS/preflight → We use `text/plain` for POST to avoid preflight. GET uses query params.

---

## 7) Security

- Public uploads mean anyone with the page can write to your folder. Use a dedicated folder and monitor it.
- If abuse is a concern, switch Web App access to "Anyone with Google account" or add simple token gating (custom header and check in `doPost`).
