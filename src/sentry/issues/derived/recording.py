from __future__ import annotations

from django.db import IntegrityError, router, transaction

from sentry.issues.derived.types import GroupAction, GroupActionActor
from sentry.issues.groupactionlogentry import GroupActionLogEntry


class DuplicateActionError(Exception):
    """Raised when an idempotency_key conflicts with an existing entry."""


def record_group_action(
    *,
    group_id: int,
    project_id: int,
    action: GroupAction,
    actor: GroupActionActor,
    idempotency_key: str | None = None,
) -> GroupActionLogEntry:
    """Append an entry to the group action log."""
    kwargs = dict(
        group_id=group_id,
        project_id=project_id,
        type=action.get_type().value,
        actor_type=actor.actor_type.value,
        actor_id=actor.actor_id,
        data=action.dict(),
        idempotency_key=idempotency_key,
    )

    if idempotency_key is None:
        return GroupActionLogEntry.objects.create(**kwargs)

    try:
        with transaction.atomic(using=router.db_for_write(GroupActionLogEntry)):
            return GroupActionLogEntry.objects.create(**kwargs)
    except IntegrityError as e:
        cause = e.__cause__
        constraint = getattr(getattr(cause, "diag", None), "constraint_name", None)
        if constraint == "uniq_groupactionlogentry_group_idempotency_key":
            raise DuplicateActionError(
                f"Action already recorded for group {group_id} "
                f"with idempotency_key={idempotency_key!r}"
            ) from e
        raise
