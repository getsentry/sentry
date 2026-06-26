# Design

## Context

The agent needs to make Sentry API calls on a user's behalf, read-only by default and
write only with explicit per-session user approval. Two shapes were considered:

- **Scope-masking** (sibling change `add-agent-write-permission-gate`): at permission
  time, rewrite `request.access` to read-only for marked agent traffic and re-add scopes
  the user has granted. No credential exists; the gate lives inside the access layer.
- **Capability token** (this change): Sentry mints a short-lived, signed token carrying
  exactly the scopes the agent is allowed right now. The agent presents it like any other
  bearer token; enforcement is the ordinary token-scope path.

This change pursues the capability-token shape because it (a) keeps the gate out of
Sentry's permission internals, (b) produces an auditable, time-boxed credential, and
(c) extends to **external OAuth clients** using the same machinery — not just internal
Seer over `X-Viewer-Context`.

## Goals / Non-Goals

**Goals**

- A mint endpoint that is safe to expose publicly and only ever de-escalates.
- A stateless, short-lived token; no per-token DB row.
- Writes gated behind persistent, user-approved, session-scoped grants.
- Reuse Sentry's existing JWT, auth-chain, and scope-intersection machinery.
- IDOR-safe: scopes derive from the authenticated caller, never from request input.

**Non-Goals**

- Token revocation before expiry (the short TTL is the bound; deny-list is deferred).
- Per-resource (per-project) scoping; scopes stay role-level for the prototype.
- The Seer-side client (separate change).
- Replacing or modifying the scope-masking change.

## Key entities

1. **Ephemeral agent token** — a Sentry-signed JWT. **Not stored.** Claims:
   - `sub`: acting user id
   - `org`: organization id (token is single-org)
   - `scopes`: the exact effective scope list (already de-escalated at mint time)
   - `sid`: agent session id (the chat session the token belongs to)
   - `aud`: a fixed audience (`sentry-agent-api`) so the token can't be replayed elsewhere
   - `iat`, `exp`: issued-at and a short expiry (prototype: 5 minutes)
   - `jti`: unique id (for future deny-list / audit correlation)
   - `act`: how the caller authenticated to mint (`viewer_context` | `oauth`) — for audit
2. **Grant** — a persistent DB record (`SeerAgentWriteGrant`): a user's standing approval
   that the agent may hold specific write scopes for one org **and one agent session**,
   with its own TTL. This is the only thing written to the DB. (Same model as the sibling
   change, plus an `agent_session_id` column.)

## Decisions

### Decision 1 — Why the mint endpoint is safe to be public (curveball a)

The endpoint can be reached by anyone, because it cannot be used to gain anything the
caller does not already have:

- **De-escalation only.** Effective scopes = `caller_scopes ∩ (SENTRY_READONLY_SCOPES ∪
active_grant_scopes)`. `caller_scopes` is the authenticated caller's own authority:
  - internal Seer (`X-Viewer-Context`): the acting user's role scopes for the org;
  - external OAuth: the user's role scopes **further intersected with the OAuth token's
    scopes** (`_intersect_member_and_token_scopes`), so a delegated client can never
    exceed what it was delegated.
    The minted token is therefore always a subset of the caller's authority.
- **Identity-bound, not input-bound.** `sub`/`org` come from the authenticated request,
  never from the body. The body carries only the agent `session id` and an optional
  _requested_ scope list, both of which can only **narrow** the result.
- **Writes need a prior grant.** With no active grant the token is read-only, so an
  unauthenticated-but-curious caller gains nothing, and an authenticated caller gains
  exactly their own read access.
- **Audience + short TTL** bound replay. The token is only valid against the Sentry agent
  API and only for minutes.

"Public" thus means _no special network ACL is required_; the endpoint is self-protecting.
The two caller types are handled by the **existing** `DEFAULT_AUTHENTICATION` chain:
`ViewerContextAuthentication` matches internal Seer, `UserAuthTokenAuthentication`
matches the OAuth bearer. The endpoint reads `request.user` (always) and `request.auth`
(present and scope-bearing for OAuth, `None` for viewer-context) and computes scopes
accordingly.

### Decision 2 — Transport: a separate Bearer token, not an extended X-Viewer-Context (curveball b)

The agent obtains the JWT from the mint endpoint and sends it on data requests as
`Authorization: Bearer <jwt>`. `X-Viewer-Context` is used **only** on the mint call.

Rejected alternative — stuffing the minted JWT into the `X-Viewer-Context` payload (the
`ViewerContext` dataclass already has an unused `token` field): it conflates "prove who
the caller is" with "carry the scoped capability," forces every data endpoint through the
viewer-context path, and means the capability rides a header whose job is identity echo.
A standalone bearer is a self-contained capability, slots into the existing bearer auth
path with no endpoint changes, and cleanly separates identity (mint time) from authority
(request time).

