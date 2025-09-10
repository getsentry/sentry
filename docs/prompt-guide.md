# Prompt Guide: Creating Reliable Implementation Prompts for Codex

Purpose: Provide a concise, repeatable structure to brief a Codex instance on a new task, with enough context to implement safely and accurately. Use this guide when drafting prompts for feature work tracked under issue #99002.

## Principles
- Be concise but complete: include scope, constraints, acceptance criteria, and code touch points.
- Be specific: prefer exact file paths, endpoints, flags, and behaviors over generalities.
- Be testable: define concrete success checks and error semantics up front.
- Be scoped: state non-goals and forbid unrelated refactors.
- Be source-linked: reference the primary ticket and the OAuth 2.1 spec; include repo/GitHub links only if they are accessible in the target environment.

## Required Sections (Template)
Copy this block and fill it in. Keep outputs under ~400–700 words unless the task is large.

Title: <Short, action-oriented name>

Primary Ticket: https://github.com/getsentry/sentry/issues/99002

Context:
- We are aligning Sentry’s OAuth provider with OAuth 2.1. Use the OAuth 2.1 draft as the authoritative reference:
  - OAuth 2.1 draft: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-13
  - Optional: link GitHub URLs to repo docs if they are publicly accessible for this branch.

Goal:
- <Single-sentence outcome of this task>

Scope (In):
- <Bulleted, concrete items to implement>

Scope (Out):
- <Bulleted, explicitly excluded items>

Implementation Notes:
- Touch points: <file paths, endpoints, modules>
- Behaviors: <exact rules, headers, error codes, edge cases>
- Flags/Rollout: <feature flags, defaults>

Acceptance Criteria:
- API semantics: <expected responses/status/headers>
- Tests updated/added: <files or cases>
- No regressions: <constraints or notes>

References:
- Specs: OAuth 2.1 draft https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-13, plus any relevant RFC sections (e.g., RFC 6749, RFC 6750).
- Optional: Public GitHub links to repo docs for this branch (if accessible).

Constraints:
- Follow repo coding conventions; keep changes minimal and targeted.
- Do not refactor unrelated code; no license header changes.
- Avoid network access and destructive commands.

Deliverables:
- Code changes in the files above
- Tests covering the acceptance criteria
- Brief summary of changes

## Example Prompt (Token Endpoint Improvements)
Title: Token endpoint — client_secret_basic, cache headers, RFC errors

Primary Ticket: https://github.com/getsentry/sentry/issues/99002

Context:
- We are implementing OAuth 2.1 improvements.
- Authoritative reference: OAuth 2.1 draft https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-13

Goal:
- Add `client_secret_basic` authentication, RFC 6749-compliant error semantics, cache-prevention headers, and standardized token_type for `/oauth/token`.

Scope (In):
- Parse `Authorization: Basic base64(client_id:client_secret)`; prefer header over body; reject both present (invalid_request).
- On bad/missing client credentials, return 401 `invalid_client` with `WWW-Authenticate: Basic realm="oauth"`.
- For unknown `grant_type`, return 400 `unsupported_grant_type`.
- Add `Cache-Control: no-store` and `Pragma: no-cache` to success and error responses; keep JSON content type.
- Standardize `token_type` to `Bearer` and ensure `expires_in` is an integer.
- Redirect binding: if the authorization grant stored a `redirect_uri`, require the identical value on token exchange; otherwise `invalid_grant`.

Scope (Out):
- PKCE verification (will follow after PKCE fields exist on grants).
- Refresh token rotation/reuse detection.
- Discovery metadata endpoints.

Implementation Notes:
- Touch points: `src/sentry/web/frontend/oauth_token.py` (authentication, error mapping, headers, token_type); related tests in `tests/sentry/web/frontend/test_oauth_token.py`.
- Error codes strictly per RFC 6749 §5.2: `invalid_request`, `invalid_client`, `invalid_grant`, `unauthorized_client`, `unsupported_grant_type`, `invalid_scope`.
- Never log or echo secrets; continue structured logging for `client_id` and reason codes only.

Acceptance Criteria:
- Valid Basic auth succeeds; body creds omitted; returns JSON with `token_type` "Bearer", integer `expires_in`, cache-prevention headers.
- Both Basic and body creds present → 400 `invalid_request` with cache-prevention headers.
- Bad/missing credentials (header or body) → 401 `invalid_client` with `WWW-Authenticate: Basic realm="oauth"` and cache-prevention headers.
- Authorization grant with stored `redirect_uri` requires matching `redirect_uri` in token request; mismatch or omission → 400 `invalid_grant`.
- `grant_type=password` or other unsupported → 400 `unsupported_grant_type`.

References:
- OAuth 2.1 draft: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-13
- RFC 6749 §2.3.1, §4.1.3, §5.1, §5.2; RFC 6750 §6.1

Constraints:
- Keep changes localized to `oauth_token.py` and related tests; no schema changes.
- Maintain existing feature flags and metrics.

Deliverables:
- Patch to `oauth_token.py` implementing behaviors above
- Tests updating/adding the cases listed
- Short summary of changes

## Writer’s Checklist (Quick)
- Does the prompt link the primary ticket 99002 and the OAuth 2.1 draft spec?
- Are in-scope and out-of-scope clearly separated?
- Are success criteria testable and unambiguous (status, headers, body)?
- Are file paths and exact endpoints named?
- Are RFC sections or specs referenced when relevant?
- Is the prompt short enough to be scanned (~400–700 words) but complete?

## Common Pitfalls to Avoid
- Vague goals without concrete acceptance criteria.
- Omitting cache headers or error header requirements in auth flows.
- Asking for refactors or unrelated cleanups alongside the feature.
- Relying only on external links without summarizing required behavior.
