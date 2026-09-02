# Deploying the demo

The app is a static bundle — no server, no database, no environment secrets.
`npm run build` produces `dist/`, which is ~800 KB on disk and **218 KB
gzipped** over the wire. Any static host will serve it.

## Deep links need an SPA fallback

Routes like `/employees/emp_1027` and
`/submissions?week=2026-08-29&status=missing` are client-side. A plain static
host returns 404 for them on a direct hit or a refresh, which would break every
shareable link in the app. The repo already ships the fallback config for the
common hosts:

| File | Used by |
| --- | --- |
| `public/_redirects` | Cloudflare Pages, Netlify |
| `vercel.json` | Vercel |
| `public/.htaccess` | Apache / cPanel shared hosting |
| `.github/workflows/deploy-pages.yml` | GitHub Pages (copies `index.html` → `404.html`) |

---

## Recommended: Cloudflare Pages (code stays on GitHub)

Gives a URL with no platform name you objected to, redeploys on every push, and
supports a free password gate.

1. Go to **dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to
   Git**, and authorise the repo.
2. Build settings:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
   - Leave `VITE_BASE` unset — Cloudflare serves from a root.
3. Deploy. You get `https://<project-name>.pages.dev`.

### Add the password gate

**Cloudflare dashboard → Zero Trust → Access → Applications → Add an
application → Self-hosted**, pointed at the Pages URL. Two policy styles:

- **Service Auth / PIN** — one shared password you give the client.
- **One-time PIN** — you list the client's email addresses; they get a code by
  email. Better audit trail, no shared secret.

Free for up to 50 users.

### Put your own domain on it

**Pages project → Custom domains → Set up a domain.** Once it resolves, the URL
is entirely yours (`quadrel.yourdomain.com`) and Cloudflare is invisible.

---

## Alternative: GitHub Pages

Two things to know before choosing this:

- The URL will be `https://<user>.github.io/<repo>/` — "github" is in it unless
  you attach a custom domain.
- **There is no access control.** GitHub Pages cannot be password-protected, and
  on a free account it only serves public repos. If the demo needs a gate, use
  Cloudflare Pages.

To enable: **Settings → Pages → Source: GitHub Actions**, then run the
*Deploy to GitHub Pages* workflow (it runs automatically on push to `main`).

---

## Alternative: hosting you already have

Build and upload:

```bash
npm run build
```

Then copy the **contents** of `dist/` to your web root (or a subfolder). The
included `.htaccess` handles routing on Apache/cPanel. If you deploy into a
subfolder rather than a domain root, build with the matching base path first:

```bash
VITE_BASE=/quadrel/ npm run build
```

---

## Regenerating the data

Nothing to do — the dataset is generated deterministically in the browser from a
fixed seed, so every visitor sees the same 50 employees and the same numbers.
Week boundaries are computed from the real current date, so the dashboard always
reads as "this week" no matter when the client opens it.
