# Data Model Updates

## Requirements

- PKCE: store `code_challenge` and `code_challenge_method` on `ApiGrant`.
- Redirect binding: persist `redirect_uri` on `ApiGrant` and enforce on token exchange.
- Token rotation: add refresh token family fields on `ApiToken` to support rotation/reuse detection.
- Client metadata (optional for discovery/registration): auth method, grant/response types, metadata URLs.
 - Device authorization (RFC 8628): store pending device grants — device/user codes, TTL, polling interval, approval state, and bindings.

## Current Implementation (summary)

- `ApiGrant` includes `redirect_uri`, TTL, and one-time codes; no PKCE fields yet.
- `ApiToken` issues new tokens on refresh but lacks family/reuse tracking.
- `ApiApplication` lacks fields for auth method and grant/response types.
 - No model for device codes or verification state.

## Gaps & Tasks (Implement)

- Add `code_challenge: TextField(null=True)` and `code_challenge_method: CharField(null=True)` to `ApiGrant`.
- Add refresh family fields to `ApiToken` (see refresh-rotation.md).
- Add `token_endpoint_auth_method`, `grant_types`, `response_types` to `ApiApplication` (for discovery and enforcement).
- Migrations and backfills; admin UI visibility as needed.
- Enforce redirect URI validation on registration/update: forbid wildcards, require HTTPS for non‑native apps (allow loopback HTTP per RFC 8252), accept private‑use schemes for native apps with guidance from RFC 8252; store normalized forms if desired and compare lexically.
 - Device authorization: introduce `ApiDeviceAuthorization` (name TBD) with fields:
   - `device_code` (opaque; consider hashing at rest), `user_code` (short, human-friendly; unique among active records)
   - `application` (FK), `scope_list`, `expires_at`, `interval` (seconds)
   - `approved` (bool), `denied` (bool), `approved_user_id` (nullable), `organization_id` (nullable)
   - `last_polled_at`, `poll_count` (for `slow_down`), timestamps
   - Indexes on `device_code` and `user_code`; TTL cleanup job

## Verification

- Ensure migration hints for DB routing; add tests to cover model behaviors.

## Implementation Checklist

- [ ] ApiGrant: add `code_challenge` and `code_challenge_method` fields (PKCE).
- [ ] ApiToken: add refresh token family fields to support rotation and reuse detection.
- [ ] ApiApplication: add `token_endpoint_auth_method`, `grant_types`, `response_types` for discovery/enforcement.
- [ ] Migrations with proper DB routing hints; backfills and admin UI adjustments as needed.
- [ ] Redirect URI validation rules at registration/update: no wildcards/globs; HTTPS only for non‑native; loopback HTTP allowed for native; private‑use schemes for native per RFC 8252; store normalized and compare lexically.
 - [ ] Add device authorization model to persist pending device codes and verification state (RFC 8628), with appropriate indexes and TTL cleanup.
