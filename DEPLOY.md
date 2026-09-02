# Deploying the demo

**Currently live at https://whitdeckard09.github.io/quadrel-labeling-crm/** via GitHub Pages, published by
`.github/workflows/deploy-pages.yml` on every push to `main`. Nothing to do to
redeploy — push and the workflow rebuilds it.

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

## Current setup: GitHub Pages

Enabled with **Settings → Pages → Source: GitHub Actions**. The workflow builds
with `VITE_BASE=/quadrel-labeling-crm/` (Pages serves from a repo subpath) and
copies `index.html` to `404.html`.

That 404 copy is what makes deep links work: GitHub Pages returns `404.html` for
any unknown path, the app boots from it, and React Router resolves the real
route. `curl` will report a 404 status for `/employees`, but every browser
renders the page correctly — verified.

Two limits worth knowing:

- **No access control.** GitHub Pages cannot be password-protected on any plan.
  Anyone with the link can open it.
- The URL contains `github.io` unless you attach a custom domain
  (**Settings → Pages → Custom domain**, free, works on a free account).

## Alternative: Cloudflare Pages (code stays on GitHub)

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

## Search engines

`index.html` carries `noindex, nofollow` and `public/robots.txt` disallows
crawling. That does not restrict access in any way — the link works for anyone
you send it to — it just keeps a demo of invented employee records out of search
results. Delete both if you want it indexed.

## Regenerating the data

Nothing to do — the dataset is generated deterministically in the browser from a
fixed seed, so every visitor sees the same 50 employees and the same numbers.
Week boundaries are computed from the real current date, so the dashboard always
reads as "this week" no matter when the client opens it.
