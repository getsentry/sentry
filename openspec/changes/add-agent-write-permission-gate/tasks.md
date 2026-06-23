## 1. Scaffolding

- [x] 1.1 Add option `seer.agent-write-gate.enabled` (default off).
- [x] 1.2 Add agent-detection helper: `X-Is-Agent` header AND trusted Seer auth (viewer-context), usable from the access layer.
- [x] 1.3 Pin prototype scope set to gate (`project:write`) and the read-only mask set (`SENTRY_READONLY_SCOPES`).

## 2. Grant model & storage

- [x] 2.1 Add `AgentWriteGrant` model (`user`, `organization_id`, `scope_list`, `nonce`, `status`, `created_at`, `approved_at`, `expires_at`, `operation`) modeled on `ApiGrant`; high-entropy nonce.
- [x] 2.2 Generate migration (additive; correct silo placement).
- [x] 2.3 Helpers: `create_pending(user, org, scopes, operation)`, `approve(by_user)` (identity-checked), `decline(by_user)`, `is_active()`, `active_scopes_for(user_id, org_id)`.

## 3. Scope masking (core enforcement)

- [x] 3.1 In `from_request_org_and_scopes()`, mask effective scopes to read-only for agent requests when the gate is on (mirror demo-mode read-only).
- [x] 3.2 Consult active approved grants — looked up strictly by authenticated `user_id` + `organization_id` — so granted scopes are not stripped.
- [x] 3.3 Verify non-agent and gate-off requests are byte-for-byte unaffected.

## 4. Challenge emission

- [x] 4.1 In the permission-denied path, detect "denied only due to masking" by comparing required scopes against the user's unmasked role scopes.
- [x] 4.2 Mint a pending grant + nonce and return the structured `403` (`detail = agent_write_permission_required` + `agent_permission` with `approval_endpoint`).
- [x] 4.3 Return an ordinary denial (no nonce) when the user's role genuinely lacks the scope.

## 5. Approval API (no UI)

- [x] 5.1 Add org-scoped, user-authenticated endpoint at `/api/0/organizations/{org}/agent/approve/{nonce}/`.
- [x] 5.2 `GET` returns challenge details — only to the user the challenge was issued for.
- [x] 5.3 `POST` approves/declines — requires `grant.user_id == request.user.id`; org from URL must match `grant.organization_id`; cannot escalate scope.
- [x] 5.4 Register the URL route.

## 6. Tests (functional)

- [x] 6.1 Agent read allowed; agent write masked → 403 challenge; grant unmasks → write succeeds.
- [x] 6.2 Non-agent request unaffected; gate-off is a no-op.
- [x] 6.3 Challenge shape: structured 403 fields; no challenge when role lacks the scope; nonce binding.
- [x] 6.4 Grant lifecycle: pending→approved→expired; pending does not authorize; expired re-challenges.

## 7. Tests (IDOR — security gate)

- [x] 7.1 Different user in the same org cannot approve another user's nonce.
- [x] 7.2 Different user cannot read another user's challenge details via `GET`.
- [x] 7.3 Nonce from org A rejected when called under org B.
- [x] 7.4 Agent acting for user A cannot ride user B's grant (request-time lookup ignores client input).
- [x] 7.5 Approval cannot grant a scope beyond the challenge or beyond the user's role.

## 8. Deferred (post-prototype)

- [ ] 8.1 Audit-log grant create/approve and each write performed under a grant.
- [ ] 8.2 Defense-in-depth backstop for mutating endpoints not using `ScopedPermission`; audit that list.
- [ ] 8.3 Resource-level narrowing (per-project), additional gated scopes beyond `project:write`.
- [ ] 8.4 Concrete session-length TTL with product; optional decline-memory to suppress re-prompting.
- [ ] 8.5 Integration test against the Seer change; per-org rollout via flag.
