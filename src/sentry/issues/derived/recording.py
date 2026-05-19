from __future__ import annotations

from sentry.issues.derived.types import IssueAction, IssueActionType  # noqa: F401 — re-exported
from sentry.models.issueactionlogentry import ActorType, IssueActionLogEntry


def record(
    *,
    group_id: int,
    project_id: int,
    action: IssueAction,
    user_id: int | None,
) -> IssueActionLogEntry:
    """
    Record an action to the issue action log.

    The action's pydantic fields are the sole source of the data payload.
    All data must be expressed as fields on the IssueAction subclass so it is
    validated at construction time.

    Pass user_id for user-initiated actions, or None for system-initiated actions.
    """
    if user_id is not None:
        actor_type = ActorType.USER
        actor_id = user_id
    else:
        actor_type = ActorType.SYSTEM
        actor_id = 0

    return IssueActionLogEntry.objects.create(
        group_id=group_id,
        project_id=project_id,
        type=action.get_type().value,
        actor_type=actor_type.value,
        actor_id=actor_id,
        data=action.dict(),
    )
