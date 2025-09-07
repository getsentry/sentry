# Dynamic Client Registration (optional)

## Requirements (RFC 7591/7592)

- Register clients via `POST /oauth/register`; return `client_id`, possibly `client_secret`, `registration_access_token`, `registration_client_uri`.
- Manage via `GET/PUT/DELETE registration_client_uri` with `registration_access_token` bearer.
- Validate client metadata (redirect URIs, grant/response types, auth methods, application metadata URLs).

## Current Implementation (summary)

- Not implemented.

## Gaps & Tasks (Implement)

- Endpoints: `POST /oauth/register`, and management endpoint.
- Access control: require Initial Access Token or SSA; audit log; rate limiting.
- Storage: expand `ApiApplication` to store registration metadata and hashed `registration_access_token`.
- Validation: serializers enforce RFC rules; return appropriate errors.
- Tests: create/update/delete flows; metadata validation.

## Verification

- Update discovery metadata appropriately when enabled.

## Implementation Checklist

- [ ] Implement `POST /oauth/register` to create client metadata (RFC 7591).
- [ ] Implement management endpoint `GET/PUT/DELETE registration_client_uri` with `registration_access_token` bearer (RFC 7592).
- [ ] Require Initial Access Token or SSA for registration; audit log operations; rate limit.
- [ ] Expand `ApiApplication` to store registration metadata and hashed `registration_access_token`.
- [ ] Validate redirect URIs, grant/response types, and auth methods per RFC; return appropriate errors.
- [ ] Add tests for create/update/delete and metadata validation.
