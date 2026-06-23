## Why

Seer's Codemode agent calls the Sentry API on a user's behalf and can currently issue **any** mutating request (POST/PUT/PATCH/DELETE) without an explicit, per-operation human approval. To release Codemode we need a protocol-level guarantee — enforced on the Sentry side, not just by agent prompting — that an agent cannot perform writes until the user has explicitly granted permission for that class of operation.

This is the **Sentry-side** half of a two-repo project. The Seer-side counterpart (header injection, surfacing the approval prompt in the Seer chat widget, and retrying) is planned in the `seer` repo as `add-codemode-write-permission-flow`. The two share a wire contract (the `X-Is-Agent` header, the structured `403` challenge body, and the approval endpoint). This change is independently buildable and testable.

## Approach (decided)

Enforce by **masking the request's effective scopes to read-only** for agent traffic, then letting Sentry's existing `ScopedPermission` machinery deny the write. A short-lived **approval record** (not a token) restores specific write scopes. We deliberately do **not** mint per-request capability tokens: a per-request DB read of the approval record is acceptable; per-request credential minting is the cost we avoid, and masking means no write credential ever exists to leak or inject.

## What Changes

- Sentry recognizes agent-originated requests via `X-Is-Agent: true` **combined with** trusted Seer authentication (the signed `X-Viewer-Context` JWT). The header alone confers nothing.
- For agent requests, **effective scopes are masked to `SENTRY_READONLY_SCOPES`** at the single point where a request's `Access` is constructed (`access.from_request_org_and_scopes`). Mutating requests therefore fail authorization by default — reusing existing scope/permission behavior, mirroring the demo-mode read-only precedent.
- A masked-out write returns a **structured `403` challenge**: a stable JSON body with the required scope(s), a human-readable operation description, a `nonce`, and the approval endpoint path.
- A new **`AgentWriteGrant`** record stores a user's approval: it binds `(user, organization, scope set)` with an expiry and status. The request-time masking consults it so granted scopes are not stripped.
- A new **approval API** (no Sentry UI — the Seer chat widget calls it as the authenticated user):
  - `GET  /api/0/organizations/{org}/agent/approve/{nonce}/` → challenge details.
  - `POST /api/0/organizations/{org}/agent/approve/{nonce}/` → approve / decline.
- **Decided defaults:** grant lifetime = chat-session length (prototype: a fixed TTL); granularity = organization + scope; audit-log grant create/approve and each write performed under a grant; feature-flagged, **default off**.

## Capabilities

### New Capabilities

- `agent-request-gating`: Detect agent-originated requests, mask their effective scopes to read-only by default, and emit a structured `403` challenge for any operation whose required scope was masked and is not covered by an active grant.
- `agent-write-grant`: Persist, validate, and expire user approvals that grant an agent a specific set of write scopes for an organization; expose the user-authenticated approval API that creates a grant from a challenge `nonce`, with strict acting-user identity binding (IDOR-safe).

### Modified Capabilities

<!-- None: the masking hook reuses existing access/permission behavior without changing its contract for non-agent requests. -->

## Impact

- **Code:**
  - `src/sentry/auth/access.py` — `from_request_org_and_scopes()`: agent detection + read-only masking + grant consultation.
  - New `src/sentry/models/agentwritegrant.py` + migration.
  - New approval endpoint under `src/sentry/api/endpoints/` (org-scoped, user-authenticated) + URL registration.
  - Challenge shaping in the permission-denied path so the structured body is consistent.
  - Feature flag / option (default off).
- **No Sentry frontend** in this change — approval UI lives in the Seer chat widget, which calls the API above as the logged-in user.
- **Wire contract (shared with Seer):** `X-Is-Agent` request header; `403` challenge JSON schema; approval endpoint route.
- **Auth:** integrates with `ViewerContextAuthentication` (Seer's `X-Viewer-Context` path, where `request.auth is None` and scopes derive from the user's `OrganizationMember` role). The approval API uses normal user/session auth.
- **Security:** approval requires the authenticated user to _be_ the user the agent acts for (IDOR guard); grants are org- and user-scoped and time-boxed; request-time grant lookup keys off authenticated identity only, never client input.
- **Rollout:** flag-gated, off by default; enable per-org only once the Seer side handles challenges.
