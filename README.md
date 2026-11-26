# Agentic Drive

A single-owner file drive on Cloudflare's free tiers, made to sit next to
[agentic-inbox](../agentic-inbox). Files live in R2, folders and share links
in a Durable Object's SQLite database, and the whole app is behind Cloudflare
Access. The inbox talks to it over a Worker service binding, so it can save
attachments to Drive and send big files as links.

## Features

- Folders, upload (button or drag and drop anywhere), download, rename, move.
- Files up to 5 GB: the browser uploads 50 MiB parts through an R2 multipart
  upload, so no request comes near the 100 MB request cap. Progress, cancel,
  and retry per part.
- Preview for images, video, audio, PDF and text, with Range requests so video
  seeks and big PDFs open fast.
- Share links: `https://<host>/s/<token>`, with an expiry (7 days to 1 year,
  or never), a download counter, and a revoke button. Anyone with the link can
  download; everything else needs the owner's Access login.
- Search by name, trash with restore (deleted for good after 30 days), and a
  storage meter against R2's 10 GB free allocation.
- Dark mode; works on phones.

## Free-tier limits

| Thing | Limit | Where it comes from |
|---|---|---|
| Storage | 10 GB-month free | R2 |
| Downloads | Free (no egress fees); 10 M reads/month | R2 |
| One file | 5 GB (set in `shared/limits.ts`) | This app |
| One request | 100 MB, so uploads go in 50 MiB parts | Zone plan |
| Worker CPU | 10 ms/request; bytes are streamed, never buffered | Workers Free |

## How the inbox uses it

`workers/service.ts` exports `DriveService`, a `WorkerEntrypoint`. The inbox
binds it in its `wrangler.jsonc`:

```jsonc
"services": [{ "binding": "DRIVE", "service": "agentic-drive", "entrypoint": "DriveService" }]
```

Methods: `info`, `list`, `search`, `getItem`, `saveFile` (a stream into a
folder path such as `["From email"]`), `beginUpload` / `uploadPart` /
`completeUpload` / `abortUpload`, and `createShareLink`. Service bindings stay
inside Cloudflare and can't be called from the internet.

## Setup

1. `npm install`
2. Create the bucket: `npx wrangler r2 bucket create agentic-drive`
3. Zero Trust → Access → Applications:
   - a self-hosted app for `drive.<your domain>` with an allow policy for your
     email; put its **Application Audience (AUD) tag** in `POLICY_AUD` in
     `wrangler.jsonc`. Keep it a separate app from the inbox's: Access's team
     session already means one sign-in covers both, and a shared app would make
     every Mail login hop through the Drive hostname too;
   - a second self-hosted app for `drive.<your domain>/s` with a **Bypass**
     policy for Everyone, so share links open without a login.
4. Set `PUBLIC_URL` and the `routes` pattern in `wrangler.jsonc` to your host.
5. `npm run deploy`

## Development

```bash
npm run dev        # Access is skipped in dev
npm test           # Workers runtime tests (vitest + @cloudflare/vitest-plugin)
npm run typecheck
```

## Security notes

- Every request except `/s/*` needs a valid Access JWT for a person (service
  tokens are refused).
- Files are served with `X-Content-Type-Options: nosniff` and a sandbox CSP, and
  HTML, SVG, XML and JavaScript are always downloads, so an uploaded file can't
  run script on the Drive origin.
- Share tokens are 24 random bytes. Share pages send `noindex` and
  `no-referrer`. Trashing a file turns its links off at once.
