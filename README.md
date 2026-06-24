# AgentGate

A lightweight, self-hosted encrypted diff & file sharing tool. Rewritten in Go from [diff4](https://github.com/djyde/diff4).

Single binary, SQLite storage, zero external dependencies. All content is encrypted end-to-end with AES-256-GCM — the server never sees plaintext.

## How it works

1. **Encrypt locally** — diffs and files are encrypted with AES-256-GCM on your machine before upload. The server never sees plaintext.
2. **Share a link** — get a URL like `your-server.com/p/ABC123`. Recipients need the passphrase to decrypt.
3. **Auto-expiry** — all content expires after 7 days by default; upload commands can override TTL.
4. **Owner controls** — every new upload also returns a private Manage URL with an owner token. Open it to toggle whether a share should be kept indefinitely.

## Features

- End-to-end encrypted diff and file sharing
- Local CLI for sharing latest commits, staged changes, or arbitrary files
- Configurable TTL per upload (`30m`, `24h`, `7d`, etc.)
- `--no-expiry` uploads for shares that should be preserved from the start
- Private Manage URL (`#owner=...`) for toggling indefinite retention after upload
- Expiry badges in the web UI, including a preserved/permanent state
- Markdown rendering for shared `.md` files

## Quick start

### Run the server

```bash
# Single binary
./agentgate-server --port 8080 --base-url https://your-domain.com

# Or with Docker
docker compose up -d
```

### Use the CLI

```bash
# Set your server URL (required)
export AGENTGATE_SERVER=https://your-domain.com

# Set up encryption key (first time only)
agentgate key-gen
source ~/.zshrc   # or ~/.bashrc

# Share your latest commit diff
agentgate git-latest

# Share staged changes
agentgate git-staged

# Share arbitrary files
agentgate files src/foo.ts src/bar.ts

# Share a runnable static webapp (a directory containing index.html)
agentgate webapp ./dist

# Share an encrypted visual plan (plan.mdx / plan.md or a folder)
agentgate plan ./plans/my-plan

# Share with custom TTL
agentgate files -t 24h src/foo.ts
agentgate files -t 7d src/foo.ts

# Share without expiry
agentgate files --no-expiry src/foo.ts
```

## CLI commands

| Command | Description |
|---------|-------------|
| `agentgate key-gen [key]` | Generate or set encryption passphrase |
| `agentgate key-get` | Print current passphrase |
| `agentgate git-latest` | Encrypt & share the latest commit diff |
| `agentgate git-staged` | Encrypt & share staged changes |
| `agentgate files <paths...>` | Encrypt & share file contents |
| `agentgate webapp <dir>` | Encrypt & share a runnable static webapp |
| `agentgate plan <file\|dir>` | Encrypt & share a visual plan bundle at `/plan/{id}` |

All upload commands accept `-s, --server <url>`, `-p, --passphrase <key>`, `-t, --ttl <duration>`, and `--no-expiry` flags. TTL examples: `30m`, `24h`, `7d`.

`--no-expiry` is mutually exclusive with `-t/--ttl`.

## Sharing a visual plan

`agentgate plan <file|dir>` encrypts a `plan.mdx`, `plan.md`, or plan folder and returns a **Plan URL** at `/plan/{id}`. After the recipient enters the passphrase, the bundle is decrypted in the browser and rendered as a reviewable Markdown/MDX-style visual plan.

This first version is designed for Agent-Native-style `/visual-plan` output in local-files form: `plan.mdx` is used as the entry document when present, with a sidebar showing the rest of the bundled files. The server stores only encrypted data; plan text is never visible server-side.

## Sharing a webapp

`agentgate webapp <dir>` encrypts a directory of static files (the same end-to-end encryption as `files`) and returns an **App URL** at `/app/{id}`. After the recipient enters the passphrase, the bundle is decrypted in the browser, assembled into a single self-contained page, and run inside a sandboxed `<iframe>`.

The directory must contain `index.html` at its root. Referenced local stylesheets and scripts (`<link href>`, `<script src>`) are inlined; local `<img>`/SVG references become data URIs.

Limitations (this is for sharing runnable prototypes, not hosting a site):

- **Text assets only.** HTML/CSS/JS/SVG survive; binary assets (PNG, fonts, etc.) are skipped with a warning — embed them as data URIs or external URLs.
- **Opaque origin.** The iframe runs without `allow-same-origin`, so `localStorage`, cookies, and same-origin `fetch` are unavailable to the app by design.
- The same record is also viewable as a plain file bundle at `/f/{id}`, and the Manage URL controls retention for both views.

Successful uploads print both a public Preview URL and, on supported servers, a private Manage URL:

```text
Preview URL: https://your-domain.com/f/ABC123
Manage URL:  https://your-domain.com/f/ABC123#owner=<owner-token>
```

Keep the Manage URL private. Anyone with this URL can toggle indefinite retention for that share.

If the server returns a `localhost`/`127.0.0.1` link (because its `--base-url` was left at the default) the CLI rewrites the scheme and host to match the `-s`/`AGENTGATE_SERVER` address you uploaded to, so the printed links stay usable.

## CLI environment variables

| Env | Flag | Description |
|-----|------|-------------|
| `AGENTGATE_SERVER` | `-s, --server` | Server URL (required) |
| `AGENTGATE_PASSPHRASE` | `-p, --passphrase` | Encryption passphrase |
| — | `-t, --ttl` | Optional share lifetime, e.g. `24h`, `7d`, `30m`. Default: `7d` |
| — | `--no-expiry` | Create the share with indefinite retention enabled |

## Managing expiry

AgentGate creates an owner token for each new share and stores only its SHA-256 hash server-side. The token is returned once as part of the Manage URL fragment:

```text
https://your-domain.com/f/ABC123#owner=<owner-token>
```

When this URL is opened in the browser, the page shows a **永久保留** toggle. Turning it on sets the share to never expire; turning it off restores normal expiration. If the previous deadline is already in the past, the server resets expiration to the default 7 days.

The same operation is available through authenticated PATCH endpoints:

```bash
curl -X PATCH https://your-domain.com/api/files/ABC123 \
  -H "Authorization: Bearer <owner-token>" \
  -H "Content-Type: application/json" \
  -d '{"never_expires":true}'
```

Use `/api/diff/{id}` for diff shares and `/api/files/{id}` for file shares.

## Server options

| Flag | Env | Default | Description |
|------|-----|---------|-------------|
| `--port` | `PORT` | `8080` | HTTP port |
| `--db` | `DATABASE_PATH` | `./agentgate.db` | SQLite database path |
| `--base-url` | `BASE_URL` | `http://localhost:8080` | Public base URL for shared links |

## Deployment

### Docker Compose

```yaml
services:
  agentgate:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - data:/data
    environment:
      BASE_URL: https://your-domain.com

volumes:
  data:
```

### systemd

```ini
[Unit]
Description=AgentGate server

[Service]
ExecStart=/usr/local/bin/agentgate-server --db /var/lib/agentgate/agentgate.db --base-url https://your-domain.com
Restart=always

[Install]
WantedBy=multi-user.target
```

## Security

- **AES-256-GCM** encryption
- **PBKDF2-SHA256** key derivation with 600,000 iterations
- Client-side encryption only — the server stores ciphertext
- Passphrase shared out-of-band by you
- Owner tokens are returned once and stored only as SHA-256 hashes
- Manage URLs use URL fragments (`#owner=...`), so owner tokens are not sent to the server during normal page loads
- All content auto-expires after 7 days by default, with per-upload TTL override or explicit no-expiry mode

## Tech stack

- **Server** — Go, Chi router, SQLite (pure Go, no CGO), embedded static assets
- **CLI** — Go, cross-compiled to single binaries
- **Frontend** — Vanilla JS, diff2html, highlight.js, marked.js

## Project structure

```
cmd/server/        Server entry point
cmd/agentgate/     CLI entry point
internal/server/   HTTP handlers, router, middleware
internal/db/       SQLite database layer
internal/crypto/   AES-256-GCM encryption
internal/id/       ID generation
internal/cleanup/  Expired content cleanup
web/templates/     HTML templates
web/static/        CSS, JS, vendor libraries
```

## Building from source

```bash
# Build both binaries
make build

# Cross-compile for all platforms
make release

# Build Docker image
make docker
```

## Credits

Rewritten in Go from [diff4](https://github.com/djyde/diff4) by [Randy Lu](https://x.com/randyloop). The original project is built with Next.js, PostgreSQL, and Prisma. This rewrite replaces the stack with Go + SQLite for a lighter, single-binary self-hosted deployment.
