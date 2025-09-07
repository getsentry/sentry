# Authorization Endpoint (/oauth/authorize)

## Requirements (RFC)

- RFC 6749 §3.1.1: request params `response_type`, `client_id`, optional `redirect_uri`, `scope`, `state`.
- RFC 6749 §3.1.2: `redirect_uri` MUST be absolute and MUST NOT include fragment.
- RFC 6749 §3.1.2.3: exact redirect match; if multiple registered, `redirect_uri` is REQUIRED in request.
- RFC 6749 §4.1.2: success redirect contains `code` and echoes `state` if present.
- RFC 6749 §4.1.2.1: error redirect contains `error` and echoes `state` if present.
- RFC 7636: accept `code_challenge` and `code_challenge_method` (prefer `S256`).
- RFC 8252 §8.4: native loopback exception — allow ephemeral ports when registered loopback URI omits port.
- OAuth 2.1 draft: Implicit removed — do not support `response_type=token`.

## Current Implementation (summary)

- Supports `response_type=code` and `token` (Implicit still enabled).
- Exact redirect matching with per‑app prefix carve‑out; loopback ephemeral ports supported; multiple‑URI rule enforced when `redirect_uri` omitted.
- State handled and echoed; errors rendered/redirected but some names diverge from RFC.
- PKCE not yet accepted/stored on authorization.

## Gaps & Tasks (Implement)

- Remove/gate Implicit
  - Implement: Reject `response_type=token` with `unsupported_response_type`.
  - Spec: OAuth 2.1 draft (removed Implicit); error format RFC 6749 §4.1.2.1.
- Enforce `redirect_uri` format (absolute, no fragment)
  - Implement: `urlparse(redirect_uri)`; require `scheme` and `netloc`; `fragment == ''`; else `invalid_request`.
  - Spec: RFC 6749 §3.1.2 https://datatracker.ietf.org/doc/html/rfc6749#section-3.1.2
- Exact redirect matching; multiple-URI rule
  - Implement: Compare normalized strings; if >1 registered and `redirect_uri` missing → `invalid_request`.
  - Spec: RFC 6749 §3.1.2.3 https://datatracker.ietf.org/doc/html/rfc6749#section-3.1.2.3
- Remove per‑app prefix override
  - Implement: Delete carve‑out; keep loopback exception only.
  - Spec: RFC 6749 §3.1.2.3 (no prefix matching)
- Loopback ephemeral ports (native apps)
  - Implement: If registered `http://127.0.0.1|localhost|[::1]` without port, accept any incoming port with same scheme/host/path/query.
  - Spec: RFC 8252 §8.4 https://datatracker.ietf.org/doc/html/rfc8252#section-8.4
- PKCE inputs on authorization
  - Implement: Accept `code_challenge` and `code_challenge_method` (`S256` preferred, optionally `plain`), persist on `ApiGrant`.
  - Spec: RFC 7636 §4.2 https://datatracker.ietf.org/doc/html/rfc7636#section-4.2
- State handling
  - Implement: Persist `state` per request; echo unmodified on both success and error redirects.
  - Spec: RFC 6749 §4.1.2, §4.1.2.1
- Error mapping
  - Implement: Use only RFC error codes: `invalid_request`, `unauthorized_client`, `access_denied`, `unsupported_response_type`, `invalid_scope`, `server_error`, `temporarily_unavailable`.
  - Spec: RFC 6749 §4.1.2.1
- Tests
  - Exact/absolute/no‑fragment; multiple‑URI rule; state echo (success+error); loopback ephemeral ports; PKCE inputs; Implicit rejection.

## Verification

- Use the Implementation Checklist below as the source of truth for work tracking.

## Implementation Checklist

- [ ] Reject Implicit (`response_type=token`) with `unsupported_response_type` (OAuth 2.1; RFC 6749 §4.1.2.1).
- [ ] Enforce `redirect_uri` is absolute and has no fragment (RFC 6749 §3.1.2).
- [x] Require exact redirect match; if multiple registered and `redirect_uri` missing → `invalid_request` (RFC 6749 §3.1.2.3). Completed in [PR #99004](https://github.com/getsentry/sentry/pull/99004).
- [ ] Remove per-app prefix matching override (stay spec-compliant) (RFC 6749 §3.1.2.3).
- [ ] Accept and persist `code_challenge` and `code_challenge_method` (`S256` preferred) (RFC 7636 §4.2).
- [ ] Echo `state` on both success and error redirects (RFC 6749 §4.1.2, §4.1.2.1).
- [ ] Standardize error codes to RFC names (RFC 6749 §4.1.2.1).
- [ ] Add tests for authorization code TTL, one-time use, and binding to `client_id` and `redirect_uri` (RFC 6749 §4.1.2/§4.1.3).
- [ ] Verify redirect-vs-rendered error behavior across cases (RFC 6749 §4.1.2.1).
- [x] Native loopback ephemeral port exception (RFC 8252 §8.4). Completed in [PR #99003](https://github.com/getsentry/sentry/pull/99003).
- [ ] Enforce HTTPS for non‑native redirect URIs (only loopback HTTP allowed for native apps) (RFC 8252 §7; OAuth 2.1 draft HTTPS requirement).
- [ ] Disallow wildcard or pattern redirect URIs (every redirect URI must be explicitly registered; no wildcards/globs) (OAuth 2.1 draft — Multiple Redirect URIs).
- [ ] Perform strict lexical equality for redirect_uri comparison (no path/trailing‑slash normalization at comparison time; normalize only at registration if desired) (RFC 6749 §3.1.2.3; OAuth 2.1 draft — Multiple Redirect URIs).
- [ ] Validate custom scheme redirect URIs for native apps per RFC 8252 (private‑use schemes; avoid generic schemes; prefer claimed HTTPS where applicable) (RFC 8252 §7.1–§7.3).
- [ ] When `redirect_uri` is unregistered or invalid, do not redirect; render an error page without echoing untrusted URLs (RFC 6749 §4.1.2.1 guidance).
