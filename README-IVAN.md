# FDS Frontend Demo — Deployment Guide for Ivan

Prepared: 26 October 2026
Audience: Ivan, deployment owner
Goal: Publish a frontend-only demonstration so Felix can review the screens and workflows using a web link.

## 1. Understand this package

This ZIP is a **standalone FDS frontend project**, copied from the latest local source. It is not the original multi-app repository.

Included:
- React frontend source (`src/`) and public assets (`public/`).
- `package.json` and `package-lock.json` for installing dependencies.
- `vite.config.js` for building the frontend.
- `vercel.json` with build settings and a single-page application fallback.
- `.env.example` with the demo login setting.

Not included:
- Backend server or PostgreSQL database.
- Direct Booking Website or Manager Mobile App.
- Installed dependencies (`node_modules/`), local secrets or browser data.

**For this package, Vercel Root Directory is the folder containing package.json. Do not enter `apps/fds-web`.** That path applies only to the original monorepo.

## 2. What you need

For deployment through GitHub:
1. A GitHub account.
2. A Vercel account with permission to import your GitHub repository.
3. This ZIP extracted to a normal folder.

For local verification (recommended):
1. Node.js 24.x, including npm.
2. Visual Studio Code.
3. A terminal such as PowerShell.

Check your local installation:
```powershell
node --version
npm --version
```
The Node.js output should begin with `v24.`. If the commands are not found, install Node.js 24 and reopen VS Code.

## 3. Extract and open the correct folder

1. Right-click the ZIP in Windows File Explorer.
2. Choose **Extract All** and select a destination.
3. Open the extracted `FDS-Vercel-Frontend-2026-10-26` folder.
4. Confirm that you can see `package.json`, `package-lock.json`, `src`, `public`, and `vercel.json` together.
5. In VS Code, choose **File > Open Folder** and open that folder.
6. Choose **Terminal > New Terminal**.

The terminal must be in the folder containing package.json. Confirm with:
```powershell
Get-Location
Test-Path package.json
```
The second command must return `True`.

## 4. Test locally before deploying

Run these commands one at a time:
```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

What each command does:
- `npm ci`: installs the versions recorded in package-lock.json.
- `Copy-Item`: enables demo authentication in your local environment.
- `npm run dev`: starts the local frontend development server.

Open **http://127.0.0.1:5176** in your browser. Leave the terminal running while using the app. Press **Ctrl+C** in that terminal when you want to stop it.

Optional verification after stopping the development server:
```powershell
npm run lint
npm test
npm run build
```
A successful build creates `dist/`. Do not upload node_modules or dist to the source repository; Vercel installs and builds the source itself.

## 5. Create a dedicated GitHub repository

Use a dedicated repository for this standalone demo to avoid confusion with the main project structure.

### Option A — Upload through the GitHub website

1. Sign in to GitHub and choose **New repository**.
2. Choose a clear name, for example `fds-frontend-demo`.
3. Choose visibility according to the team's preference. Vercel must have access to the repository.
4. Create the repository.
5. Choose **uploading an existing file** or **Add file > Upload files**.
6. Upload the **contents** of the extracted project folder, not the ZIP file and not an additional outer folder.
7. Include src/, public/, index.html, package.json, package-lock.json, vite.config.js, vercel.json, .gitignore and .env.example.
8. Exclude node_modules/, dist/, .env.local and any other local environment files.
9. Commit the upload.
10. Confirm that package.json appears directly at the repository root. Also check that vercel.json and the source folders were uploaded.

### Option B — Use Git in the terminal

Create an empty GitHub repository first, then run these commands from the extracted project folder. Replace YOUR_USERNAME and YOUR_REPOSITORY before running the remote command.

```powershell
git init
git add .
git commit -m "Add standalone FDS frontend demo"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

The supplied .gitignore excludes node_modules, dist, .env.local and .vercel. Check the files staged for commit before uploading. Do not use this sequence inside the team's original repository.

## 6. Import the repository into Vercel

