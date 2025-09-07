# Token Endpoint (/oauth/token)

## Requirements (RFC)

- RFC 6749 §2.3.1: client authentication — support `client_secret_basic`; optional `client_secret_post`; do not allow creds in URI query; enforce mutual exclusion.
- RFC 6749 §4.1.3: authorization code grant — require `grant_type=authorization_code`, `code`, and `redirect_uri` if it was present in authorization; bind to client and redirect.
- RFC 7636: PKCE verification — validate `code_verifier` against stored challenge (prefer `S256`); enforce length and charset.
- RFC 6749 §5.1: token response format — JSON, `Content-Type: application/json`, `Cache-Control: no-store`, `Pragma: no-cache`.
- RFC 6749 §5.1: token response fields — `access_token` (required), `token_type` (required), `expires_in` (recommended int), `refresh_token` (optional), `scope` (optional if reduced).
- RFC 6749 §5.2: error response semantics — standard error codes; `invalid_client` uses 401 + `WWW-Authenticate` header; optional `error_description`, `error_uri`.
- RFC 6749 §6: refresh grant — `grant_type=refresh_token`; allow scope downscoping.
- OAuth 2.1 draft: refresh token rotation and reuse detection (best practice).
- RFC 6750 §6.1: `token_type` is Bearer (case-insensitive).

## Current Implementation (summary)

- Auth via POST body `client_id`/`client_secret` only; no Basic auth; no mutual exclusion checks.
- Authorization code grant accepts `code`; compares `redirect_uri` if provided; PKCE not enforced.
- Token response includes fields but misses cache headers and uses lowercase `bearer`.
- Refresh issues new access/refresh tokens; no reuse detection; rejects scope downscoping.
- Error mapping uses non-standard names; no WWW-Authenticate header.

## Gaps & Tasks (Implement)

- Client authentication
  - Implement: Parse `Authorization: Basic base64(client_id:client_secret)`; prefer header over body; if both present, reject (mutual exclusion) or ignore body; do not accept creds in URI query.
  - Responses: On bad credentials, return `invalid_client` with 401 and `WWW-Authenticate: Basic realm="oauth"`.
  - Spec: RFC 6749 §2.3.1 https://datatracker.ietf.org/doc/html/rfc6749#section-2.3.1, §5.2
- PKCE verification
  - Implement: If grant has `code_challenge`, require `code_verifier`; length 43–128; charset ALPHA / DIGIT / “-” / “.” / “\_” / “~”. If method `S256`, compare `BASE64URL(SHA256(verifier))` (no padding); if `plain` (if allowed), compare direct.
  - Spec: RFC 7636 §4.1/§4.2/§4.3/§4.4/§4.6 https://datatracker.ietf.org/doc/html/rfc7636
- Redirect binding
  - Implement: If `redirect_uri` was included in authorization, require same exact value in token request; else reject `invalid_grant`.
  - Spec: RFC 6749 §4.1.3 https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.3
- Token response formatting
  - Implement: `Content-Type: application/json`, `Cache-Control: no-store`, `Pragma: no-cache`.
  - Spec: RFC 6749 §5.1 https://datatracker.ietf.org/doc/html/rfc6749#section-5.1
- Token response fields
  - Implement: Include `access_token`, `token_type` (prefer “Bearer”), `expires_in` (int seconds). Include `refresh_token` when issued. Include `scope` only when reduced from requested.
  - Spec: RFC 6749 §5.1; RFC 6750 §6.1
- Error semantics
  - Implement: Use `invalid_request`, `invalid_client`, `invalid_grant`, `unauthorized_client`, `unsupported_grant_type`, `invalid_scope`. For `invalid_client`, use 401 + `WWW-Authenticate`. Include optional `error_description`/`error_uri`.
  - Spec: RFC 6749 §5.2
- Refresh token grant
  - Implement: Accept `grant_type=refresh_token`; allow scope downscoping (subset of original); reflect in `scope` response field.
  - Spec: RFC 6749 §6
- Refresh rotation & reuse detection
  - Implement: Rotate refresh tokens on use; track family; on reuse, revoke family and reject.
  - Spec: OAuth 2.1 draft (best practice), OAuth Security BCP (draft-ietf-oauth-security-topics)

## Verification

- Use the Implementation Checklist below as the source of truth for work tracking.

## Implementation Checklist

- [ ] Support `client_secret_basic`; prefer header over body; enforce mutual exclusion; reject credentials in URI query (RFC 6749 §2.3.1).
- [ ] PKCE verification: validate `code_verifier` length (43–128), charset, and S256 result (no padding) against stored challenge (RFC 7636 §4.1–§4.6).
- [ ] Require `redirect_uri` on token exchange if it was present during authorization; enforce exact binding (RFC 6749 §4.1.3).
- [ ] Token response headers: add `Cache-Control: no-store` and `Pragma: no-cache` (RFC 6749 §5.1).
- [ ] Token response fields: ensure `token_type` is “Bearer” (case-insensitive), `expires_in` integer; include `scope` only when reduced (RFC 6749 §5.1; RFC 6750 §6.1).
- [ ] Error semantics: use RFC error codes; return 401 + `WWW-Authenticate` for `invalid_client`; include optional `error_description`/`error_uri` (RFC 6749 §5.2).
- [ ] Refresh grant: support scope downscoping; reflect in `scope` response (RFC 6749 §6).
- [ ] Refresh rotation & reuse detection (OAuth 2.1 draft best practice).
- [ ] Refresh response schema: ensure `access_token`, `token_type`, `expires_in`, `scope` (if changed), and `refresh_token` (if rotated) are returned (RFC 6749 §5.1).
- [ ] Explicitly reject Resource Owner Password Credentials grant and add tests (OAuth 2.1 removal).
