## ADDED Requirements

### Requirement: Denied writes return a stateless signed challenge

The system SHALL, when an agent-token request is denied solely because the token lacks a
write scope the acting user's role actually holds, return a structured `403` carrying a
**Sentry-signed challenge token** plus human-readable detail (required scopes, operation,
organization). The challenge token SHALL encode the acting user, organization, grantable
scopes, agent session, and a short expiry, signed with the agent signing key and a
dedicated audience. The denial path SHALL NOT write to the database — no grant or other
record is created when a write is challenged. When the user's role genuinely lacks the
scope, the system SHALL return an ordinary denial with no challenge token.

#### Scenario: Grantable write returns a signed challenge with no write

- **WHEN** an agent-token write is denied and the acting user's role holds the required scope
- **THEN** a structured `403` is returned containing a signed challenge token and the required scopes/operation
- **AND** no row is created in the grant table (the denial path performs no database write)

#### Scenario: Repeated denials do not accumulate state

- **WHEN** the same blocked write is retried many times before approval
- **THEN** each response returns a fresh signed challenge token and the server persists nothing

#### Scenario: Non-grantable write returns ordinary denial

- **WHEN** an agent-token write is denied and the acting user's role does not hold the required scope
- **THEN** an ordinary `403` is returned with no challenge token

### Requirement: Approval verifies the signed challenge and persists the grant

The system SHALL expose `POST /api/0/organizations/{org}/agent/approve/` taking a signed
challenge token and a decision. It SHALL verify the token's signature, audience, and
expiry, and SHALL require a genuine first-party user session — rejecting any request
authenticated via `X-Viewer-Context` or an agent token so the agent cannot approve its own
request. The acting session user MUST match the challenge token's subject and the URL org
MUST match the token's organization. On `approve` the system SHALL create the grant in
`approved` status with exactly the scopes carried by the signed token — never scopes from
the request body. The grant (approved consent) is the only thing ever written to the
database in this flow.

#### Scenario: Owner approves from a user session

- **WHEN** the user named in the challenge token approves it from a first-party session
- **THEN** a grant is created in `approved` status with the token's scopes and an approval timestamp

#### Scenario: Decline persists nothing

- **WHEN** the user declines the challenge
- **THEN** no grant is created and the challenge simply expires

#### Scenario: Agent cannot self-approve

- **WHEN** the approval request is authenticated via `X-Viewer-Context` or an agent token
- **THEN** the request is rejected with a permission error and nothing is persisted

#### Scenario: Forged or expired challenge is rejected

- **WHEN** the challenge token has an invalid signature, wrong audience, or is expired
- **THEN** the request is rejected and no grant is created

#### Scenario: Another user cannot approve someone else's challenge

- **WHEN** the first-party session user differs from the challenge token's subject
- **THEN** the request is rejected and no grant is created

#### Scenario: Cross-org challenge is rejected

- **WHEN** a challenge token issued for org A is presented at the approval endpoint for org B
- **THEN** the request is rejected and no grant is created

#### Scenario: Approval cannot escalate scope

- **WHEN** the approval request body lists scopes beyond those in the signed challenge token
- **THEN** the extra scopes are ignored and only the token's scopes are granted

### Requirement: Approved grants are persisted consent and fold into tokens

The system SHALL persist a grant binding `(user_id, organization_id, agent_session_id,
scope_list, expires_at)`, created only upon approval. The grant table SHALL therefore hold
only approved consent. An approved, unexpired grant's scopes SHALL be unioned into a
minted token (still intersected with the caller's current authority); pending or expired
states do not exist as rows and never authorize.

#### Scenario: Active grant scopes are folded into the next token

- **WHEN** a token is minted for a user, org, and session that have an approved, unexpired grant
- **THEN** the grant's scopes are unioned into the candidate scopes (still intersected with the caller's authority)

#### Scenario: Expired grant does not authorize

- **WHEN** a grant is past its `expires_at`
- **THEN** its scopes are not added to any minted token

#### Scenario: Session binding isolates approvals

- **WHEN** a user has an approved grant for session A and mints a token for session B
- **THEN** session A's grant scopes are not included in session B's token
