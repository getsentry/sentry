# Device Authorization Endpoint (/oauth/device_authorization)

## Requirements (RFC)

- RFC 8628 §3: Device Authorization Request — `POST` with `client_id`, optional `scope`.
- RFC 8628 §3.2: Authorization Server issues `device_code`, `user_code`, `verification_uri`, optional `verification_uri_complete`, `expires_in` (lifetime), and `interval` (min polling interval in seconds).
- RFC 8628 §3.3: User Interaction — End-user visits `verification_uri` and enters `user_code`, then approves/denies the request; server associates the pending device code with the user and scopes.
- RFC 8628 §4: Authorization Server Metadata — expose `device_authorization_endpoint` in discovery metadata when supported.
- RFC 8628 §5: Security Considerations — bind `device_code` to the client, enforce short lifetimes, rate-limit polling, throttle brute-force of `user_code`.

## Current Implementation (summary)

- Not implemented. No endpoint for device authorization; no verification UI for `user_code`; token endpoint does not accept device code grant.

## Gaps & Tasks (Implement)

- Endpoint: `POST /oauth/device_authorization`
  - Inputs: `client_id` (required), `scope` (optional; space-delimited).
  - Validation: ensure client exists and is active; validate scopes as with `/oauth/authorize`; apply organization scoping rules as needed (see Authorization Endpoint doc).
  - Outputs: JSON with `device_code`, `user_code`, `verification_uri`, optional `verification_uri_complete`, `expires_in`, and `interval`.
  - Behavior: persist a new pending device authorization tied to the client, requested scopes, and expiration; return recommended default `interval` (e.g., 5s) unless configured.

- Verification UI (`GET/POST /oauth/device`)
  - Display a form to enter `user_code`; on submission, show client name and requested scopes; allow Approve/Deny.
  - On Approve: bind the pending device authorization to the authenticating user (and org if required), mark as approved; on Deny: mark as denied.
  - Security: throttle invalid `user_code` attempts and avoid leaking whether a code exists; expire codes promptly; do not reveal client secret information.

- Token endpoint changes (see token-endpoint.md)
  - Accept `grant_type=urn:ietf:params:oauth:grant-type:device_code` with `device_code`.
  - Enforce polling rules with `authorization_pending`, `slow_down`, `expired_token`, `access_denied` (RFC 8628 §3.5).
  - On success, issue tokens as with authorization code grant, bound to the client, scopes, and (optionally) organization.

- Discovery
  - Add `device_authorization_endpoint` to AS metadata (RFC 8628 §4; RFC 8414).
  - Include device grant URN in `grant_types_supported` when enabled.

- Data model (see data-model-updates.md)
  - Persist device authorizations with fields: `device_code`, `user_code`, `client_id/application`, `scope_list`, `expires_at`, `interval`, `approved`/`denied` flags, `approved_user_id`, `organization_id` (optional), `last_polled_at`, `poll_count`.
  - Index for lookups by `device_code` and `user_code`; consider hashing at rest; enforce unique active `user_code`.

## Verification

- Unit tests for endpoint responses, code lifetimes, and interval.
- UI tests for verification page (enter code, approve/deny); ensure no open-redirect or code enumeration.
- Token endpoint tests for polling semantics and RFC 8628 error codes.

## Implementation Checklist

- [ ] Implement `POST /oauth/device_authorization` (RFC 8628 §3), returning `device_code`, `user_code`, `verification_uri`, `verification_uri_complete?`, `expires_in`, `interval`.
- [ ] Add verification UI (`GET/POST /oauth/device`) to enter `user_code` and approve/deny, with org scoping support where applicable (RFC 8628 §3.3).
- [ ] Extend token endpoint to support device grant; implement `authorization_pending`, `slow_down`, `expired_token`, `access_denied` (RFC 8628 §3.4/§3.5).
- [ ] Expose `device_authorization_endpoint` in discovery; add device grant URN to `grant_types_supported` (RFC 8628 §4; RFC 8414).
- [ ] Add data model for pending device authorizations with proper indexing and TTL enforcement.
- [ ] Add rate limiting and throttling for both verification attempts and token polling; backoff on `slow_down`.
- [ ] Document security considerations and align with OAuth Security BCP where relevant (binding to client, lifetimes, brute-force protections).

