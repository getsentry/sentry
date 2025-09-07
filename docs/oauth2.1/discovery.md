# Authorization Server Metadata (Discovery)

## Requirements (RFC)

- RFC 8414 §2: `/.well-known/oauth-authorization-server` returns JSON metadata including:
  - `issuer`, `authorization_endpoint`, `token_endpoint`
  - `response_types_supported`, `grant_types_supported`
  - `token_endpoint_auth_methods_supported`
  - `code_challenge_methods_supported`
  - `scopes_supported`
  - Optional: `jwks_uri` (if OIDC/ID tokens used), `revocation_endpoint`, `introspection_endpoint` if implemented.

## Current Implementation (summary)

- No metadata endpoint implemented.

## Gaps & Tasks (Implement)

- Implement `/.well-known/oauth-authorization-server` endpoint in control silo.
- Populate required fields; read issuer from deployment base URL; list supported response/grant types, token auth methods, PKCE methods, scopes.
- Include `jwks_uri` only if we issue OIDC `id_token`.
- Tests: schema correctness, presence of required fields, conditional `jwks_uri`.

## Verification

- Use the Implementation Checklist below as the source of truth for work tracking.

## Implementation Checklist

- [ ] Implement `/.well-known/oauth-authorization-server` endpoint (RFC 8414 §2).
- [ ] Populate required fields: `issuer`, `authorization_endpoint`, `token_endpoint`, `response_types_supported`, `grant_types_supported`, `token_endpoint_auth_methods_supported`, `code_challenge_methods_supported`, `scopes_supported` (RFC 8414 §2).
- [ ] Include `jwks_uri` only if we issue OIDC ID tokens (RFC 8414 §2).
- [ ] Ensure metadata reflects actual support:
  - `response_types_supported`: `["code"]` once Implicit is removed.
  - `grant_types_supported`: include `authorization_code`, `refresh_token` (add others only if implemented).
  - `token_endpoint_auth_methods_supported`: include `client_secret_basic` (and `client_secret_post` if retained).
  - `code_challenge_methods_supported`: include `S256` (and `plain` only if allowed).
  - `scopes_supported`: reflect supported Sentry scopes.
