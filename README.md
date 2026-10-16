# Gut Log

A phone-first log for a low FODMAP diet and SIBO treatment: one-tap Bristol stools, bloating (mild, moderate, strong), burps and gas; meals picked from a personal low FODMAP list; and reintroduction tests compared against your usual low FODMAP days.

The same page runs in two places:

| Where | Storage |
|---|---|
| Claude artifact | The artifact's built-in database |
| Vercel website | Upstash Redis through the `/api` routes, behind a password |
| Opened as a plain file | This browser only |

## Project layout

```
tracker.html            the app (single file, also published as the Claude artifact)
api/data.js             GET all data, PUT a day, settings, or an import
api/login.js            POST password to sign in, DELETE to sign out
api/_lib.js             Redis REST calls, session cookie, helpers
scripts/build.mjs       builds public/index.html from tracker.html
static/                 web app manifest and icons, copied into public/
vercel.json             build settings and security headers
```

No npm packages are needed. The build only uses Node's standard library.

## Deploy on Vercel

1. **Import the repository.** In Vercel, choose *Add New → Project*, pick `FODMAP_symptom_tracker` and keep the defaults. `vercel.json` already sets the build command and output folder. Click *Deploy*. The first deploy works but shows a setup error on login until steps 2 and 3 are done.
2. **Add the database.** Open the project, go to *Storage → Create Database*, choose **Upstash for Redis** (free plan), and connect it to this project for all environments. Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
3. **Set your password.** Go to *Settings → Environment Variables* and add `APP_PASSWORD` with a long password only you know.
4. **Redeploy.** Go to *Deployments*, open the menu on the latest one, and click *Redeploy* so the new variables are picked up.
5. **Open the site and sign in.** Each device stays signed in for 6 months. Changing `APP_PASSWORD` (and redeploying) signs every device out.

Optional: set `SESSION_SECRET` to a random string if you want to change the password without signing devices out.

## Move your data from the Claude artifact

1. In the artifact, open **Settings → Export data** and save the file.
2. On the website, open **Settings → Import data** and pick that file.

## Install on your phone

- **iPhone (Safari):** Share button → *Add to Home Screen*.
- **Android (Chrome):** menu → *Add to Home screen* or *Install app*.

It then opens full screen with its own icon.

## How syncing works

Every change is saved to the server right away and also kept on the device. If you are offline, changes wait on the device and sync when the connection is back. The app refreshes from the server every 30 seconds while open, and whenever you come back to it.

## Privacy

The site is marked `noindex`, the API refuses any request without a valid session cookie (HttpOnly, Secure, SameSite=Lax), and all data stays in your own Upstash database.
