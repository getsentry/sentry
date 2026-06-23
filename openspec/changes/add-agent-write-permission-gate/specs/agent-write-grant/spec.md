## ADDED Requirements

### Requirement: Agent write grants are persisted with binding and expiry

The system SHALL persist an agent write grant that binds an acting user, an organization, and a set of write scopes, with a creation time, an expiry, and a status (`pending`, `approved`, `declined`, `expired`). A grant SHALL be created in `pending` status when a write challenge is issued, keyed by the challenge `nonce`. A grant SHALL never include a scope the acting user's role does not already include.

#### Scenario: Pending grant created from a challenge

- **WHEN** a write challenge is issued for `(user, organization, {project:write})`
- **THEN** a grant record is created with that user, organization, and scope set, status `pending`, a unique high-entropy `nonce`, and an `expires_at`

#### Scenario: Grant scopes cannot exceed the user's role

- **WHEN** a grant would be created or approved for a scope the acting user's role does not include
- **THEN** that scope is rejected and not granted

### Requirement: Approval is performed by the acting user via a user-authenticated API

The system SHALL expose an organization-scoped approval API that the Seer chat widget calls as the authenticated user (session or user token), with no Sentry-hosted UI:

- `GET /api/0/organizations/{org}/agent/approve/{nonce}/` returns the pending challenge details (operation, required scopes).
- `POST /api/0/organizations/{org}/agent/approve/{nonce}/` approves or declines.

The system SHALL require that the authenticated user is the same user the challenge was issued for before returning details or allowing approval.

#### Scenario: Acting user approves

- **WHEN** the user the challenge was issued for calls `POST .../agent/approve/{nonce}/` to approve, authenticated as themselves
- **THEN** the grant transitions to `approved` with an `approved_at` timestamp and an active `expires_at`

#### Scenario: User declines

- **WHEN** the acting user declines via the approval API
- **THEN** the grant transitions to `declined` and never authorizes a request

#### Scenario: Unauthenticated caller

- **WHEN** an unauthenticated request hits the approval API
- **THEN** it is rejected with an authentication error and no grant state changes

### Requirement: Approval and grant lookup are IDOR-safe

The system SHALL bind every grant operation to the authenticated identity and the URL organization, never to client-supplied identifiers. Organization membership alone SHALL NOT authorize approving or reading a grant that belongs to a different user.

#### Scenario: Different user in the same org cannot approve

- **WHEN** a user who is a member of the organization but is NOT the user the challenge was issued for calls the approval API for that nonce
- **THEN** the request is rejected (404/403) and the grant does not become active

#### Scenario: Different user cannot read challenge details

- **WHEN** a user other than the one the challenge was issued for calls `GET .../agent/approve/{nonce}/`
- **THEN** the challenge details are not disclosed

#### Scenario: Nonce from another organization is rejected

- **WHEN** the approval API is called under organization B with a nonce whose grant belongs to organization A
- **THEN** the request is rejected and no grant is approved

#### Scenario: Request-time grant lookup ignores client input

- **WHEN** masking consults grants to decide whether to unmask a scope
- **THEN** it queries strictly by the `user_id` and `organization_id` from the authenticated context, never from request URL, body, or headers

#### Scenario: Approval cannot escalate scope

- **WHEN** an approval request attempts to approve a scope not present in the original challenge, or not held by the user's role
- **THEN** the extra scope is not granted

### Requirement: Grants are validated and expire

The system SHALL treat a grant as authorizing only while its status is `approved` and the current time is before `expires_at`. Expired or non-approved grants SHALL NOT unmask any scope.

#### Scenario: Active grant authorizes within window

- **WHEN** an agent mutating request needs `project:write` and an `approved`, unexpired grant for `(user, organization, project:write)` exists
- **THEN** the scope is unmasked and the request is authorized

#### Scenario: Expired grant does not authorize

- **WHEN** a previously approved grant's `expires_at` has passed
- **THEN** the scope is masked again and a fresh challenge is issued on the next write attempt

#### Scenario: Pending grant does not authorize

- **WHEN** a grant exists but is still `pending`
- **THEN** the agent's retry is still denied with a challenge until approval completes
