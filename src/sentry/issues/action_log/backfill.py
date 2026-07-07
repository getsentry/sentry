"""
Backfill helpers for the group action log.

These are separated from the main publish path because backfill code has
different semantics: entries arrive with explicit timestamps and idempotency
keys, bypass the outbox, and must invalidate derived data after insertion.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

from django.db import router, transaction

from sentry.issues.action_log.types import (
    SYSTEM_ACTOR,
    GroupAction,
    GroupActionActor,
)
from sentry.issues.derived.processing import invalidate_group_derived_data
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.models.activity import Activity
from sentry.utils import metrics
from sentry.utils.action_log.activity_translator import activity_to_action

logger = logging.getLogger(__name__)

BACKFILL_ACTIVITY_SOURCE = "backfill:activity"


@dataclass(frozen=True)
class BackfillEntry:
    """A single action to backfill into a group's log."""

    action: GroupAction
    actor: GroupActionActor
    source: str
    date_added: datetime
    idempotency_key: str


def backfill_actions(
    *,
    entries: Sequence[BackfillEntry],
    group_id: int,
    project_id: int,
) -> int:
    """Insert historical action log entries for a group and invalidate derived data.

    *entries* must be sorted by ``date_added`` ascending. Each entry's
    ``idempotency_key`` is used for deduplication: rows whose idempotency key
    already exists for this group are skipped.

    After the batch is committed, ``invalidate_group_derived_data`` is called
    with the earliest new entry's timestamp so that derived state is recomputed
    from that point forward.

    Returns the number of entries submitted (an upper bound; duplicates
    are silently skipped at the DB level).
    """
    if not entries:
        return 0

    for i in range(1, len(entries)):
        if entries[i].date_added < entries[i - 1].date_added:
            raise ValueError("entries must be sorted by date_added ascending")

    objects = [
        GroupActionLogEntry(
            group_id=group_id,
            project_id=project_id,
            type=entry.action.get_type().value,
            actor_type=entry.actor.actor_type.value,
            actor_id=entry.actor.actor_id,
            source=entry.source,
            data=entry.action.dict(),
            date_added=entry.date_added,
            idempotency_key=entry.idempotency_key,
        )
        for entry in entries
    ]

    using = router.db_for_write(GroupActionLogEntry)
    with transaction.atomic(using=using):
        GroupActionLogEntry.objects.bulk_create(
            objects,
            ignore_conflicts=True,
            unique_fields=["group_id", "idempotency_key"],
        )

    metrics.incr(
        "issues.action_log.backfill",
        amount=len(entries),
        tags={"actor_type": entries[0].actor.actor_type.name.lower()},
    )

    # entries are sorted ascending, so [0] is the earliest.
    invalidate_group_derived_data(group_id, cursor=(entries[0].date_added, 0))

    return len(entries)


def backfill_group_activities(
    *,
    group_id: int,
    project_id: int,
    batch_size: int = 500,
) -> int:
    """Backfill translatable Activity records into the action log for a group.

    Processes activities from newest to oldest in chunks of *batch_size*.
    Idempotent: safe to call multiple times for the same group.

    Returns the total number of new entries created.
    """
    total_created = 0
    cursor: int | None = None

    while True:
        qs = Activity.objects.filter(group_id=group_id)
        if cursor is not None:
            qs = qs.filter(id__lt=cursor)
        batch = list(qs.order_by("-id")[:batch_size])

        if not batch:
            break

        entries: list[BackfillEntry] = []
        for act in batch:
            action = activity_to_action(act)
            if action is None:
                continue
            actor = GroupActionActor.user(act.user_id) if act.user_id else SYSTEM_ACTOR
            entries.append(
                BackfillEntry(
                    action=action,
                    actor=actor,
                    source=BACKFILL_ACTIVITY_SOURCE,
                    date_added=act.datetime,
                    idempotency_key=f"activity:{act.id}",
                )
            )

        if entries:
            entries.sort(key=lambda e: e.date_added)
            total_created += backfill_actions(
                entries=entries, group_id=group_id, project_id=project_id
            )

        cursor = batch[-1].id

    return total_created
