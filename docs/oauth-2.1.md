# OAuth 2.1 and Dynamic Client Registration: High‑Level Plan

## Goals

- Align Sentry’s OAuth provider with OAuth 2.1 guidance.
- Improve security (PKCE, strict redirect validation, token rotation).
- Add optional OpenID Connect improvements and server metadata discovery.
- Support dynamic client registration (RFC 7591/7592) where appropriate.

## Out of Scope (initial phase)

- Token introspection (RFC 7662) and revocation (RFC 7009) endpoints are optional; we may stage them after the core 2.1 updates if not immediately required.
- Full OIDC certification; we target pragmatic OIDC features only.

## Current State (summary)

- Endpoints: `/oauth/authorize` (code + implicit), `/oauth/token` (code/refresh), `/oauth/userinfo`.
- Models: `ApiApplication`, `ApiGrant` (authorization code), `ApiToken` (access/refresh).
- No PKCE; implicit flow allowed; redirect URI allows prefix matches; client auth is `client_secret_post` only; partial OIDC with HMAC `id_token` (no JWKS), no discovery, no client registration.

## Scope (Phase 1)

1. Require PKCE for Authorization Code (keep Implicit for compatibility; optional flag to disable)
2. Enforce exact redirect URI matching
3. Support `client_secret_basic` at the token endpoint (keep `client_secret_post` for compatibility)
4. Add OAuth 2.0 Authorization Server Metadata (discovery)
5. Introduce Dynamic Client Registration (create + manage)

## Functional Changes

