## Context

Seer Codemode is an MCP server (`seer/src/seer/experimental/mcp/`) that executes agent-written Python which calls the Sentry API. Every call funnels through one chokepoint, `_SentryHttpBase.request()` in `_sentry_client.py`, and Seer forwards the caller's `Authorization` / `X-Viewer-Context` headers. Today there is no GET/POST distinction and no gating.

On the Sentry side, authorization flows through a few well-defined points:

- **Auth resolution** (`src/sentry/api/authentication.py`): `ViewerContextAuthentication` (used by Seer) validates the `X-Viewer-Context` JWT with `SEER_API_SHARED_SECRET` and returns `(user, None)` — `request.auth is None`, so scopes derive from the user's `OrganizationMember` role.
- **Scope assembly** (`src/sentry/auth/access.py`): `from_request_org_and_scopes()` is the single function through which viewer-context, session, and token requests all build their effective scope set. **Demo mode already mutates member scopes to a read-only set here** — a direct precedent.
- **Scope enforcement** (`src/sentry/api/permissions.py`): `ScopedPermission.scope_map` maps HTTP method → required scopes; `has_permission()` checks the request's scopes against that map.
- **Scope constants** (`src/sentry/conf/server.py`): `SENTRY_READONLY_SCOPES = {org:read, member:read, team:read, project:read, event:read, alerts:read}` already exists.
- **Grant precedent** (`src/sentry/models/apigrant.py`): `ApiGrant` is a nonce (`code`), `expires_at`, `scopes`, org binding — a near-exact template for a short-lived approval record.

## Goals / Non-Goals

**Goals:**

- Enforce, on the server, that agent-originated mutating requests are denied unless an explicit, unexpired user grant covers the required scope.
- Reuse the existing scope/permission system (mask effective scopes) rather than building a parallel allowlist.
- Emit a structured `403` challenge so the Seer chat widget can drive a user-approval flow.
- Make approval IDOR-safe: only the user the agent acts for can approve.
- Ship a thin, fully tested prototype behind a flag; default off.

**Non-Goals:**

