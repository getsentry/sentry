# Biscuit Agent Tokens (Hackweek POC)

Asymmetric Ed25519 tokens (`sntryb_`) for AI agent sessions. Agents start read-only; write access requires explicit user approval in the browser.

## Local Development Setup

### 1. Generate Ed25519 keypair + enable feature flag

Generate a keypair:

```bash
cd ~/code/sentry
.venv/bin/python -c "
from biscuit_auth import KeyPair
kp = KeyPair()
print(f'BISCUIT_AGENT_ROOT_PRIVATE_KEY = \"{bytes(kp.private_key.to_bytes()).hex()}\"')
print(f'BISCUIT_AGENT_ROOT_PUBLIC_KEY = \"{bytes(kp.public_key.to_bytes()).hex()}\"')
"
```

Add the output plus the feature flag to `getsentry/conf/settings/devlocal.py`:

```python
# Biscuit agent tokens
SENTRY_FEATURES["organizations:agent-biscuit-token-flow"] = True
BISCUIT_AGENT_ROOT_PRIVATE_KEY = "<hex from above>"
BISCUIT_AGENT_ROOT_PUBLIC_KEY = "<hex from above>"
```

### 2. Start Sentry

```bash
devservices up
devservices serve
```

Verify at `http://dev.getsentry.net:8000`.

### 3. Create a Sentry OAuth application

Go to `http://dev.getsentry.net:8000/settings/account/api/applications/` and create a new application:

- **Name**: anything (e.g. "MCP Local")
- **Redirect URIs**: `http://localhost:5173/oauth/callback`
- **Scopes**: select the scopes you want available (e.g. `org:read`, `project:write`, `team:write`, `event:write`)

Save the **Client ID** and **Client Secret** for the next step.

### 4. Build and run the MCP server locally

The MCP server runs locally via Vite + Miniflare (nothing is deployed to Cloudflare). It handles the full flow: OAuth login → mint biscuit → use biscuit for API calls → elevation via browser URL.

```bash
cd ~/code/sentry-mcp
pnpm install
pnpm --filter @sentry/mcp-core run build
```

Create `packages/mcp-cloudflare/.dev.vars` (gitignored) — shell `export` doesn't work because miniflare/workerd reads env vars from this file, not the shell environment:

```
SENTRY_CLIENT_ID=<client-id-from-step-3>
SENTRY_CLIENT_SECRET=<client-secret-from-step-3>
COOKIE_SECRET=some-random-secret
SENTRY_HOST=dev.getsentry.net:8000
SENTRY_INSECURE_HTTP=1
BISCUIT_AGENT_TOKENS=1
```

Then start the server:

```bash
cd packages/mcp-cloudflare
pnpm run dev
```

### 5. Connect Claude Code

Add the local MCP server to `.mcp.json` in the sentry repo root (or `~/.claude.json` under the project key):

```json
{
  "mcpServers": {
    "sentry-local": {
      "type": "http",
      "url": "http://localhost:5173/mcp/<your-org-slug>"
    }
  }
}
```

Restart Claude Code. It will trigger the OAuth flow in your browser against your local Sentry instance.

### Alternative: Stdio transport with `--biscuit-mode`

Instead of the Cloudflare HTTP flow, you can run the MCP server as a stdio subprocess. This avoids the OAuth/Miniflare setup and uses the v2 SDK's `inputRequired()` for URL elicitation (browser auto-opens on elevation).

Steps 1–2 above (keypair + devserver) are still required.

```bash
cd ~/code/sentry-mcp
pnpm install
pnpm --filter @sentry/mcp-core run build
pnpm --filter @sentry/mcp-server run build
```

Add a stdio entry to `.mcp.json` in the sentry repo (or `~/.claude.json`):

```json
{
  "mcpServers": {
    "sentry-stdio": {
      "command": "pnpm",
      "args": [
        "--dir",
        "/path/to/sentry-mcp/packages/mcp-server",
        "start",
        "--biscuit-mode",
        "--organization-slug",
        "default",
        "--host",
        "dev.getsentry.net:8000",
        "--insecure-http"
      ]
    }
  }
}
```

On first connect, the server runs device-code auth to get a regular Sentry token, then mints a biscuit from it automatically. Write operations trigger `inputRequired()` URL elicitation — the client opens the approval page in the browser, and the tool call succeeds after approval without a manual retry.

## Architecture

```
Bootstrap:  MCP OAuth → sntryu_ (transient) → mint sntryb_ → discard sntryu_
Read:       Agent → Sentry API (Bearer sntryb_) → 200
Write:      Agent → Sentry API (Bearer sntryb_) → 403 + WWW-Authenticate header
            → MCP parses required scope(s) from WWW-Authenticate
            → Creates elevation request with only needed scope(s)
            → Throws -32042 UrlElicitationRequiredError
            → Client auto-opens approval URL in browser
            → User sees: current scopes (green), requesting (amber), max (gray)
            → User approves → MCP picks up elevated biscuit via refresh
            → Client auto-retries tool call → 200
Decay:      ~5 min → auto-refresh → back to baseline (read-only)
```

Key properties:

- `sntryu_` is transient — used once to mint biscuit, then discarded
- Elevated biscuit goes Sentry → MCP server directly (never in LLM context)
- `max_scopes` baked into authority block at bootstrap, immutable for the session
- Refresh endpoint always mints baseline — elevated scopes silently drop
- Scoped elevation: only the specific scope(s) the endpoint needs are requested (not all maxScopes)
- Scopes stored as Biscuit facts in the authority block — no database lookup on verification

## Files

### Sentry backend (`src/sentry/agent/`)

- `biscuit_token.py` — mint, verify, prefix routing
- `elevation.py` — cache-based elevation requests (Redis, 2-min pending / 5-min approved TTL)
- `endpoints/organization_biscuit_token.py` — mint endpoint
- `endpoints/organization_biscuit_token_refresh.py` — refresh endpoint (auto-decay)
- `endpoints/organization_biscuit_elevation.py` — create + poll elevation
- `../web/frontend/agent_elevation.py` — browser approval view with `SCOPE_LABELS`, three scope categories
- `../templates/sentry/agent-elevate.html` — styled consent page (active/requesting/max scopes, anti-clickjacking)

### MCP server (`sentry-mcp` repo, branch `feat/biscuit-agent-tokens`)

- `packages/mcp-core/src/auth/biscuit-token-manager.ts` — token lifecycle + pending elevation tracking
- `packages/mcp-core/src/api-client/errors.ts` — `ApiPermissionError.requiredScopes`, `parseScopesFromWwwAuthenticate()`, `isApiPermissionErrorDeep()`
- `packages/mcp-core/src/api-client/client.ts` — passes `WWW-Authenticate` header to error factory
- `packages/mcp-core/src/server.ts` — 403 → scoped elevation → `-32042` URL elicitation or `inputRequired()`
- `packages/mcp-cloudflare/src/server/oauth/routes/callback.ts` — biscuit minting at OAuth bootstrap

### Config

- `src/sentry/conf/server.py` — `BISCUIT_AGENT_ROOT_PRIVATE_KEY` / `BISCUIT_AGENT_ROOT_PUBLIC_KEY`
- `src/sentry/features/temporary.py` — `organizations:agent-biscuit-token-flow`
