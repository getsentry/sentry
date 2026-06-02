from __future__ import annotations

from sentry.issues.action_log.recording import record_group_action
from sentry.issues.action_log.types import GroupAction, GroupActionActor


def record(
    *,
    group_id: int,
    project_id: int,
    action: GroupAction,
    actor: GroupActionActor,
) -> bool:
    """
    Record an action to the group action log and process derived data inline.

    Processes a small batch of pending entries synchronously. If there's
    a backlog beyond what fits in one inline batch, schedules a background
    task to drain the rest.

    Returns True if derived data is fully caught up after this call,
    False if a background task was needed.
    """
    record_group_action(
        group_id=group_id,
        project_id=project_id,
        action=action,
        actor=actor,
    )

    from sentry.issues.derived.processing import process_group_log_batch

    result = process_group_log_batch(group_id)
    if not result.caught_up:
        from sentry.tasks.process_group_log import process_group_log_task

        process_group_log_task.delay(group_id)

    return result.caught_up
