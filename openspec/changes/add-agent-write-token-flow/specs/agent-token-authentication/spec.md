## ADDED Requirements

### Requirement: Agent token is carried as a Bearer credential

The agent SHALL present the minted JWT on data requests as an `Authorization: Bearer`
credential. `X-Viewer-Context` SHALL be used only on the mint call, not on data requests
that carry an agent token.

#### Scenario: Bearer token on a data request

- **WHEN** a data request carries the agent JWT in the `Authorization: Bearer` header
- **THEN** the request is authenticated from the token alone, without requiring `X-Viewer-Context`

### Requirement: Stateless verification of the agent token

The system SHALL recognize the agent JWT via a dedicated authentication class registered in
the default authentication chain, and SHALL accept it only when its signature, `exp`, and
`aud` are valid. The class SHALL return `None` (defer to the rest of the chain) for any
credential that is not an agent token, leaving existing authentication unaffected.

#### Scenario: Valid token authenticates

- **WHEN** the JWT signature verifies, `exp` is in the future, and `aud` matches the agent audience
- **THEN** the request is authenticated as the token's subject user with the token's scopes as `request.auth`

#### Scenario: Expired token rejected

- **WHEN** the JWT `exp` is in the past
- **THEN** authentication fails and the request is not authorized

#### Scenario: Wrong audience rejected

- **WHEN** the JWT `aud` does not match the agent audience
- **THEN** authentication fails

#### Scenario: Non-agent credential is ignored

- **WHEN** the request carries an ordinary user token or session and no agent JWT
- **THEN** the agent authentication class returns no result and the normal chain authenticates the request

### Requirement: Token scopes flow through the normal access path

Effective access for an agent-token request SHALL be assembled through Sentry's ordinary
token-scope path: the token's scopes intersected with the acting member's role scopes. No
masking or permission-layer hook SHALL be required to enforce the token's scopes.

#### Scenario: Read within token scope succeeds

- **WHEN** an agent-token request reads a resource whose required scope is in the token
- **THEN** the request is authorized

#### Scenario: Write outside token scope is denied

- **WHEN** an agent-token request attempts a write whose required scope is not in the token
- **THEN** the request is denied by the ordinary scope check

#### Scenario: Token cannot exceed the member's role

- **WHEN** a token somehow carries a scope the acting member's role no longer holds
- **THEN** the intersection removes it and the request is not authorized for that scope
