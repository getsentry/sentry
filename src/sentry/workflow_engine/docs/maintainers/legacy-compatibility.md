# Legacy Alert Compatibility

This document covers remaining historical alert ID and serialization compatibility after
the deprecated alert management APIs were retired. Start with the
[maintainer guide](README.md), [Data Model](data-model.md), and
[Execution](execution.md) for current architecture. New alert integrations use the
[detector](../implementers/detectors.md) and
[workflow](../implementers/workflows.md) guides.

## Current Boundary

The deprecated legacy alert management routes were removed in
[sentry#121879](https://github.com/getsentry/sentry/pull/121879). Clients use the detector
and workflow APIs to manage alerts. The serializer and issue-alert POST/PUT rollout flags
no longer have consumers and have been retired.

Compatibility remains at the edges: association lookup endpoints expose historical IDs
alongside Workflow Engine objects, and notification code still consumes legacy-shaped
data. Route retirement does not imply that association tables, serializers, or ID helpers
are unused. It also does not mean normal execution reads legacy alert configuration:
detector and workflow processing use the graph described in [Data Model](data-model.md).

## Handling IDs

### Migrated or Dual-Written Data

Objects originally created by the legacy system and migrated or dual-written can retain
association rows. Here, "dual-written" describes the data's origin; it does not require
ongoing writes to both systems or a live native legacy row. The current models store
legacy identifiers as scalar fields rather than foreign keys to those legacy tables.

| Association                                                                       | Historical Identifier and Workflow Engine Object                    |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [`AlertRuleDetector`](../../models/alertrule_detector.py)                         | Metric alert `alert_rule_id` or issue alert `rule_id` to `Detector` |
| [`AlertRuleWorkflow`](../../models/alertrule_workflow.py)                         | Metric alert `alert_rule_id` or issue alert `rule_id` to `Workflow` |
| [`DataConditionAlertRuleTrigger`](../../models/datacondition_alertruletrigger.py) | `alert_rule_trigger_id` to detector trigger `DataCondition`         |
| [`ActionAlertRuleTriggerAction`](../../models/action_alertruletriggeraction.py)   | `alert_rule_trigger_action_id` to `Action`                          |
| [`IncidentGroupOpenPeriod`](../../models/incident_groupopenperiod.py)             | `incident_id` and `incident_identifier` to `GroupOpenPeriod`        |

`AlertRuleDetector` and `AlertRuleWorkflow` each require exactly one of `alert_rule_id`
and `rule_id`, enforced by check constraints. Despite its name, `AlertRuleDetector`
therefore covers both metric and issue alerts. `IncidentGroupOpenPeriod` requires its two
historical incident identifiers to be both present or both null.

When a compatibility path receives a real legacy ID, such as an `alertRule` filter, it
uses the corresponding association to resolve the Workflow Engine object. Check the
specific endpoint or serializer for its accepted identifier and ownership scope.

### Single-Written Data

Objects created only in Workflow Engine have no native legacy counterpart and need not
have association rows. Compatibility serializers can expose manufactured IDs for those
objects. The helpers in
[`sentry.incidents.endpoints.serializers.utils`](../../../incidents/endpoints/serializers/utils.py)
implement the translation:

- `get_fake_id_from_object_id(obj_id)` adds the shared offset for compatibility responses.
- `get_object_id_from_fake_id(fake_id)` subtracts it to recover the real object ID. A
  non-positive result is not a valid manufactured object ID; the helper itself only does
  arithmetic, so the caller must validate and scope the lookup.

Compatibility endpoints accepting a legacy-shaped identifier must account for both real
historical IDs, resolved through associations, and manufactured IDs, decoded with the
helper. Manufactured IDs are an adapter representation, not the native detector or
workflow API's object identity.

## Compatibility Endpoints

The remaining association lookup routes are registered in
[`endpoints/urls.py`](../../endpoints/urls.py):

- `alert-rule-workflow`: [workflow association lookup](../../endpoints/organization_alertrule_workflow_index.py)
- `alert-rule-detector`: [detector association lookup](../../endpoints/organization_alertrule_detector_index.py)
- `incident-groupopenperiod`: [incident/open-period lookup](../../endpoints/organization_incident_groupopenperiod_index.py)

These are lookup routes, not replacements for the retired legacy alert management APIs.
Check their implementations when changing compatibility behavior, including which
manufactured-ID fallbacks they support. The endpoint-tracking decorator was removed with
the deprecated routes.

## Unsupported Legacy Features

Some legacy features cannot or will not be represented by Workflow Engine models, such
as `AlertRule` snapshots. Document intentional differences in code and tests so they can
be distinguished from regressions.

## Testing

- **Delta tests** compare old and new serializer output for dual-written data, with an
  explicit `known_differences` set documenting expected divergences.
- **Single-write tests** verify Workflow Engine-only data with no legacy counterpart.
- **Filter tests** verify ID-based filters for real historical IDs through associations
  and manufactured IDs through extraction.
