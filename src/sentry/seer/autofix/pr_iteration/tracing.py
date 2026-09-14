"""Span attributes for the automated PR-iteration flow.

adding uniquely identifying information to traces for PR iteration
for a given iteration we expect one trace for enqueue -> trigger -> consume and another for the completion hook

we usually resolve iteration id or trigger id later, and we have run id, org id available when a trace starts
"""

from __future__ import annotations

import sentry_sdk

ITERATION_ID_ATTRIBUTE = "pr_iteration.iteration_id"
TRIGGER_ID_ATTRIBUTE = "pr_iteration.trigger_id"


def set_pr_iteration_attributes(
    *,
    run_id: int | None = None,
    organization_id: int | None = None,
    group_id: int | None = None,
    iteration_id: int | None = None,
    trigger_id: str | None = None,
) -> None:
    """Attach a PR iteration's identity to the current root span.

    null values aren't set since we desire being able to pass partial dicts
    e.g. start with run & org, then later add iteration id
    """
    attributes = {
        "run_id": run_id,
        "organization_id": organization_id,
        "group_id": group_id,
        ITERATION_ID_ATTRIBUTE: iteration_id,
        TRIGGER_ID_ATTRIBUTE: trigger_id,
    }
    for name, value in attributes.items():
        if value is not None:
            sentry_sdk.set_attribute(name, value)
