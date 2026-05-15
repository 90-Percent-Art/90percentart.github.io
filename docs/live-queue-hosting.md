# Live Queue Hosting

The public website can stay on GitHub Pages. GitHub Pages is static-only, so the
live queue API should run separately. The current low-cost target is Cloudflare
Workers with KV storage.

## Safety Model

- Public visitors can list jobs, preview SVGs, and submit SVGs.
- Public visitors cannot generate G-code or move the plotter.
- A submitter can delete their own job with a private delete token returned at
  submit time and stored in that browser's `localStorage`.
- The Pi app uses `ADMIN_TOKEN` to delete any job and update job status.
- The active queue is capped by `MAX_ACTIVE`, currently `10`.

## Cloudflare Setup

From `90percentart.github.io`:

```bash
npx wrangler login
npx wrangler kv namespace create QUEUE_KV
```

Paste the returned namespace id into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "QUEUE_KV"
id = "..."
```

Set the Pi/admin token:

```bash
npx wrangler secret put ADMIN_TOKEN
```

Deploy:

```bash
npx wrangler deploy
```

Cloudflare prints a Worker URL such as:

```text
https://pl0tb0t-queue.<account>.workers.dev
```

Use that as the Queue server URL in both:

- the public website queue settings
- the Pi app Print Queue panel

On the public website, leave the Queue key blank. On the Pi app, set the Queue
key to the same value used for `ADMIN_TOKEN`.

## API Shape

- `GET /jobs`
- `POST /jobs`
- `GET /jobs/:id`
- `GET /jobs/:id/svg`
- `DELETE /jobs/:id`
- `PATCH /jobs/:id/status`

`PATCH /status` requires `X-API-Key: <ADMIN_TOKEN>`.

`DELETE` accepts either:

- `X-Delete-Token: <submitter-token>` for the original submitter
- `X-API-Key: <ADMIN_TOKEN>` for the Pi/admin

