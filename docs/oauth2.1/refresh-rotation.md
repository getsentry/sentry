# Refresh Token Rotation & Reuse Detection

## Requirements (OAuth 2.1 draft / best practice)

- Rotate refresh tokens on each use; issue a new refresh token; mark prior token as used.
- Detect reuse within a refresh token family; on reuse, revoke the family and reject.
- Support optional scope downscoping on refresh (RFC 6749 §6).

## Current Implementation (summary)

- Refresh issues new access/refresh tokens but does not detect reuse.
- Scope downscoping not supported.

## Gaps & Tasks (Implement)

- Data model: add refresh family fields (e.g., `refresh_family_id`, `refresh_prev_id`, `refresh_revoked`).
- Logic: on refresh, create new token in same family, mark previous as used; on reuse, revoke family.
- Scope downscoping: accept reduced `scope` and reflect in token response.
- Tests: rotation flow, reuse detection, downscoping behavior.

## Verification

- Use the Implementation Checklist below as the source of truth for work tracking.

## Implementation Checklist

- [ ] Data model: add refresh family fields (e.g., `refresh_family_id`, `refresh_prev_id`, `refresh_revoked`).
- [ ] Logic: on refresh, rotate tokens and mark previous as used; detect reuse and revoke family.
- [ ] Support scope downscoping on refresh and reflect in token response (RFC 6749 §6).
- [ ] Tests: rotation flow, reuse detection, downscoping behavior.
