## ADDED Requirements

### Requirement: Mint endpoint issues a short-lived scope-bound token

The system SHALL expose `POST /api/0/organizations/{org}/agent/token/` that returns a
short-lived, signed JWT capability token whose scopes are derived from the authenticated
caller. The endpoint SHALL be a no-op (404/feature-gated) unless the
`organizations:seer-agent-token-flow` feature is enabled for the organization.

#### Scenario: Token issued for an authenticated caller

- **WHEN** an authenticated caller posts to the mint endpoint for an org they belong to, with the feature enabled
- **THEN** the response contains a signed JWT and its `expires_at`
- **AND** the JWT `exp` is no more than the configured short TTL (prototype: 5 minutes) from now
- **AND** no token row is written to the database

#### Scenario: Feature disabled

- **WHEN** the feature flag is off for the organization
- **THEN** the endpoint does not issue a token

### Requirement: Default scopes are read-only and never exceed the caller

The minted token's scopes SHALL be `caller_scopes ∩ (SENTRY_READONLY_SCOPES ∪
active_grant_scopes)`, where `caller_scopes` is the authority the caller actually holds.
The token SHALL NOT contain any scope the caller does not hold, regardless of request
input.

#### Scenario: No active grant yields a read-only token

- **WHEN** a caller mints a token and has no active write grant for the org and session
- **THEN** the token's scopes are a subset of `SENTRY_READONLY_SCOPES`

#### Scenario: Requested scopes can only narrow

- **WHEN** the request body lists `requested_scopes` that include a scope the caller does not hold
- **THEN** that scope is omitted from the issued token

#### Scenario: Body cannot widen identity

- **WHEN** the request body contains a user id or organization id different from the authenticated caller's
- **THEN** those values are ignored and the token is minted for the authenticated caller and the org in the URL

### Requirement: Endpoint is safe to expose publicly via dual caller authentication

The endpoint SHALL authenticate callers through the existing default authentication chain,
accepting either an internal `X-Viewer-Context` identity or a standard OAuth bearer token,
and SHALL only ever de-escalate the caller's authority.

#### Scenario: Internal Seer via viewer-context

- **WHEN** the caller authenticates with a valid `X-Viewer-Context`
- **THEN** `caller_scopes` is the acting user's role scopes for the organization

#### Scenario: External client via OAuth

- **WHEN** the caller authenticates with an OAuth bearer token
- **THEN** `caller_scopes` is the user's role scopes intersected with the OAuth token's scopes
- **AND** the minted token cannot exceed the scopes delegated to the OAuth token

#### Scenario: Unauthenticated caller

- **WHEN** the caller presents no valid identity
- **THEN** the request is rejected with an authentication error and no token is issued

### Requirement: Tokens are ephemeral and not persisted

The system SHALL NOT store issued tokens. Token validity SHALL be determined solely from
the signature and claims. Callers re-mint as needed.

#### Scenario: Re-mint after expiry

- **WHEN** a token has passed its `exp`
- **THEN** the caller obtains a new token by calling the mint endpoint again
- **AND** the system performs no database lookup of the previous token
