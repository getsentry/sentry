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
