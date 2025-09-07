# Bearer Token Usage (RFC 6750)

## Requirements (RFC)

- RFC 6750 §2.1: Resource requests authenticate with `Authorization: Bearer <token>`.
- RFC 6750 §2.3: MUST NOT transmit access tokens in URI query parameters.
- RFC 6750 §3: On errors, return `WWW-Authenticate: Bearer` with `error`, `error_description`, `error_uri` as appropriate; use error codes `invalid_request`, `invalid_token`, `insufficient_scope` with suitable HTTP status.

## Current Implementation (summary)

- Resource endpoints usage and error semantics are not audited yet.

## Gaps & Tasks (Implement)

- Enforce header usage: accept only `Authorization: Bearer` for bearer tokens; reject other transports.
- Prohibit query tokens: detect and reject tokens in query string.
- WWW-Authenticate: include header with appropriate error code and description on failures.
- Error codes: use `invalid_request`, `invalid_token`, `insufficient_scope` with correct HTTP status codes.
- Tests: header auth happy path; query token rejection; error responses with `WWW-Authenticate`.

## Verification

- Use the Implementation Checklist below as the source of truth for work tracking.

## Implementation Checklist

- [ ] Enforce Authorization header usage: `Authorization: Bearer <token>` (RFC 6750 §2.1).
- [ ] Prohibit tokens in URI query parameters (RFC 6750 §2.3).
- [ ] Return `WWW-Authenticate: Bearer` on failures with `error`, `error_description`, `error_uri` as appropriate (RFC 6750 §3).
- [ ] Use only `invalid_request`, `invalid_token`, `insufficient_scope` bearer error codes with appropriate HTTP status (RFC 6750 §3).
