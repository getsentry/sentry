from __future__ import annotations

from sentry.issues.derived.types import IssueAction, IssueActionType  # noqa: F401 — re-exported
from sentry.models.issueactionlog import IssueActionLog


def record(
    *,
    group_id: int,
    action: IssueAction,
    user_id: int | None = None,
) -> bool:
    """
    Record an action to IssueActionLog and process derived data inline.

    The action's pydantic fields are the sole source of the data payload.
    All data must be expressed as fields on the IssueAction subclass so it is
    validated at construction time.

    Processes a small batch of pending entries synchronously. If there's
    a backlog beyond what fits in one inline batch, schedules a background
    task to drain the rest.

    Returns True if derived data is fully caught up after this call,
    False if a background task was needed.

    Actor is identified by user_id (nullable for system-initiated actions).
    """
    IssueActionLog.objects.create(
        group_id=group_id,
        type=action.get_type().value,
        user_id=user_id,
        data=action.dict(),
    )

    from sentry.issues.derived.processing import process_group_log_batch

    result = process_group_log_batch(group_id)
    if not result.caught_up:
        from sentry.tasks.process_group_log import process_group_log_task

        process_group_log_task.delay(group_id)

    return result.caught_up