The bearer is a **JWT, not an `ApiToken` row.** A new `AgentTokenAuthentication` class
(registered in `DEFAULT_AUTHENTICATION` ahead of `SessionAuthentication`) recognizes the
agent JWT, verifies signature + `exp` + `aud`, and returns
`(user, AgentAccessToken(scopes, org))` — a lightweight `AuthenticatedToken`-shaped object
exposing `get_scopes()` and `organization_id`. Because `request.auth` is then set,
`auth.access.from_rpc_auth` runs the normal token path and intersects the JWT scopes with
the member's role scopes (harmless belt-and-suspenders: the JWT scopes are already a
subset). No masking, no permission-layer hooks.

### Decision 3 — Don't store the token; do store grants (curveball c)

The token is verified purely from its signature and claims, so there is no reason to
persist it: re-minting is a cheap signed-JWT operation and the agent caches the token for
its short life. Persisting tokens would only add a write per mint and a revocation
surface we don't need at a 5-minute TTL.

Grants **must** persist — they are the durable record of user consent and they outlive any
single token. Grants are bound to `(user_id, organization_id, agent_session_id)`. The
session binding means an approval in one chat does not silently empower a different chat.
At mint time we union the scopes of active (approved, unexpired) grants for that exact
triple. `agent_session_id` is client-supplied but only ever **narrows** the grant lookup,
which is already filtered by the authenticated `user_id` — so it cannot be used to read
another user's grants.

### Decision 4 — Signing key

Reuse the HS256 + `SEER_API_SHARED_SECRET` pattern already used by `X-Viewer-Context`
(via `sentry.utils.jwt`). A dedicated `aud` claim and a distinct internal token "type"
marker keep agent tokens from being confused with viewer-context JWTs even though they
share a secret. A separate secret can be introduced later without changing the shape.

### Decision 5 — Challenge & approval reuse the sibling change's design

The `403` challenge body, the pending-grant creation, and the API-only approval endpoint
(`POST /api/0/organizations/{org}/agent/approve/{nonce}/`, first-party-session-only to
prevent the agent self-approving) are carried over unchanged in spirit from
`add-agent-write-permission-gate`, with grants additionally carrying `agent_session_id`.
The one structural difference: the challenge is raised by the **ordinary scope check on a
token request** (the JWT simply lacks the write scope), not by a masking hook. We add a
small permission helper that, on a denied agent-token write, emits the structured
challenge instead of a bare `403`.

## Flow

```
1. Agent → POST /organizations/{org}/agent/token/        (X-Viewer-Context OR OAuth bearer)
           body: { session_id, requested_scopes? }
   Sentry: scopes = caller_scopes ∩ (READONLY ∪ active_grants(user,org,session))
           returns { token: <jwt>, expires_at }              [no DB write]

2. Agent → GET  /organizations/{org}/issues/   Authorization: Bearer <jwt>   → 200 (read ok)

3. Agent → PUT  /organizations/{org}/issues/   Authorization: Bearer <jwt>
   Sentry: token lacks issue write → structured 403 challenge { nonce, approval_endpoint }
           + pending grant row (user, org, session, scopes)

4. User  → POST /organizations/{org}/agent/approve/{nonce}/  (first-party session)
   Sentry: grant.status = approved (identity-checked, no escalation)

5. Agent → POST /organizations/{org}/agent/token/  → new jwt now includes the write scope

6. Agent → PUT  /organizations/{org}/issues/  Authorization: Bearer <jwt>  → 200 (write ok)
```

## Risks / Trade-offs

- **More moving parts than masking**: a mint endpoint, a JWT schema, and a new auth class
  vs. a single access-layer hook. Accepted because it generalizes to external clients and
  keeps the permission layer untouched.
- **No instant revocation**: a leaked token is valid until `exp`. Bounded by the short TTL;
  a `jti` deny-list is deferred.
- **Stateless scopes can go stale**: if a grant is revoked mid-token-life, the token keeps
  its scope until expiry. Acceptable at minutes-long TTL; documented.
- **Clock skew** on `exp`/`iat`: use a small leeway, as elsewhere in `utils.jwt`.

## Migration / Compatibility

Additive. New endpoints, one new auth class appended to the default chain (returns `None`
for any non-agent token, so existing auth is unaffected), one new model + migration. The
whole path is inert unless the feature flag is on **and** the request carries an agent
token. No change to existing tokens, sessions, or the sibling masking change.