- Authorization Endpoint (`/oauth/authorize`)
  - Implicit behavior: keep supported in Phase 1; optionally reject behind `oauth2.1:disable-implicit` by returning `unsupported_response_type`.
  - PKCE input: accept `code_challenge`, `code_challenge_method` (`S256` preferred, allow `plain` if enabled).
  - Redirect URI: require exact match with a stored redirect URI; remove/feature-flag prefix match.
    - If multiple redirect URIs are registered for a client, the authorization request MUST include `redirect_uri`; otherwise respond with `invalid_request` (RFC 6749 §3.1.2.3).
      - Reference: https://datatracker.ietf.org/doc/html/rfc6749#section-3.1.2.3
    - Native apps loopback exception (RFC 8252 §8.4): when a client registers a loopback redirect URI on `http://127.0.0.1`, `http://localhost`, or `http://[::1]` without a port, accept incoming redirects on the same scheme/host/path/query with any ephemeral port. If a fixed port is registered, require an exact port match.
    - References: RFC 6749 §3.1.2.3 (https://datatracker.ietf.org/doc/html/rfc6749#section-3.1.2.3), RFC 8252 §8.4 (https://datatracker.ietf.org/doc/html/rfc8252#section-8.4)
  - State/nonce: continue returning `state`; accept `nonce` if OIDC `id_token` is requested later.
  - Redirect URI format: enforce absolute URI and forbid fragment components. Reference: RFC 6749 §3.1.2 (https://datatracker.ietf.org/doc/html/rfc6749#section-3.1.2)
  - Multiple redirect URIs: when more than one is registered for a client, `redirect_uri` is required in the request; when one is registered, it may be omitted. Reference: RFC 6749 §3.1.2.3
  - State echo: persist and echo `state` on both success and error redirects. References: RFC 6749 §4.1.2, §4.1.2.1
  - Error mapping: align to standard error codes `invalid_request`, `unauthorized_client`, `access_denied`, `unsupported_response_type`, `invalid_scope`, `server_error`, `temporarily_unavailable`.
  - Implementation notes:
    - File: `src/sentry/web/frontend/oauth_authorize.py` (`get` path and approval flow)
    - Persist PKCE fields on created `ApiGrant`.
    - Add clear error mapping: `invalid_request` (missing params), `unsupported_response_type`, `invalid_scope`.

- Token Endpoint (`/oauth/token`)
  - Client Auth: add `client_secret_basic` (Authorization header); keep `client_secret_post` for back-compat.
    - Enforce mutual exclusion (if present in header, do not allow in body) and reject credentials in URI query. Reference: RFC 6749 §2.3.1
  - PKCE enforce: require `code_verifier` for grants with a stored challenge; validate per RFC 7636.
    - Enforce `code_verifier` length (43–128), allowed charset, and S256 `BASE64URL(SHA256(verifier))` without padding. Reference: RFC 7636 §4.1/§4.2/§4.3/§4.6
  - Refresh rotation: on refresh, always issue new `access_token` and `refresh_token`; mark prior refresh token as used; detect reuse and revoke the family.
  - Redirect URI consistency: if `redirect_uri` was provided on authorization, require the same value on token exchange. Reference: RFC 6749 §4.1.3
  - Error responses: `invalid_client` (bad auth), `invalid_grant` (bad/expired code, redirect mismatch, PKCE fail), `unsupported_grant_type`.
    - Follow RFC 6749 §5.2: proper HTTP codes, JSON `{error, error_description?, error_uri?}`, include `WWW-Authenticate` for `invalid_client` (401). Reference: https://datatracker.ietf.org/doc/html/rfc6749#section-5.2
  - Response formatting: return JSON with `Content-Type: application/json`, `Cache-Control: no-store`, and `Pragma: no-cache`. Reference: RFC 6749 §5.1
  - Token response fields: include `access_token` (required), `token_type` (`Bearer`, case-insensitive), `expires_in` (int seconds), optional `refresh_token`, and `scope` only when reduced. References: RFC 6749 §5.1, RFC 6750 §6.1

- Discovery Endpoints
  - OAuth AS metadata: `/.well-known/oauth-authorization-server` returns issuer, endpoints, scopes, `token_endpoint_auth_methods_supported`, `code_challenge_methods_supported`.
    - Provide required fields per RFC 8414 §2 (issuer, authorization_endpoint, token_endpoint, response_types_supported, grant_types_supported, token_endpoint_auth_methods_supported, code_challenge_methods_supported, scopes_supported, etc.). Reference: https://datatracker.ietf.org/doc/html/rfc8414#section-2
    - If OIDC ID tokens are supported, expose `jwks_uri` and associated keys (optional for OAuth only).
  - OIDC discovery (optional in Phase 1): `/.well-known/openid-configuration` and `/.well-known/jwks.json` when OIDC RS256 is enabled.
  - Implementation notes:
    - New views under `src/sentry/api/endpoints/` with `control_silo_endpoint` and explicit JSON.
    - Wire in `src/sentry/web/urls.py`.
    - Read issuer from deployment base URL (`absolute_uri('/')` normalized) and supported sets from settings/feature flags.

## Redirect URI Deprecation Plan (Prefix → Exact)

- Phase 0 (today): Accept prefix matches; log `oauth.prefix-matched-redirect-uri` and increment metrics.
- Phase 1: Introduce `oauth2.1:strict-redirects` flag. Default OFF. Add admin/UI warnings.
- Phase 2: Flip default ON. Per-app override available temporarily.
- Phase 3: Remove override and prefix acceptance (except RFC 8252 native app allowances).

## Bearer Usage (RFC 6750)

- Resource requests should accept `Authorization: Bearer <token>` and reject tokens in URI query parameters. References: RFC 6750 §2.1, §2.3
- On authentication/authorization errors, return `WWW-Authenticate: Bearer` with `error`, `error_description`, `error_uri` as appropriate; use standard error codes `invalid_request`, `invalid_token`, `insufficient_scope`. Reference: RFC 6750 §3

## Security & Enforcement

- HTTPS enforcement: require HTTPS for authorization/token endpoints and redirect URIs, except loopback HTTP for native apps. References: OAuth 2.1 draft, RFC 8252 §7
- Authorization code properties: one-time use, short TTL, bound to client and `redirect_uri`. Reference: RFC 6749 §4.1.2/§4.1.3
- Token/code entropy: ensure unguessable values and avoid logging secrets or tokens. References: RFC 6749 §10.10, OAuth Security BCP

## Implementation Tasks (Gaps to Address)

- Remove or gate Implicit (response_type=token) and add tests.
- PKCE end-to-end: store `code_challenge` (prefer `S256`), validate `code_verifier` (length/charset/S256) on token.
- Token endpoint client auth: support `client_secret_basic`; enforce mutual exclusion; reject credentials in query.
- Token response: add `Cache-Control: no-store` and `Pragma: no-cache`; ensure `token_type` casing and `expires_in` type.
- Error semantics: map to RFC names, return 401 + `WWW-Authenticate` for `invalid_client`, include optional `error_description`.
- Redirect URI validation: enforce absolute URI and no fragments; ensure binding across code/token.
- Refresh token rotation and reuse detection; support scope downsizing on refresh.
- Bearer usage: audit resource endpoints for header handling, query token rejection, and `WWW-Authenticate` errors.
- Discovery endpoint (RFC 8414): implement and populate required fields; include `jwks_uri` if OIDC ID tokens are issued.
- HTTPS enforcement and logging hygiene audits.

See also: docs/oauth2.1/compliance-checklist.yaml for a machine-readable breakdown used to track each requirement with status, evidence, and action.

## Component Research Docs

- Authorization Endpoint: oauth2.1/authorization-endpoint.md
- Token Endpoint: oauth2.1/token-endpoint.md
- Discovery (AS/OIDC): oauth2.1/discovery.md
- Dynamic Client Registration: oauth2.1/client-registration.md
- Refresh Token Rotation & Reuse Detection: oauth2.1/refresh-rotation.md
- Data Model Changes: oauth2.1/data-model-updates.md

## Tests & Coverage

- Coverage target: 100% for all OAuth flows and helpers (lines and branches).
- Existing test locations to align with:
  - Authorize view: `tests/sentry/web/frontend/test_oauth_authorize.py`
  - Token endpoint: `tests/sentry/web/frontend/test_oauth_token.py`
  - UserInfo endpoint: `tests/sentry/api/endpoints/test_oauth_userinfo.py`
  - Token exchange flows (Sentry Apps): `tests/sentry/sentry_apps/token_exchange/test_grant_exchanger.py`
  - Deletion flows touching grants/tokens: `tests/sentry/deletions/test_apiapplication.py`, `tests/sentry/deletions/test_sentry_app_installations.py`
- New/updated tests to add for:
  - `OAuthAuthorizeView` (authorize): success and error cases, exact redirect, PKCE inputs.
  - `OAuthTokenView` (token): client auth methods, PKCE verification, refresh rotation and reuse detection, error semantics and headers.
  - Models: `ApiApplication` redirect validation, `ApiGrant` PKCE fields, `ApiToken.from_grant` and refresh logic.
  - Discovery endpoints and registration endpoints (if enabled): schema correctness and negative cases.
- Frontend/Docs: minimal snapshot tests as needed for admin UI surfacing new fields.
- Add regression tests for legacy behaviors behind feature flags (implicit on/off, prefix redirects on/off).

## Development Guidelines (Spec References in Code)

- When implementing behavior defined by a spec, add a short comment linking to the exact section in the upstream RFC/standard.
- Prefer stable anchors (headings) over line numbers to avoid churn.
- Keep comments concise and place them immediately above the relevant code path.
- Example: In redirect validation, reference RFC 6749 §3.1.2.3 for exact redirect matching and RFC 8252 §8.4 for loopback.