1. Sign in at https://vercel.com.
2. Choose **Add New > Project**.
3. Connect GitHub if prompted.
4. Allow Vercel access to the dedicated demo repository.
5. Find the repository and click **Import**.
6. Enter a project name, for example `fds-frontend-demo`.
7. Configure the following settings. Labels may vary slightly as the Vercel dashboard changes.

| Setting | Value |
|---|---|
| Framework Preset | Vite |
| Root Directory | Repository root (`./`), where package.json is located |
| Install Command | npm ci |
| Build Command | npm run build |
| Output Directory | dist |
| Node.js Version | 24.x |
| Production Branch | main |

The package includes vercel.json with install, build, output and route fallback settings. Keep the dashboard consistent with it. If the Node version is not shown during import, check project settings under Build and Deployment before redeploying.

**Do not use `npm run dev` as the Build Command.** The development command keeps a local server running; Vercel needs the generated static files from `npm run build`.

## 7. Enable demo authentication — required

Before deploying, add this Environment Variable:

| Name | Value |
|---|---|
| VITE_DEMO_AUTH | true |

Use lowercase `true` without quotation marks. Apply it to **Production** and **Preview**. If import does not expose environment selection, verify both environments in project settings afterward.

Why this is necessary:
- The deployed site has no authentication backend.
- This flag selects the existing browser-based demo authentication implementation.
- Without it, the app will attempt to contact /api endpoints and login will fail.
- Your local .env.local is excluded from Git and does not configure Vercel.
- Vite reads this setting during the build. After changing it, create a new deployment or redeploy; refreshing the browser alone is not enough.

Do not add database passwords, real account passwords or backend secrets to VITE_ variables. They are exposed to the browser bundle.

## 8. Deploy and open the website

1. Click **Deploy**.
2. Wait for dependency installation and the build to finish.
3. Confirm the deployment status is **Ready**.
4. Open the generated HTTPS URL.
5. Test the production URL in a fresh browser session.
6. Check whether a viewer needs to sign in to Vercel. If so, review **Deployment Protection** and arrange access appropriate for this client demo.
7. Send Felix the stable production project URL after the checks below, rather than a local address or an old preview deployment URL.

You do not need to keep your computer, VS Code or local server running after deployment. Do not send `127.0.0.1` or `localhost` links to Felix: those addresses refer to each viewer's own computer.

## 9. Demo login and Manager approval testing

Initial demo administrator:

```text
Email: admin@hotel.local
Password: DemoAdmin123!
```

These are intentionally public synthetic credentials. This is not secure production authentication.

To demonstrate Manager approval:
1. Sign in using the demo administrator account.
2. Open **Staff** and create an active Manager account using fictional details and a demo-only password of at least 10 characters.
3. Submit a room type or rate change from the appropriate frontend workflow.
4. Sign out.
5. Sign in as the Manager in the **same browser and same website origin**.
6. Open the approvals page and review the request.
7. Approve or reject it and verify the resulting state.

Accounts and requests created on your computer will not appear on Felix's computer. For a shared demonstration, operate within one browser or have the reviewer create their own demo data.

## 10. Acceptance checklist before sharing

- [ ] The deployment is Ready and the production URL loads.
- [ ] Demo administrator login succeeds without a backend.
- [ ] Sidebar navigation and hamburger menu work.
- [ ] New Reservation initially shows a full-width calendar with 14 dates.
- [ ] Selecting check-in and check-out reveals Booking Summary.
- [ ] Clear Selection hides the summary and restores the full-width calendar.
- [ ] A fictional reservation can be created.
- [ ] Room Planner displays availability and expanded physical room allocations.
- [ ] Check-in and check-out can be demonstrated on appropriate fictional reservations.
- [ ] Cash payment can be recorded without Payment Reference.
- [ ] A receipt number is generated when a payment is saved.
- [ ] A fully paid folio opens the PDF preview with Download and Print controls.
- [ ] Manager approval is required before a submitted rate change becomes effective.
- [ ] Refreshing the site preserves demo data in the same browser.
- [ ] A viewer can open the shared URL without an unintended Vercel access block.

