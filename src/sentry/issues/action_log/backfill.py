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

from django.db import connections, router, transaction

from sentry.issues.action_log.types import (
    SYSTEM_ACTOR,
    GroupAction,
    GroupActionActor,
)
from sentry.issues.derived.processing import invalidate_group_derived_data
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.models.activity import Activity
from sentry.utils import json, metrics
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


def bulk_insert_action_log_entries(params: list[int | str | datetime], num_rows: int) -> int:
    """Low-level INSERT into GroupActionLogEntry with ON CONFLICT DO NOTHING.

    *params* is a flat list of values for *num_rows* rows, each with 9 columns:
    (group_id, project_id, type, actor_type, actor_id, source, data,
     date_added, idempotency_key).

    Returns the number of rows actually inserted (via RETURNING).
    """
    if num_rows == 0:
        return 0

    sql = """
        INSERT INTO sentry_groupactionlogentry
            (group_id, project_id, type, actor_type, actor_id, source, data,
             date_added, idempotency_key)
        VALUES %s
        ON CONFLICT (group_id, idempotency_key)
            WHERE idempotency_key IS NOT NULL
        DO NOTHING
        RETURNING id
    """
    values_template = "(%s, %s, %s, %s, %s, %s, %s, %s, %s)"
    values_clause = ", ".join(values_template for _ in range(num_rows))
    using = router.db_for_write(GroupActionLogEntry)
    with connections[using].cursor() as cursor:
        cursor.execute(sql % values_clause, params)
        return len(cursor.fetchall())


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

    Returns the number of rows actually inserted.
    """
    if not entries:
        return 0

    for i in range(1, len(entries)):
        if entries[i].date_added < entries[i - 1].date_added:
            raise ValueError("entries must be sorted by date_added ascending")

    params: list[int | str | datetime] = []
    for entry in entries:
        params.extend(
            [
                group_id,
                project_id,
                entry.action.get_type().value,
                entry.actor.actor_type.value,
                entry.actor.actor_id,
                entry.source,
                json.dumps(entry.action.dict()),
                entry.date_added,
                entry.idempotency_key,
            ]
        )

    with transaction.atomic(using=router.db_for_write(GroupActionLogEntry)):
        inserted = bulk_insert_action_log_entries(params, len(entries))

    metrics.incr("issues.action_log.backfill", amount=inserted, sample_rate=1.0)

    if inserted:
        # entries are sorted ascending, so [0] is the earliest.
        invalidate_group_derived_data(group_id, cursor=(entries[0].date_added, 0))

    return inserted


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
    total_skipped = 0
    batch_num = 0
    cursor: int | None = None

    while True:
        qs = Activity.objects.filter(group_id=group_id)
        if cursor is not None:
            qs = qs.filter(id__gt=cursor)
        batch = list(qs.order_by("id")[:batch_size])

        if not batch:
            break

        batch_num += 1
        entries: list[BackfillEntry] = []
        skipped = 0
        for act in batch:
            try:
                action = activity_to_action(act)
            except Exception:
                logger.exception(
                    "backfill_group_activities.translation_error",
                    extra={"activity_id": act.id, "activity_type": act.type, "group_id": group_id},
                )
                skipped += 1
                continue
            if action is None:
                skipped += 1
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

        total_skipped += skipped
        cursor = batch[-1].id

        logger.info(
            "backfill_group_activities.batch_complete",
            extra={
                "group_id": group_id,
                "batch_num": batch_num,
                "batch_activities": len(batch),
                "batch_converted": len(entries),
                "batch_skipped": skipped,
                "total_created": total_created,
            },
        )

    return total_created
