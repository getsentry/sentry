## ADDED Requirements

### Requirement: Persistent grants record user consent per session

The system SHALL persist a grant record binding `(user_id, organization_id,
agent_session_id, scope_list, status, expires_at)`. A grant SHALL be created in `pending`
status when an agent write is challenged, and SHALL authorize scopes only when `approved`
and unexpired. Grants are the only durable artifact of this flow; tokens are not stored.

#### Scenario: Active grant scopes are folded into the next token

- **WHEN** a token is minted for a user, org, and session that have an approved, unexpired grant
- **THEN** the grant's scopes are unioned into the candidate scopes (still intersected with the caller's authority)

#### Scenario: Pending grant does not authorize

- **WHEN** a grant exists but is still `pending`
- **THEN** its scopes are not added to any minted token

#### Scenario: Expired grant does not authorize

- **WHEN** a grant is `approved` but past its `expires_at`
- **THEN** its scopes are not added to any minted token

#### Scenario: Session binding isolates approvals

- **WHEN** a user has an approved grant for session A and mints a token for session B
- **THEN** session A's grant scopes are not included in session B's token

### Requirement: Writes outside the token raise a structured challenge

The system SHALL, when an agent-token request is denied solely because the token lacks a
write scope the acting user's role actually holds, create a `pending` grant and return a
structured `403` carrying a single-use high-entropy `nonce`, the required scopes, the
operation, and the approval endpoint. When the user's role genuinely lacks the scope, the
system SHALL instead return an ordinary denial with no nonce.

#### Scenario: Grantable write returns a challenge

- **WHEN** an agent-token write is denied and the acting user's role holds the required scope
- **THEN** a pending grant is created and a structured `403` with a `nonce` and `approval_endpoint` is returned

#### Scenario: Non-grantable write returns ordinary denial

- **WHEN** an agent-token write is denied and the acting user's role does not hold the required scope
- **THEN** an ordinary `403` is returned with no nonce and no grant is created

### Requirement: Approval is IDOR-safe and first-party only

The system SHALL expose `POST /api/0/organizations/{org}/agent/approve/{nonce}/` for the
user to approve or decline a challenge. Approval SHALL require a genuine first-party user
session and SHALL be rejected for any request authenticated via `X-Viewer-Context` or an
agent token, so the agent cannot approve its own grant. The grant SHALL be looked up by
the URL org plus nonce and SHALL be acted on only when it belongs to the authenticated
user. Approval SHALL grant exactly the scopes recorded on the challenge, never scopes
supplied in the request body.

#### Scenario: Owner approves from a user session

- **WHEN** the user the challenge was issued for approves it from a first-party session
- **THEN** the grant becomes `approved` with the recorded scopes and an approval timestamp

#### Scenario: Agent cannot self-approve

- **WHEN** the approval request is authenticated via `X-Viewer-Context` or an agent token
- **THEN** the request is rejected with a permission error

#### Scenario: Another user cannot approve or read the grant

- **WHEN** a different user in the same org calls the approval or detail endpoint for the nonce
- **THEN** the response is `404` and the grant is unchanged

#### Scenario: Cross-org nonce is rejected

- **WHEN** a nonce issued under org A is used at the approval endpoint for org B
- **THEN** the response is `404`

#### Scenario: Approval cannot escalate scope

- **WHEN** the approval request body lists scopes beyond those recorded on the challenge
- **THEN** the extra scopes are ignored and only the recorded scopes are granted
