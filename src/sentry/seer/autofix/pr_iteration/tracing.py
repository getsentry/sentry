"""Span attributes for the automated PR-iteration flow.

The flow runs as four separate root spans -- enqueue, trigger, consume, and the
completion hook -- so one iteration cannot be followed by trace id alone. Each
stage calls :func:`set_pr_iteration_attributes` as soon as it has resolved its
identity, and these ids are what join the four back together in search.

The run, organization and group are the ids every stage can resolve. The
iteration and trigger ids only exist once a stage has resolved them, so those
stages pass them the moment they do.

Writes go to the Sentry scope, which back-fills them onto the root span at flush
time, so a stage may call this after the work it describes has finished. That
holds only under span streaming; without it the SDK drops scope attributes and
every name goes missing.
"""

from __future__ import annotations

import sentry_sdk


def set_pr_iteration_attributes(
    *,
    run_id: int | None = None,
    organization_id: int | None = None,
    group_id: int | None = None,
    iteration_id: int | None = None,
    trigger_id: str | None = None,
) -> None:
    """Attach this stage's identity to the current root span.

    A ``None`` is dropped rather than written, so a stage that resolved only
    some of the ids still records those.
    """
    attributes = {
        "run_id": run_id,
        "organization_id": organization_id,
        "group_id": group_id,
        "iteration_id": iteration_id,
        "trigger_id": trigger_id,
    }
    for name, value in attributes.items():
        if value is not None:
            sentry_sdk.set_attribute(name, value)
