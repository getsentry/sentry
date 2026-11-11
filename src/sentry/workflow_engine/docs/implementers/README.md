# Implementer Guide

Build on Workflow Engine when a product needs to turn data into issues or react to
issues with configurable actions. Start with the [Workflow Engine introduction](../../README.md)
for the purpose and vocabulary. This guide is for product implementers; engine internals
live in the [Maintainer Guide](../maintainers/README.md).

## Choose the Smallest Integration

| You Need To…                                                                | Build or Configure                                                                  | Guide                            |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------- |
| Detect a new kind of problem from product data                              | A detector implementation, its settings, and a producer integration                 | [Add a Detector](detectors.md)   |
| Change when or where to react to issues already produced by a detector      | A workflow connected to that detector, with WHEN conditions, IF groups, and actions | [Add a Workflow](workflows.md)   |
| Add a check that existing detector or workflow configuration cannot express | A registered condition handler with the right input and result contract             | [Add a Condition](conditions.md) |

A new workflow usually needs **configuration, not a new processor or handler**.
A new detector type is needed only when existing detection cannot express the product's
semantics. Check the existing product integration before adding either type.

## Before You Start

Identify the integration's input and policy before writing code:

- **Input:** raw product data that needs detection, an existing issue event, or a
  supported issue activity? Existing issues need a workflow connection, not another
  detection pipeline.
- **Detection:** can an existing detector type express the check, or does your product
  need its own evaluation and issue content?
- **Policy:** which inputs should trigger actions, which additional filters apply, and
  should the workflow be global or environment-specific?
- **Extensions:** can registered conditions and actions express that policy? Add a
  handler only for missing behavior, not for each new configuration.

Follow the selected task guide; use its verification checklist to confirm the complete
path from your input to the intended issue or action.

## What You Own and What You Reuse

**Product code owns** data production, product-specific evaluation and issue content,
and the configuration or provisioning needed for its integration. Detector handlers
normally live in the owning product module, not in `workflow_engine`.

**Reuse the engine** for the configured detector/workflow graph, shared condition
execution, supported stateful detector behavior, delayed workflow condition evaluation,
and action scheduling. Reuse registered actions instead of sending notifications from
a detector. This keeps detection independent of notification policy.

The task guides include focused verification checklists and working code references.
For deeper questions, follow their links to the canonical [data model](../maintainers/data-model.md),
[execution trace](../maintainers/execution.md), or
[condition contracts](../maintainers/conditions.md). These are references, not required
reading before starting an integration.
