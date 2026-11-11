# Implementer Guide

Build on Workflow Engine when a product needs to evaluate data, produce an outcome,
or respond to events with configurable actions. Start with the
[Workflow Engine introduction](../../README.md) for the outcome/artifact/event model.
This guide is for product implementers; engine internals live in the
[Maintainer Guide](../maintainers/README.md).

The task guides use the current Issue Platform integration as a worked implementation.
See [Current Implementation and Examples](../../README.md#current-implementation-and-examples)
for the supported payload and ingress boundaries; these examples do not define every
artifact as an issue or every action as a notification.

## Choose the Smallest Integration

| You Need To…                                                                | Build or Configure                                                                 | Guide                            |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------- |
| Evaluate product data and produce or update an artifact                     | A detector implementation, outcome integration, settings, and producer integration | [Add a Detector](detectors.md)   |
| Change how to respond to events from an existing artifact                   | A workflow with WHEN conditions, IF groups, actions, and a supported event input   | [Add a Workflow](workflows.md)   |
| Add a check that existing detector or workflow configuration cannot express | A registered condition handler with the right input and result contract            | [Add a Condition](conditions.md) |

A new workflow usually needs **configuration, not a new processor or handler**.
A new detector type is needed only when existing detection cannot express the product's
semantics. Check the existing product integration before adding either type.

## Before You Start

Identify the integration's input and policy before writing code:

- **Input:** raw product data that needs evaluation, or an event from an existing
  artifact? An existing event source needs a workflow integration, not another
  detection pipeline.
- **Outcome:** what should the evaluation produce or change, and which outcome handler
  supports that artifact? Choose this before assuming an issue type is required.
- **Detection:** can an existing detector type express the evaluation, or does your
  product need its own logic and output?
- **Policy:** which inputs should trigger actions, which additional filters apply, and
  should the workflow be global or environment-specific?
- **Extensions:** can registered conditions and actions express that policy? Add a
  handler only for missing behavior, not for each new configuration.

Follow the selected task guide; use its verification checklist to confirm the complete
path from your input to the intended artifact change or action.

## What You Own and What You Reuse

**Product code owns** data production, product-specific evaluation, artifact semantics,
event integration, and action behavior, plus the configuration or provisioning needed
for its integration. Detector handlers normally live in the owning product module,
not in `workflow_engine`.

**Reuse the engine** for the configured detector/workflow graph, shared condition
execution, outcome dispatch, supported stateful detector behavior, delayed workflow
condition evaluation, and action scheduling. Keep response policy in workflows instead
of embedding it in detector evaluation. Outcome and action handlers can reuse existing
integrations; a new detector or workflow does not imply a new handler for each stage.

The task guides include focused verification checklists and working code references.
For deeper questions, follow their links to the canonical [data model](../maintainers/data-model.md),
[execution trace](../maintainers/execution.md), or
[condition contracts](../maintainers/conditions.md). These are references, not required
reading before starting an integration.