- Minting per-request capability tokens (considered; rejected — masking creates no credential and a per-request grant _read_ is cheap).
- Any Sentry-hosted approval UI — the approval widget lives in the Seer chat; Sentry exposes only an API.
- Changing authorization behavior for non-agent (human/session/token) requests.
- A permanent "agent can always write" org toggle (deferred).
- Read gating — agent reads remain allowed (subject to the user's role).
- The Seer-side header injection, widget, and retry (separate change).

## Decisions

### Decision 1: Mask scopes in `access.from_request_org_and_scopes()`

Reduce an agent request's effective scopes to read-only at the one place all auth paths build `Access`, then let the existing `ScopedPermission` deny the write. A grant lookup adds back approved write scopes. Reuses `SENTRY_READONLY_SCOPES` and mirrors the demo-mode precedent; works identically for viewer-context and token auth; no parallel route map to maintain.

### Decision 2: Grant granularity = scope set, scoped to organization, time-boxed

A grant covers a set of scopes for `(user, organization)` with an `expires_at`. Prototype gates a single scope (`project:write`) to keep the surface small; the model carries a scope list so more can be added without a contract change. Lifetime defaults to the chat-session length (prototype: a fixed TTL, configurable). Resource-level narrowing (per-project) is deferred.

### Decision 3: `AgentWriteGrant` model, modeled on `ApiGrant`

Dedicated model so agent semantics stay isolated from OAuth grant flows. Draft fields: `user`, `organization_id`, `scope_list`, `nonce`, `status` (`pending` → `approved`/`declined`/`expired`), `created_at`, `approved_at`, `expires_at`, and an operation description for audit. Lifecycle: challenge mints a `pending` grant keyed by nonce → user approves via API → `approved` + `expires_at` → masking consults active approved grants for `(user, org)`.

### Decision 4: Structured `403` challenge body (shared wire contract)

When a write is denied _because of agent masking_ (not because the user genuinely lacks the role), return `403` with a stable body, e.g.:

```json
{
  "detail": "agent_write_permission_required",
  "agent_permission": {
    "required_scopes": ["project:write"],
    "operation": "Update issue status",
    "organization": "my-org",
    "nonce": "…",
    "approval_endpoint": "/api/0/organizations/my-org/agent/approve/<nonce>/",
    "expires_at": "2026-06-20T12:34:56Z"
  }
}
```

If the user's own role lacks the scope, return an ordinary denial with **no** nonce/approval path — granting can't exceed the user's role.

### Decision 5: Approval is a user-authenticated API, no Sentry UI

The Seer chat widget runs in the user's authenticated Sentry session and calls:

- `GET  /api/0/organizations/{org}/agent/approve/{nonce}/` → challenge details.
- `POST /api/0/organizations/{org}/agent/approve/{nonce}/` → approve / decline.

Both authenticate as the **normal logged-in user** (session/user token), not the agent. The agent's masked request and the user's approval are _separate_ requests linked only by the nonce + `user_id`. Route uses no dashes per convention (`agent/approve/{nonce}`).

### Decision 6: IDOR is the primary security property

The two dangerous spots, and their guards (each becomes a test):

1. **Request-time grant lookup** — query grants strictly by the `user_id` + `organization_id` from the _authenticated_ context (viewer-context / `request.access`), never from client-supplied URL/body/header. Prevents agent-for-A riding B's grant, and cross-org reuse.
2. **Approval endpoint** — approving requires `grant.user_id == request.user.id`. Org membership is **not** sufficient (a different member must not approve your grant). The endpoint is org-scoped so `grant.organization_id` must match the URL org. Approval cannot escalate beyond the challenged scopes or the user's role. `GET` enforces the same identity match so it can't leak another user's pending operations. The nonce is high-entropy, but identity binding — not nonce secrecy — is the control.

### Decision 7: Where the challenge is emitted

Prefer the permission-denied path (`SentryPermission`/`ScopedPermission`), which knows the required scopes for this endpoint+method and can populate `required_scopes` precisely and detect "denied only due to masking" by comparing against the user's unmasked role scopes. A response-shaping middleware is the fallback.

## Risks / Trade-offs

- **Distinguishing masked denial from genuine role-lack** → only emit a challenge when removing the mask _would_ have allowed the request (compute against unmasked member scopes).
- **Write paths bypassing `ScopedPermission`** (custom permission classes) → audit them; for the prototype, pair masking with a defense-in-depth check that denies agent mutating methods lacking a covering grant; alert on agent writes that skip scope checks.
- **Header spoofing (`X-Is-Agent`)** → masking only _removes_ privileges, so spoofing only downgrades the spoofer. Detection requires trusted Seer auth in addition to the header; ingress must prevent external callers stripping/forging it (as with `X-Viewer-Context` today).
- **Stale grant after role change** → grants are short-lived; masking re-checks per request, so a role downgrade takes effect on the next request.
- **Two-repo rollout ordering** → flag-gated, off by default; enable Sentry gate only after Seer handles challenges.

## Migration Plan

1. Add option `seer.agent-write-gate.enabled` (default off).
2. Ship `AgentWriteGrant` model + migration (additive, no backfill).
3. Add masking hook consulting grants.
4. Add challenge emission in the denied path.
5. Add approval API (GET/POST) with IDOR guards.
6. Land the test suite (functional + IDOR).
7. Integration-test against the Seer change; roll out per-org via flag.

- **Rollback:** disable the option → masking skipped → agents behave as today; grant table is inert.

## Open Questions (mostly resolved)

- Resource-level narrowing (per-project) beyond scope+org — deferred to a later iteration.
- Exact grant TTL value for "session length" — pick a concrete prototype default (e.g. a few hours) and revisit with product.
- Whether agent-detection should additionally require a dedicated signing path vs. reusing viewer-context — prototype reuses viewer-context + header; revisit if Security wants stronger binding.