Use only fictional guest names, contact details and transactions. Printing may open a browser or operating-system print dialog; behavior varies by browser.

## 11. Common problems and fixes

### Login reports that the authentication API is unavailable
- Check VITE_DEMO_AUTH is exactly `true` in Vercel.
- Check the variable is enabled for the deployment environment being viewed.
- Redeploy after changing it.
- Open the newest deployment URL and refresh.
- Do not start a backend for this demo package.

### Vercel cannot find package.json
- Check Root Directory.
- If you accidentally uploaded an outer folder, move its contents to the repository root or select that folder as Root Directory.
- Do not use apps/fds-web for this ZIP.

### Build failed
- Open the failed deployment's Build Logs and locate the first actual error.
- Check Node.js is 24.x, installation is npm ci, build is npm run build, and output is dist.
- Confirm both package.json and package-lock.json are present.
- If dependencies were deliberately changed, regenerate and commit the lockfile using npm install, then retry npm ci locally.
- Send Eric the first error and the deployment link if it still fails. Do not send credentials.

### Page is blank, or refreshing a page returns 404
- Confirm the build produced dist/index.html.
- Confirm Output Directory is dist.
- Confirm vercel.json was uploaded and is in the project root.
- Check the browser console for JavaScript errors and report the first error.

### Local port 5176 is already in use
- Stop the existing FDS development server with Ctrl+C in its terminal.
- Then run npm run dev again.
- This local port issue does not affect the deployed Vercel website.

### Felix does not see the newest UI
- Confirm the latest source was committed and pushed to the branch connected to production.
- Confirm that commit has a successful deployment.
- Share the production URL, not a previous deployment's URL.
- Refresh the browser after checking the deployment.

### Demo data differs between computers, or disappears in private browsing
- This is expected: data is stored in each browser, not a shared database.
- Different domains, browsers and devices have separate data.
- Private browsing data may be removed when that session closes.

### Resetting demo data
Only if you deliberately want to erase that browser's demo records: open browser Developer Tools, find storage for this site's origin, and clear its localStorage and sessionStorage. Reload the page to recreate the initial demo account and default data. This deletes the local demo accounts and reservations, so export anything needed first. It does not affect other browsers.

## 12. Publish future updates

1. Obtain the updated standalone frontend source from Eric.
2. Replace only the intended source/configuration files in the demo repository.
3. Keep package.json and package-lock.json together if dependencies changed.
4. Run local checks and commit the update.
5. Push to the connected production branch.
6. Check the resulting Vercel deployment and repeat the relevant acceptance checks.

For terminal users, review changes before committing:
```powershell
git status
git diff
git add .
git commit -m "Update FDS frontend demo"
git push
```

## 13. Scope and limitations to communicate

- This is a frontend review demo, not a live hotel operations system.
- Browser localStorage holds demo accounts and operational data; sessionStorage holds the login session.
- There is no cross-device or cross-app synchronization.
- No real payment collection, email delivery, OTA synchronization or MyInvois submission occurs.
- Frontend role checks demonstrate workflows; they are not server-side access control.
- The receipt follows the requested demonstration calculation: subtotal + 6% of subtotal + 10% of subtotal. This does not certify tax compliance.
- Real deployment with guest data requires the backend, database, authentication and integrations.

## 14. Handover to Eric

After deployment, provide:
- GitHub repository link.
- Vercel project name.
- Production website URL.
- The deployed commit identifier or deployment link.
- A short summary of checks completed and any outstanding problems.

Do not share Vercel tokens or real passwords in the handover.

Official references:
- Vite deployment: https://vercel.com/docs/frameworks/frontend/vite
- Environment variables: https://vercel.com/docs/environment-variables
- Monorepo deployments (for the original repository, not this standalone ZIP): https://vercel.com/docs/monorepos
