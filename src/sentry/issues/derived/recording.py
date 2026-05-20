from __future__ import annotations

from sentry.issues.derived.types import ActionActor, GroupAction
from sentry.models.groupactionlogentry import GroupActionLogEntry


def record(
    *,
    group_id: int,
    project_id: int,
    action: GroupAction,
    actor: ActionActor,
) -> GroupActionLogEntry:
    """Append an entry to the group action log."""
    return GroupActionLogEntry.objects.create(
        group_id=group_id,
        project_id=project_id,
        type=action.get_type().value,
        actor_type=actor.actor_type.value,
        actor_id=actor.actor_id,
        data=action.dict(),
    )
