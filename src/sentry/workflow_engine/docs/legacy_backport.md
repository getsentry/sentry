# Legacy Alert API Compatibility

> This document covers compatibility between legacy alert APIs and Workflow Engine
> models. It is not a description of current detector or workflow execution. Start with
> the [Workflow Engine overview](../README.md), [data model](data-model.md), and
> [execution guide](execution.md) for current architecture.

## Current Boundary

Compatibility paths preserve legacy alert API shapes while reading or associating
Workflow Engine models. The current implementation is mixed rather than a single
migration state:

- Some read and delete paths use Workflow Engine models unconditionally.
- Some issue-alert POST and PUT paths still write legacy `Rule` records and rely on
  dual-write associations.
- Feature flags select Workflow Engine serialization in remaining flag-controlled paths.

Verify the endpoint being changed rather than assuming all methods use the same model
system.

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

## Compatibility Endpoints

Use `@track_alert_endpoint_execution` references as the source of truth for the
compatibility surface. The implementation spans metric alert, incident, issue alert,
and snooze endpoints; do not maintain a second exhaustive endpoint list here.

## Feature Flag Strategy

Current compatibility flags are:

- `organizations:workflow-engine-rule-serializers`
- `organizations:workflow-engine-issue-alert-endpoints-post`
- `organizations:workflow-engine-issue-alert-endpoints-put`

The broad flag enables Workflow Engine serialization in remaining flag-controlled paths; it is not a universal router for every endpoint and method. Do not assume a generated per-endpoint flag exists. Register any new flag explicitly in `src/sentry/features/temporary.py` and remove it after rollout.

## Unsupported legacy features

Some legacy features can't or won't be supported in workflow engine models (e.g. `AlertRule` snapshots). Acknowledge these explicitly in code and tests where appropriate to make it clear which differences are known and intentional and which may be bugs.

## Testing

- **Delta tests** compare old and new serializer output for dual-written data, with an explicit `known_differences` set documenting expected divergences.
- **Single-write tests** verify that workflow engine-only data (no legacy counterpart) is returned correctly.
- **Filter tests** verify ID-based filters work for both real legacy IDs (via association tables) and manufactured IDs (via extraction).
