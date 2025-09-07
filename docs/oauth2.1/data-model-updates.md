# Data Model Updates

## Requirements

- PKCE: store `code_challenge` and `code_challenge_method` on `ApiGrant`.
- Redirect binding: persist `redirect_uri` on `ApiGrant` and enforce on token exchange.
- Token rotation: add refresh token family fields on `ApiToken` to support rotation/reuse detection.
- Client metadata (optional for discovery/registration): auth method, grant/response types, metadata URLs.

## Current Implementation (summary)

- `ApiGrant` includes `redirect_uri`, TTL, and one-time codes; no PKCE fields yet.
- `ApiToken` issues new tokens on refresh but lacks family/reuse tracking.
- `ApiApplication` lacks fields for auth method and grant/response types.

## Gaps & Tasks (Implement)

- Add `code_challenge: TextField(null=True)` and `code_challenge_method: CharField(null=True)` to `ApiGrant`.
- Add refresh family fields to `ApiToken` (see refresh-rotation.md).
- Add `token_endpoint_auth_method`, `grant_types`, `response_types` to `ApiApplication` (for discovery and enforcement).
- Migrations and backfills; admin UI visibility as needed.

## Verification

- Ensure migration hints for DB routing; add tests to cover model behaviors.

## Implementation Checklist

- [ ] ApiGrant: add `code_challenge` and `code_challenge_method` fields (PKCE).
- [ ] ApiToken: add refresh token family fields to support rotation and reuse detection.
- [ ] ApiApplication: add `token_endpoint_auth_method`, `grant_types`, `response_types` for discovery/enforcement.
- [ ] Migrations with proper DB routing hints; backfills and admin UI adjustments as needed.
