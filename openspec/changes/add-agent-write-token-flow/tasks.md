## 1. Scaffolding

- [x] 1.1 Add feature flag `organizations:seer-agent-token-flow` (FlagPole, default off).
- [x] 1.2 Pin the agent token TTL (prototype: 5 min), the `aud` value (`sentry-agent-api`), and the read-only mask set (`SENTRY_READONLY_SCOPES`).
- [x] 1.3 Choose the signing key: reuse `SEER_API_SHARED_SECRET` (HS256 via `sentry.utils.jwt`) with a distinct `aud`; leave room for a dedicated secret later.

## 2. Token encode/decode (stateless)

- [x] 2.1 Add `agent_token.py`: `encode_agent_token(...)` → JWT with `sub/org/scopes/sid/aud/iat/exp`. (Dropped `jti`/`act` for the prototype; deferred — see 9.1/9.4.)
- [x] 2.2 Add `decode_agent_token(jwt)` → validated claims; reject on bad signature, expired `exp`, wrong `aud`.
- [x] 2.3 Reuse `AuthenticatedToken(kind="api_token", ...)` directly as `request.auth` instead of a new wrapper — it already exposes `get_scopes()`/`organization_id` and flows through the standard path.

## 3. Mint endpoint

- [x] 3.1 Add `POST /api/0/organizations/{org}/agent/token/` (`OrganizationEndpoint`), feature-gated.
- [x] 3.2 Compute `caller_scopes`: viewer-context → member role scopes; OAuth → role scopes ∩ `request.auth` scopes (`_intersect_member_and_token_scopes`).
- [x] 3.3 Effective scopes = `caller_scopes ∩ (SENTRY_READONLY_SCOPES ∪ active_grant_scopes(user, org, session))`; honor `requested_scopes` only to narrow.
- [x] 3.4 Encode and return `{ token, expires_at }`; never read identity from the body; no DB write.
- [x] 3.5 Register the URL route.

## 4. Token authentication

- [x] 4.1 Add `AgentTokenAuthentication(StandardAuthentication)`: detect agent JWT (`accepts_auth`), verify, return `(user, AuthenticatedToken)`; defer (`accepts_auth -> False`) for non-agent credentials.
- [x] 4.2 Register it in `DEFAULT_AUTHENTICATION` **ahead of `UserAuthTokenAuthentication`** (both accept `Bearer`).
- [x] 4.3 Scopes flow through the authenticated-user token path (`from_request_org_and_scopes(scopes=request.auth.get_scopes())` → `_intersect_member_and_token_scopes`); no masking hook.

## 5. Grant model & storage

- [x] 5.1 Add `SeerAgentWriteGrant` (user_id, organization, `agent_session_id`, scope_list, nonce, status, operation, expires_at, approved_at); high-entropy nonce.
- [x] 5.2 Generate the migration (additive; correct silo placement; update lockfile).
- [x] 5.3 Helpers: `active_grant_scopes(user_id, org_id, session_id)`, `is_active()`, looked up strictly by authenticated identity.

## 6. Challenge & approval

- [x] 6.1 On a denied agent-token write, detect "denied only due to missing token scope" by comparing required scopes to the user's role scopes; mint a pending grant + structured `403`.
- [x] 6.2 Ordinary denial (no nonce) when the user's role genuinely lacks the scope.
- [x] 6.3 Add `POST /api/0/organizations/{org}/agent/approve/{nonce}/` + `GET` detail; first-party session only (reject viewer-context and agent tokens); identity-checked; no scope escalation.
- [x] 6.4 Register the approval route.

## 7. Tests (functional)

- [x] 7.1 Mint via viewer-context → read-only token; read succeeds; write 403-challenges.
- [x] 7.2 Mint via OAuth → scopes ∩ OAuth token scopes; cannot exceed delegation.
- [x] 7.3 Approve grant → re-mint includes write scope → write succeeds.
- [x] 7.4 Feature off / non-agent traffic unaffected; expired token rejected; wrong `aud` rejected.
- [x] 7.5 Session binding: grant for session A absent from session B's token.

## 8. Tests (IDOR / safety — security gate)

- [x] 8.1 Body cannot widen identity (foreign user_id/org_id in body ignored).
- [x] 8.2 Requested scopes cannot widen beyond caller authority.
- [x] 8.3 Different user cannot approve or read another user's nonce → `404`.
- [x] 8.4 Cross-org nonce rejected → `404`.
- [x] 8.5 Agent token / viewer-context cannot self-approve → `403`.
- [x] 8.6 Forged / unsigned / tampered JWT rejected.
- [x] 8.7 Token minted for org A is rejected against org B (org-bound; mirrors org-scoped token checks).

## 9. Rework: stateless challenge, persist grant on approval

Supersedes the create-`pending`-grant-on-deny behavior in §5/§6 (which writes to the DB
from the denial path — a client-driven write-amplification surface and an impure
permission check). The grant model and mint-time folding (§5.1 fields, §5.3 lookup) stay.

- [x] 9.1 Add a signed **challenge token**: encode/verify a JWT with audience `sentry-agent-approval` carrying `sub`/`org`/`scopes`/`sid`/`exp` (reuse `agent_token` JWT helpers).
- [x] 9.2 Change `maybe_challenge` to mint + return the challenge token in the structured `403` and **stop writing a grant row**; log the denied ask instead. Drop `_find_or_create_pending_grant`, `nonce`, and the `pending`/`declined` statuses from the model + migration.
- [x] 9.3 Rework the approval endpoint to `POST /api/0/organizations/{org}/agent/approve/` taking `{challenge, decision}`: verify signature/aud/exp; require first-party session; enforce `session_user == sub` and URL org == token `org`; on approve create the grant in `approved` state with the token's scopes; decline persists nothing. Remove the `nonce` route + GET-details handler.
- [x] 9.4 Update tests: deny writes nothing (assert no row); forged/expired/cross-user/cross-org challenge rejected; approve creates the approved grant; re-mint folds it in; end-to-end read→challenge→approve→write.
- [x] 9.5 Seer-side delta: send the `challenge` token back to the approval endpoint (instead of a `nonce`); surface the challenge details from the `403` body. Update `tests/experimental/mcp/test_agent_token.py` accordingly.

## 10. Deferred (post-prototype)

- [ ] 10.1 `jti` deny-list for pre-expiry revocation.
- [ ] 10.2 Dedicated signing secret separate from `SEER_API_SHARED_SECRET`.
- [ ] 10.3 Per-resource (per-project) scope narrowing.
- [ ] 10.4 Audit-log mint, challenge, approve, and writes performed under a token.
- [ ] 10.5 Decline-memory (opt-in persistence) to suppress re-prompting after a decline.
