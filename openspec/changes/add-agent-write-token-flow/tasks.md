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

## 9. Deferred (post-prototype)

- [ ] 9.1 `jti` deny-list for pre-expiry revocation.
- [ ] 9.2 Dedicated signing secret separate from `SEER_API_SHARED_SECRET`.
- [ ] 9.3 Per-resource (per-project) scope narrowing.
- [ ] 9.4 Audit-log mint, challenge, approve, and writes performed under a token.
- [ ] 9.5 Seer-side change: obtain/cache/attach token; render challenge as approval prompt.
