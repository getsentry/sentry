# Legacy API Backport Project

## Goal

Reimplement legacy alerts API endpoints using workflow engine abstractions. Backported code paths should not use legacy models (`AlertRule`, `Rule`, `AlertRuleActivity`, `Incident`, etc.) for their core logic.

## The Plan

Each legacy endpoint gets a parallel workflow engine implementation, gated behind feature flags. The broad flag `organizations:workflow-engine-rule-serializers` enables the workflow engine path for all backported endpoints. Per-endpoint-method flags allow independent rollout of individual code paths (see [Feature Flag Strategy](#feature-flag-strategy) below). The two implementations live side-by-side in the same endpoint class; the non-workflow engine code is kept untouched as much as possible.

**Read endpoints (GET)** query workflow engine models (`Detector`, `Workflow`, `DataSource`, `GroupOpenPeriod`) and use dedicated serializers that reconstruct the legacy response shape.

**Write endpoints (POST, PUT, DELETE)** translate the legacy API request into a call to the existing workflow engine Validators, so that new data is single-written through the same validation and creation logic used by the native workflow engine APIs. The goal is to reuse, not reimplement, the write path.

## Handling IDs

### Dual-written data

Data that was created by the legacy system and migrated (or is being written to both systems simultaneously). Association tables bridge the two:

- `AlertRuleDetector` — despite the name, this maps either a metric alert (`alert_rule_id`) or an issue alert (`rule_id`) to a `Detector`. Each row carries exactly one of the two (enforced by a check constraint).
- `AlertRuleWorkflow` — same pattern, mapping `alert_rule_id` or `rule_id` to a `Workflow`.
- `IncidentGroupOpenPeriod` — maps a legacy `incident_id` / `incident_identifier` to a `GroupOpenPeriod`.

When the workflow engine path receives a real legacy ID (e.g. an `alertRule` query param), it resolves the corresponding workflow engine object via these tables.

### Single-written data

Data created exclusively by the workflow engine with no legacy counterpart. These objects have no rows in the association tables. To maintain API compatibility, they are exposed with manufactured IDs. The helpers for this live in `src/sentry/incidents/endpoints/serializers/utils.py`:

- `get_fake_id_from_object_id(obj_id)` — used by serializers to manufacture an ID for API responses
- `get_object_id_from_fake_id(fake_id)` — used by endpoints to recover the real object ID from an incoming parameter. If non-positive, the input wasn't a valid manufactured ID.

Endpoints that accept IDs as input must handle both real legacy IDs (via association tables) and manufactured IDs (via `get_object_id_from_fake_id`).

## Endpoints in scope

All endpoints decorated with `@track_alert_endpoint_execution` are in scope for backport:

**Metric alert rules**

- `OrganizationAlertRuleIndexEndpoint`
- `OrganizationAlertRuleDetailsEndpoint`
- `OrganizationCombinedRuleIndexEndpoint`
- `ProjectAlertRuleIndexEndpoint`
- `ProjectAlertRuleDetailsEndpoint`

**Incidents**

- `OrganizationIncidentIndexEndpoint`
- `OrganizationIncidentDetailsEndpoint`

**Issue alert rules**

- `ProjectRulesEndpoint`
- `ProjectRuleDetailsEndpoint`
- `ProjectRuleEnableEndpoint`
- `ProjectRuleTaskDetailsEndpoint`

**Snooze**

- `RuleSnoozeEndpoint`
- `MetricRuleSnoozeEndpoint`

## Feature Flag Strategy

`organizations:workflow-engine-rule-serializers` enables all backported paths at once (useful for testing). Per-endpoint flags (e.g. `organizations:workflow-engine-projectrulesendpoint-get`) allow independent prod rollout — each is OR'd with the broad flag. Naming convention: `organizations:workflow-engine-{lowercaseendpointclass}-{method}`.

## Unsupported legacy features

Some legacy features can't or won't be supported in workflow engine models (e.g. `AlertRule` snapshots). Acknowledge these explicitly in code and tests where appropriate to make it clear which differences are known and intentional and which may be bugs.

## Testing

- **Delta tests** compare old and new serializer output for dual-written data, with an explicit `known_differences` set documenting expected divergences.
- **Single-write tests** verify that workflow engine-only data (no legacy counterpart) is returned correctly.
- **Filter tests** verify ID-based filters work for both real legacy IDs (via association tables) and manufactured IDs (via extraction).
