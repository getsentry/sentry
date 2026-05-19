from __future__ import annotations

from sentry.issues.derived.types import ActionActor, IssueAction
from sentry.models.issueactionlogentry import IssueActionLogEntry


def record(
    *,
    group_id: int,
    project_id: int,
    action: IssueAction,
    actor: ActionActor,
) -> IssueActionLogEntry:
    """Append an entry to the issue action log."""
    return IssueActionLogEntry.objects.create(
        group_id=group_id,
        project_id=project_id,
        type=action.get_type().value,
        actor_type=actor.actor_type.value,
        actor_id=actor.actor_id,
        data=action.dict(),
    )
