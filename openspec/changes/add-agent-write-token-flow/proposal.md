## Why

The Seer agent acts against the Sentry API on a user's behalf. We need writes to be
explicitly approved by that user, without handing the agent the user's full authority.

A sibling change (`add-agent-write-permission-gate`) solves this by _masking_ the
caller's session scopes down to read-only inside the access layer. That works for
internal Seer traffic but bakes the gate into Sentry's permission internals and only
covers `ScopedPermission`-derived endpoints. This change explores the alternative the
team asked for: instead of magically narrowing the session, Sentry **issues the agent a
real, short-lived, scope-bound capability token** that the agent attaches to each
request. Enforcement then rides Sentry's ordinary token-scope path — nothing special in
the permission layer — and the same mechanism works for **external OAuth clients**, not
just internal Seer.

## What Changes

- **New token-mint endpoint** (`POST /api/0/organizations/{org}/agent/token/`) that
  returns a short-lived JWT capability token. The endpoint is safe to expose publicly:
  it only ever **de-escalates** the caller's own authority and is identity-bound.
- **Dual caller authentication on the mint endpoint**: internal Seer authenticates with
  `X-Viewer-Context` (existing trusted-service bridge); external clients authenticate
  with a standard OAuth bearer token. Both reuse the existing `DEFAULT_AUTHENTICATION`
  chain — no new caller-auth code.
- **Default token scopes = the caller's read-only scopes** (`SENTRY_READONLY_SCOPES` ∩
  what the caller actually holds), **plus** any write scopes covered by active,
  user-approved grants for this org + agent session.
- **New stateless token authentication class** (`AgentTokenAuthentication`) that verifies
  the JWT signature + expiry and feeds the embedded scopes through Sentry's normal
  `from_rpc_auth` / `_intersect_member_and_token_scopes` path to build `request.access`.
- **Ephemeral tokens are not stored.** They are verified by signature and `exp`; the
  agent re-mints on demand. Only **grants** persist in the DB.
- **Grants persist, tied to an agent session.** A write the token cannot satisfy returns
  a structured `403` challenge; the user approves via an API-only approval endpoint; the
  grant is recorded and folded into the next minted token.
- **Transport**: the agent sends the minted JWT as `Authorization: Bearer <jwt>` on data
  requests. `X-Viewer-Context` is used only on the mint call to prove identity.
- Feature-flagged (`organizations:seer-agent-token-flow`, default off); a no-op for all
  non-agent traffic.

This is a parallel prototype, not a replacement: it does not modify the
`add-agent-write-permission-gate` change.

## Capabilities

### New Capabilities

- `agent-token-issuance` — the mint endpoint, dual caller auth, de-escalation rules, and
  ephemeral/no-store semantics.
- `agent-token-authentication` — the stateless JWT auth class, the claim schema, the
  transport contract, and how token scopes become `request.access`.
- `agent-write-grant` — the persistent, session-bound grant model, the write challenge,
  and the IDOR-safe approval API.

### Modified Capabilities

None. (No accepted specs exist under `openspec/specs/` for this area yet.)

## Impact

- **New code**: `src/sentry/seer/agent_token.py` (mint + JWT encode/decode), an
  `AgentTokenAuthentication` class in `src/sentry/api/authentication.py`, a mint endpoint
  - approval endpoint under `src/sentry/seer/endpoints/`, a session-bound grant model +
    migration under `src/sentry/seer/`.
- **Reused, unchanged**: `sentry.utils.jwt`, `SEER_API_SHARED_SECRET` signing pattern,
  `DEFAULT_AUTHENTICATION`, `auth.access.from_rpc_auth`,
  `_intersect_member_and_token_scopes`, `SENTRY_READONLY_SCOPES`,
  `SENTRY_TOKEN_ONLY_SCOPES`.
- **Seer side** (separate change): obtain a token from the mint endpoint, cache it for its
  short lifetime, attach it as a bearer token, and render the `403` challenge as an
  approval prompt. Out of scope here.
- **No breaking changes**; gated behind a default-off flag.
