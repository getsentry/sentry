# Legacy Alert API Compatibility

> This document covers remaining legacy alert ID compatibility with Workflow Engine
> models after the legacy alert APIs were retired. Start with
> the [Workflow Engine overview](../README.md), [data model](data-model.md), and
> [execution guide](execution.md) for current architecture.

## Current Boundary

The deprecated legacy alert API routes were removed in
[sentry#121879](https://github.com/getsentry/sentry/pull/121879). Clients must use
the detector and workflow APIs to manage alerts. The serializer and issue-alert
POST/PUT rollout flags no longer have consumers and have been retired.

Some compatibility code remains: rule history and statistics resolve legacy rule IDs
to workflows, lookup endpoints expose associations between legacy and Workflow Engine
models, and notification code still uses legacy-shaped data. Endpoint retirement does
not imply that the association tables, serializers, or ID helpers are all unused.

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

Check the registered routes and their implementations when changing compatibility
code. Rule history and statistics live in `src/sentry/rules/history/endpoints/`;
association lookup routes live in `src/sentry/workflow_engine/endpoints/urls.py`.
The endpoint-tracking decorator was removed with the deprecated routes.

## Unsupported legacy features

Some legacy features can't or won't be supported in workflow engine models (e.g. `AlertRule` snapshots). Acknowledge these explicitly in code and tests where appropriate to make it clear which differences are known and intentional and which may be bugs.

## Testing

- **Delta tests** compare old and new serializer output for dual-written data, with an explicit `known_differences` set documenting expected divergences.
- **Single-write tests** verify that workflow engine-only data (no legacy counterpart) is returned correctly.
- **Filter tests** verify ID-based filters work for both real legacy IDs (via association tables) and manufactured IDs (via extraction).
