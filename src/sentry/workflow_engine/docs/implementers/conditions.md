# Add a Condition Handler

[Workflow Engine](../../README.md) · [Implementer Guide](README.md) ·
[Detector Guide](detectors.md) · [Workflow Guide](workflows.md)

Use a condition when a detector needs a reusable predicate over its extracted value,
or a workflow needs to decide whether to continue or select an action group. You
supply the comparison schema and evaluation logic; the shared engine handles stored
conditions, dispatch, and group logic.

For a direct value comparison in a detector, reuse `eq`, `gte`, `gt`, `lte`, `lt`, or
`ne` instead of adding a handler. For custom logic, follow the steps below. You do not
need to read the full runtime implementation first: the
[condition reference](../maintainers/conditions.md) is the canonical source for result
normalization, group logic, evaluation errors, validation, and fast/slow scheduling.

## On This Page

1. [Choose the Placement and Contract](#1-choose-the-placement-and-contract)
2. [Add the Enum Value](#2-add-the-enum-value)
3. [Implement and Register the Handler](#3-implement-and-register-the-handler)
4. [Make the Registration Run at Startup](#4-make-the-registration-run-at-startup)
5. [Decide Whether Manual Lists Apply](#5-decide-whether-manual-lists-apply)
6. [Expose the Handler Through the API](#6-expose-the-handler-through-the-api)
7. [Add Focused Backend Tests](#7-add-focused-backend-tests)
8. [Add Optional Compatibility and Frontend Support](#8-add-optional-compatibility-and-frontend-support)

Use the [completion checklist](#completion-checklist) before handing off the change.

## Working References

Use these existing implementations as working references:
[`FirstSeenEventConditionHandler`](../../handlers/condition/first_seen_event_handler.py) and
[`test_first_seen_event_handler.py`](../../../../../tests/sentry/workflow_engine/handlers/condition/test_first_seen_event_handler.py).
The example below adds a fast Workflow WHEN condition using the same event-state
fields. Replace the example name and predicate with your product's new behavior;
reuse an existing condition if it already expresses that behavior. Detector trigger
and Workflow IF differences are called out where they matter.

## 1. Choose the Placement and Contract

Before editing, decide:

- **Detector trigger:** What detector-specific value will the handler receive? Should it
  return a priority directly, or a boolean that maps to the stored priority result?
- **Workflow WHEN:** What property of `WorkflowEventData` gates the entire Workflow?
- **Workflow IF:** What property of `WorkflowEventData` gates one action group?
- **Batched Workflow WHEN or IF:** Does acquiring the evaluation input require an
  expensive query? If so, the condition handler itself is unchanged, but the delayed
  data-acquisition path must know how to batch and supply that input.

Do not make one handler accept unrelated Detector and Workflow input shapes. Match a
Detector handler to `extract_value` in the [detector guide](detectors.md); use the
[workflow guide](workflows.md) for the WHEN/IF graph. Handler placement metadata is for
discovery, not runtime type safety. The
[touchpoint table](../maintainers/conditions.md#detector-and-workflow-touchpoints)
defines the input and result contracts for all three roles.

For a normal boolean predicate, return whether it matches and configure the stored
result for its placement: a detector priority or a Workflow gate. If returning a value
directly, follow the [result contract](../maintainers/conditions.md#condition-dispatch)
rather than relying on truthiness or integer-to-priority coercion.

## 2. Add the Enum Value

Edit [`models/data_condition.py`](../../models/data_condition.py):

```python
class Condition(StrEnum):
    # ...
    MY_NEW_CONDITION = "my_new_condition"
```

The enum feeds model choices and API validation. Storage is a `CharField`, not a database
enum. Run the repository's migration check rather than assuming whether a model-state
migration is required.

## 3. Implement and Register the Handler

For a fast Workflow WHEN condition, add
`handlers/condition/my_new_condition_handler.py`:

```python
from typing import Any

from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.preview import UnsupportedPreviewBehavior
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import WorkflowEventData, WorkflowTriggerDataConditionHandler


@condition_handler_registry.register(Condition.MY_NEW_CONDITION)
class MyNewConditionHandler(WorkflowTriggerDataConditionHandler):
    preview_behavior = UnsupportedPreviewBehavior("Requires event-time group state")
    comparison_json_schema = {"type": "boolean"}
    condition_result_schema = {"type": "boolean"}
    label_template = "A new issue is created"

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        state = event_data.group_state
        if not comparison or state is None:
            return False
        if event_data.workflow_env is None:
            return state["is_new"]
        return state["is_new_group_environment"]
```

Required handler contract from [`DataConditionHandler`](../../types.py):

| Member                              | Requirement                                                                                                |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `group`                             | Set Detector/Workflow control placement, or inherit it from a typed Workflow handler base                  |
| `evaluate_value(value, comparison)` | Return a `DataConditionResult`; raise `DataConditionEvaluationException` for a known evaluation failure    |
| `comparison_json_schema`            | Define accepted stored/API comparison JSON                                                                 |
| `condition_result_schema`           | Define accepted stored/API result JSON; the inherited `{}` is permissive                                   |
| `subgroup`                          | Optional UI-only categorization within the top-level group; it does not affect evaluation                  |
| `label_template` or `render_label`  | Needed when the condition must render through legacy rule-shaped APIs                                      |
| `validate_comparison`               | Override for organization-scoped or cross-field validation that JSON Schema cannot express                 |
| `preview_behavior`                  | For typed Workflow handlers, define supported preview behavior or an explicit `UnsupportedPreviewBehavior` |

For a Detector trigger, specialize the generic with the actual detector value type. A
boolean return maps to the stored `DetectorPriorityLevel`; a direct non-boolean
`DetectorPriorityLevel` return passes through. Detector API validation requires stored
condition results to be integers convertible to `DetectorPriorityLevel`.

For a Workflow IF condition, inherit
`ActionFilterDataConditionHandler[WorkflowEventData]` for an inline event predicate and
set a subgroup when the automation UI needs to place it under issue attributes, event
attributes, or frequency. For a batched condition, specialize with the query-result
value type instead (for example, the event-frequency handlers use `list[int]`).

The typed Workflow bases set `WORKFLOW_TRIGGER` or `ACTION_FILTER` and are recognized
by the [Workflow preview API](../../endpoints/organization_workflow_preview.py). Add
`WorkflowTriggerPreviewBehavior` or `ActionFilterPreviewBehavior` when a faithful
historical preview is possible; otherwise state why it is unsupported. The example
makes that limitation explicit; the real first-seen handler has its own supported
preview implementation. See [`preview.py`](../../preview.py).

Keep schemas strict enough for the stored data you support. See
[validation layers](../maintainers/conditions.md#validation-is-layered) for why a
successful model save alone does not verify the complete API contract.

## 4. Make the Registration Run at Startup

Edit [`handlers/condition/__init__.py`](../../handlers/condition/__init__.py):

```python
__all__ = [
    # ...
    "MyNewConditionHandler",
]

from .my_new_condition_handler import MyNewConditionHandler
```

This import is functional. [`Config.ready`](../../apps.py) imports the condition package;
the package import executes the registration decorator. An enum and handler class that
are not imported remain unavailable at runtime.

A product-specific condition can live outside this package, but its owning app startup
must import the decorated module. Anomaly detection demonstrates this path through
[`incidents/handlers/condition`](../../../incidents/handlers/condition) and
[`incidents/grouptype.py`](../../../incidents/grouptype.py).

## 5. Decide Whether Manual Lists Apply

Registration does not update these lists automatically:

| List                                                | Add the condition when                                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [`SLOW_CONDITIONS`](../../models/data_condition.py) | It uses the delayed Workflow query path; delayed query generation and result handling must also support it |
| `PERCENT_CONDITIONS`                                | It is a delayed percentage comparison                                                                      |
| `LEGACY_CONDITIONS`                                 | It must be hidden from the condition availability endpoint                                                 |

A condition whose data must be acquired in the batched phase additionally needs a query
handler registered in
`slow_condition_query_handler_registry`. Implement the
[`BaseEventFrequencyQueryHandler`](../../handlers/condition/event_frequency_query_handlers.py)
data-acquisition contract and register the condition in that module. This handler does
not replace `DataConditionHandler`; it gathers the values that are later passed through
the same condition evaluator. Without this registration,
[`generate_unique_queries`](../../processors/delayed_workflow.py) cannot build a query and
the buffered condition cannot fire.

## 6. Expose the Handler Through the API

Once registered, the handler appears in
[`OrganizationDataConditionIndexEndpoint`](../../endpoints/organization_data_condition_index.py)
under its `group`, unless it is in `LEGACY_CONDITIONS`. The endpoint exposes the type,
group, optional subgroup, and comparison schema.

Stored conditions serialize through
[`DataConditionSerializer`](../../endpoints/serializers/data_condition_serializer.py).
Comparison dictionary keys are converted to the API's camelCase representation.

If `validate_comparison` resolves a user, team, integration, or other organization-owned
object, scope the lookup by the supplied organization. The generic validator does not
make an unscoped handler lookup safe.

## 7. Add Focused Backend Tests

Add `tests/sentry/workflow_engine/handlers/condition/test_my_new_condition_handler.py`,
using [`ConditionTestCase`](../../../../../tests/sentry/workflow_engine/handlers/condition/test_base.py).

Cover:

- Passing and non-passing values
- Exact result and `.triggered` behavior
- Missing or malformed runtime data
- Comparison JSON Schema acceptance and rejection
- Known failure conversion when using `DataConditionEvaluationException`
- Event versus activity behavior when relevant
- Organization scoping when `validate_comparison` or `render_label` loads objects
- Registry discovery through normal application startup

Exercise discovery through the condition-availability endpoint and evaluation using the
stored condition type. Do not import the decorated implementation solely to make the
test pass; that can hide missing startup registration.

Then test the placement:

- **Detector trigger:** create a detector condition with a priority result and assert the
  detector transition or `DetectorEvaluation` in
  [`test_detector.py`](../../../../../tests/sentry/workflow_engine/processors/test_detector.py)
  or the owning product's handler test. If the condition needs a new extracted value,
  update and test the owning `DetectorHandler.extract_value` implementation.
- **Workflow WHEN:** assert the Workflow stops or proceeds in
  [`test_workflow.py`](../../../../../tests/sentry/workflow_engine/processors/test_workflow.py).
- **Workflow IF:** in the same processor test, create the
  `WorkflowDataConditionGroup`/`DataConditionGroupAction` graph and assert only actions
  attached to passing groups are selected.
- **Slow Workflow WHEN or IF:** extend
  [`test_delayed_workflow.py`](../../../../../tests/sentry/workflow_engine/processors/test_delayed_workflow.py)
  for query generation, WHEN gating or IF selection, preservation of passing IF groups,
  result combination, retry behavior, and cleanup.

Detector-specific comparison validation belongs in the owning subclass of
[`BaseDetectorTypeValidator`](../../endpoints/validators/base/detector.py). The generic
condition handler alone cannot add detector packet data or detector-specific API fields.

## 8. Add Optional Compatibility and Frontend Support

These are separate decisions, not part of backend registration. See
[legacy compatibility](../maintainers/legacy-compatibility.md) for the broader boundary.

For the automation builder, add the matching frontend enum and node implementation.
Coordinate a separate frontend PR when needed:

- [`static/app/types/workflowEngine/dataConditions.tsx`](../../../../../static/app/types/workflowEngine/dataConditions.tsx)
- [`static/app/views/automations/components/dataConditionNodes.tsx`](../../../../../static/app/views/automations/components/dataConditionNodes.tsx)

The backend comparison schema does not generate the complete editor; current conditions
have explicit frontend nodes, defaults, details, and validation.

## Completion Checklist

- [ ] Reuse a built-in operator or existing handler when it already fits.
- [ ] Choose Detector trigger, Workflow WHEN, or Workflow IF and its runtime input type.
- [ ] Add the stable enum value and a registered handler with comparison/result schemas.
- [ ] Ensure normal app startup imports the registration.
- [ ] Add slow-query acquisition support only for a condition that requires it.
- [ ] Verify discovery metadata, serialization, contextual validation, and preview support.
- [ ] Test the handler and its consuming detector or Workflow stage.
- [ ] Add editor support only when the product requires it.

For shared runtime changes rather than a new handler, start at the maintainer
[condition reference](../maintainers/conditions.md) and its
[file map](../maintainers/conditions.md#file-map).
