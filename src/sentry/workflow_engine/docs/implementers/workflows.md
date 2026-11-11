# Add a Workflow

[Implementer Guide](README.md) · [Workflow Engine](../../README.md)

A workflow defines **how to react to issues**, independently of how a detector finds
them. Use it to add notification policy or automation to existing detection. Do not
add a detector handler, call an action directly from detection, or write a new workflow
processor just to express a different set of conditions and actions.

This guide covers [choosing ingress](#1-choose-the-issue-input),
[conditions](#2-choose-when-and-if-conditions), [actions](#3-reuse-an-action-handler),
[creation](#4-create-and-connect-the-workflow), [hidden automation](#5-decide-whether-you-need-a-new-workflow-type),
and [verification](#6-verify-the-integration).

## 1. Choose the Issue Input

Identify which detector records are associated with the issues you want to handle.
A workflow is organization-scoped and connected to detectors through `DetectorWorkflow`.
Those connections select candidate workflows at runtime; creating a workflow alone does
not connect it to your product.

You do **not** need a new detector implementation if the product already creates issues:

- Existing error and issue-stream events enter through event post-processing.
  [`connect_workflows_to_issue_stream`](../../defaults/workflows.py) is an existing
  provisioning pattern for connecting workflows to a project's issue-stream detector.
- Supported issue activities enter through registered activity handlers. See
  [`workflow_activity_handlers.py`](../../handlers/workflow/workflow_activity_handlers.py)
  for resolution and Seer activity examples. An arbitrary activity does not
  automatically become workflow input.
- For a new kind of finding, implement [a detector](detectors.md) first, then connect
  a workflow to it. Do not call `process_workflows` from its handler; Issue Platform
  ingestion is the boundary between the two pipelines.

Choose an environment if the workflow should apply only there. A workflow without one
is global across environments. The engine selects enabled, connected workflows for the
resolved environment plus global workflows. For activity inputs, environment resolution
can be unavailable or ambiguous; see [Workflow Ingress](../maintainers/execution.md#workflow-ingress)
for that path's limits.

## 2. Choose WHEN and IF Conditions

There are two separate decisions:

- **WHEN**: should this issue event or activity trigger the workflow? For example,
  `first_seen_event` reacts to a new issue.
- **IF**: should this group of actions run for the triggering input? For example,
  a priority or event-attribute filter can restrict the recipients of one action group
  without changing the workflow's trigger.

Each IF group has its own attached actions. Keep the WHEN group separate from IF groups
and from detector trigger groups; the shared storage model does not make their roles
interchangeable. Actions belong to IF groups, not directly to the workflow or its WHEN
group. See the [workflow graph](../maintainers/data-model.md#workflow-graph) for the
relationships.

Reuse existing condition types. The organization `data-conditions` endpoint exposes
registered condition metadata, including handler placement. Generic backend validation
does not fully enforce that placement, so choose handlers whose inputs and group match
your use. Add a handler only when the needed check is missing, following
[Add a Condition](conditions.md).

Use `any-short` for groups containing workflow-trigger handlers; creation validation
requires it. An IF group with no conditions is unconditional. A workflow with no IF
groups has no attached actions to run. Other empty/missing-group behavior and logic
semantics are defined in the [condition reference](../maintainers/conditions.md), not
inferred from the logic type's name.

Conditions that need event-frequency or session queries use the delayed, batched
workflow path. Do not do those queries per workflow in a fast handler. Activity inputs
do not enter that slow-condition path; choose conditions that can evaluate the activity
you actually receive. See [inline and batched condition data](../maintainers/conditions.md#inline-and-batched-condition-data)
for the contract.

## 3. Reuse an Action Handler

Select an existing `Action.Type` and its configuration. The organization
`available-actions` endpoint describes available actions and integrations.
[`BaseActionValidator`](../../endpoints/validators/base/action.py) validates handler
schemas, action permissions, and integration requirements. Use the API representation
of configuration when making API requests; a handler's config transformer can translate
it to a different stored representation.

For example, the registered
[`EmailActionHandler`](../../../notifications/notification_action/action_handler_registry/email_handler.py)
supports notifying issue owners. It delegates notification delivery rather than putting
that behavior into the workflow processor.

If a new side effect genuinely needs a new action implementation, follow the
[`ActionHandler`](../../types.py) contract, add its `Action.Type`, and register the
handler with `action_handler_registry`. Provide config/data schemas, implement
`execute(ActionInvocation)`, and ensure its owning module is imported during application
startup. Follow an existing handler for config transformation, feature requirements,
validation, and discovery rather than adding a parallel dispatch mechanism. See the
[extension map](../maintainers/README.md#extension-points).

Actions run in separate tasks, without a user-defined order. Repeat suppression and
cross-action deduplication are not an exactly-once delivery guarantee; side effects must
account for task retries. [Action Selection and Dispatch](../maintainers/execution.md#action-selection-and-dispatch)
explains the runtime boundary.

## 4. Create and Connect the Workflow

### User-Configured Alerts

Use `POST /api/0/organizations/{organization_id_or_slug}/workflows/`. The
[`workflow endpoint`](../../endpoints/organization_workflow_index.py) applies creation
permissions and delegates to [`WorkflowValidator`](../../endpoints/validators/base/workflow.py),
which creates the condition groups, actions, and detector connections in a transaction.
Do not duplicate that graph-building logic in a new endpoint.

For example, this request connects an alert to an existing detector and emails issue
owners when a new issue is first seen. Replace the synthetic detector ID with one the
caller can access in the organization:

```json
{
  "name": "Notify issue owners about new issues",
  "enabled": true,
  "detectorIds": [123],
  "config": {"frequency": 30},
  "triggers": {
    "logicType": "any-short",
    "conditions": [
      {
        "type": "first_seen_event",
        "comparison": true,
        "conditionResult": true
      }
    ]
  },
  "actionFilters": [
    {
      "logicType": "all",
      "conditions": [],
      "actions": [
        {
          "type": "email",
          "config": {"targetType": "issue_owners"},
          "data": {"fallthroughType": "ActiveMembers"}
        }
      ]
    }
  ]
}
```

`frequency` is the repeat interval in minutes, checked per workflow/action/issue group.
It is not a polling interval. This example's empty IF group adds no further restriction
beyond WHEN. The email action uses active members as the fallback when issue owners
cannot be used. Omit object IDs for newly created condition groups, conditions, and
actions; the endpoint creates them.

### Product-Provisioned Workflows

For defaults or internal automation, follow existing provisioning in
[`defaults/workflows.py`](../../defaults/workflows.py):

1. Create separate WHEN and IF groups and assign the WHEN group to
   `Workflow.when_condition_group` when creating the workflow in a transaction.
2. Attach conditions to their intended groups.
3. Attach each IF group through `WorkflowDataConditionGroup`.
4. Attach actions to IF groups through `DataConditionGroupAction`.
5. Connect the workflow to its detectors through `DetectorWorkflow`.

`create_priority_workflow` plus `connect_workflows_to_issue_stream` demonstrates event-
based defaults; `create_and_connect_pull_request_workflow` demonstrates an activity-
based workflow. Direct ORM provisioning bypasses API validation and permission checks:
its caller owns those invariants. Reuse the product's lifecycle/provisioning path and
account for repeated initialization instead of creating duplicate defaults.

## 5. Decide Whether You Need a New Workflow Type

Most new policies use the existing `Workflow.Type.ALERT`. A new combination of
conditions and actions does not require a new enum member.

Use a distinct type when the workflow has a different product role, such as hidden inbox
automation (`Workflow.Type.INBOX`). The native alert APIs expose only types in
`VISIBLE_WORKFLOW_TYPES`; they are not the creation path for hidden workflows, and
`WorkflowValidator` does not accept a workflow `type` field. Hidden automation needs
its own appropriate provisioning and lifecycle integration.

Type is not an execution gate: the processor selects connected workflows without
filtering by type. Do not rely on a hidden type to prevent execution. See
[`Workflow`](../../models/workflow.py) and the [data model](../maintainers/data-model.md#workflow).

## 6. Verify the Integration

Exercise the behavior through the ingress chosen in step 1, not just by constructing
rows or calling the action handler:

- A matching issue event or supported activity selects the connected workflow and
  schedules the intended side effect; a nonmatching WHEN or IF does not.
- Disabled workflows and unrelated detector connections do not run. Environment-scoped
  behavior matches the inputs your product produces.
- Repeat inputs respect the configured frequency. Shared actions do not produce
  duplicate dispatch within the engine's deduplication scope.
- If you use slow conditions, follow the delayed path to action scheduling; do not
  assume immediate completion. For activity inputs, verify the actual available data.
- New handlers are discoverable after normal application startup, not only after a
  test imports their module. Their validation accepts intended configuration and
  rejects unsupported input.

Use the existing [integration coverage](../../../../../tests/sentry/workflow_engine/test_integration.py),
[workflow processor coverage](../../../../../tests/sentry/workflow_engine/processors/test_workflow.py),
and [workflow API coverage](../../../../../tests/sentry/workflow_engine/endpoints/test_organization_workflow_index.py)
as references. For a missing action, follow the maintainer
[debugging checklist](../maintainers/execution.md#observability-and-debugging) from ingress
through selection, conditions, suppression, scheduling, and delivery. Fire history records
pre-dispatch intent, not proof that a task was scheduled or an external action succeeded.
