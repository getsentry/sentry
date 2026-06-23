## ADDED Requirements

### Requirement: Agent-originated requests are identified

The system SHALL classify an API request as agent-originated when it carries the `X-Is-Agent: true` header AND is authenticated through a trusted Seer path (e.g. a valid `X-Viewer-Context` JWT signed with `SEER_API_SHARED_SECRET`, or a Seer-signed request). A request that carries the header but is not authenticated through a trusted Seer path SHALL NOT be granted any elevated treatment by virtue of the header.

#### Scenario: Header present on a trusted Seer request

- **WHEN** a request arrives with `X-Is-Agent: true` and a valid `X-Viewer-Context` JWT
- **THEN** the request is classified as agent-originated for the remainder of request processing

#### Scenario: Header present without trusted Seer authentication

- **WHEN** a request arrives with `X-Is-Agent: true` but no valid Seer authentication
- **THEN** the request is treated as a normal (non-elevated) request and the header confers no privileges

#### Scenario: Gate disabled by option

- **WHEN** the `seer.agent-write-gate.enabled` option (or per-org flag) is off
- **THEN** agent classification has no effect and requests are authorized exactly as they are today

### Requirement: Agent request effective scopes are masked to read-only by default

For an agent-originated request, the system SHALL reduce the effective scopes used for authorization to the read-only scope set (`SENTRY_READONLY_SCOPES`), except for scopes covered by an active approved grant (see `agent-write-grant`). This masking SHALL occur at the single point where the request's `Access` / effective scopes are constructed, and SHALL reuse the existing scope-enforcement machinery (`ScopedPermission`) rather than a parallel route allowlist.

#### Scenario: Read request from an agent

- **WHEN** an agent-originated `GET` request requires only a read scope (e.g. `project:read`)
- **THEN** the request is authorized normally (subject to the user's own role)

#### Scenario: Write request from an agent with no grant

- **WHEN** an agent-originated `POST`/`PUT`/`PATCH`/`DELETE` request requires a write scope (e.g. `project:write`) and no active grant covers it
- **THEN** the required write scope is absent from the request's effective scopes and authorization fails

#### Scenario: Write request from an agent with a covering grant

- **WHEN** an agent-originated mutating request requires `project:write` and an active, unexpired approved grant for `(user, organization, project:write)` exists
- **THEN** `project:write` is NOT masked and the request is authorized

#### Scenario: Non-agent requests are unaffected

- **WHEN** a normal human/session/token request is processed
- **THEN** its effective scopes are computed exactly as before this change, with no masking

### Requirement: Masked write denials return a structured permission challenge

When an agent-originated mutating request is denied **solely because** the required write scope was masked (i.e. the acting user's own role DOES include that scope), the system SHALL return HTTP `403` with a structured, machine-readable body identifying the required scope(s), a human-readable operation description, the organization, a single-use `nonce`, the `approval_endpoint` path, and the challenge `expires_at`.

#### Scenario: Challenge is emitted for a maskable write

- **WHEN** an agent write is denied only because of masking and the user's role includes the required scope
- **THEN** the response is `403` with body field `detail = "agent_write_permission_required"` and an `agent_permission` object containing `required_scopes`, `operation`, `organization`, `nonce`, `approval_endpoint`, and `expires_at`

#### Scenario: No challenge when the user genuinely lacks the scope

- **WHEN** an agent write is denied and the acting user's own role does NOT include the required scope
- **THEN** the response is an ordinary permission denial with NO approval `nonce`/`approval_endpoint` (the agent cannot be granted more than the user has)

#### Scenario: Challenge nonce is bound to user, organization, and scopes

- **WHEN** a challenge is issued
- **THEN** its `nonce` is associated with the acting user, the organization, and the specific required scope set, and cannot be used to approve a different user, organization, or scope set
