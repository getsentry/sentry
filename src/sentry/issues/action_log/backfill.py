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
from typing import NamedTuple

from django.db import connections, router, transaction
from django.utils import timezone

from sentry.issues.action_log.types import (
    SYSTEM_ACTOR,
    GroupAction,
    GroupActionActor,
    GroupActionType,
    PullRequestClosedAction,
    PullRequestMergedAction,
    PullRequestReopenedAction,
)
from sentry.issues.derived.processing import invalidate_group_derived_data
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.models.activity import Activity
from sentry.models.grouplink import GroupLink
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestLifecycleState,
    is_open_pull_request_state,
)
from sentry.utils import json, metrics
from sentry.utils.action_log.activity_translator import activity_to_action

logger = logging.getLogger(__name__)

BACKFILL_ACTIVITY_SOURCE = "backfill:activity"
BACKFILL_PR_LIFECYCLE_SOURCE = "backfill:pr-lifecycle"

_PR_LIFECYCLE_ACTION_TYPES = (
    GroupActionType.PULL_REQUEST_CLOSED,
    GroupActionType.PULL_REQUEST_REOPENED,
    GroupActionType.PULL_REQUEST_MERGED,
    GroupActionType.PULL_REQUEST_UNLINKED,
)


@dataclass(frozen=True)
class BackfillEntry:
    """A single action to backfill into a group's log."""

    action: GroupAction
    actor: GroupActionActor
    source: str
    date_added: datetime
    idempotency_key: str


class _PullRequestLifecycleDetails(NamedTuple):
    id: int
    state: str | None
    closed_at: datetime | None
    merged_at: datetime | None


def bulk_insert_action_log_entries(params: list[int | str | datetime], num_rows: int) -> int:
    """Low-level INSERT into GroupActionLogEntry with ON CONFLICT DO NOTHING.

    *params* is a flat list of values for *num_rows* rows, each with 10 columns:
    (group_id, project_id, type, actor_type, actor_id, source, data,
     date_added, date_updated, idempotency_key).

    Returns the number of rows actually inserted (via RETURNING).
    """
    if num_rows == 0:
        return 0

    sql = """
        INSERT INTO sentry_groupactionlogentry
            (group_id, project_id, type, actor_type, actor_id, source, data,
             date_added, date_updated, idempotency_key)
        VALUES %s
        ON CONFLICT (group_id, idempotency_key)
            WHERE idempotency_key IS NOT NULL
        DO NOTHING
        RETURNING id
    """
    values_template = "(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
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
                timezone.now(),  # date_updated
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


def _latest_pr_lifecycle_actions(
    *, group_id: int, project_id: int
) -> dict[int, GroupActionLogEntry]:
    """Map pull request id to its most recently logged lifecycle action.

    Entries are scanned oldest first so the last write per pull request wins.
    """
    latest_actions: dict[int, GroupActionLogEntry] = {}
    logged_entries = GroupActionLogEntry.objects.filter(
        group_id=group_id,
        project_id=project_id,
        type__in=_PR_LIFECYCLE_ACTION_TYPES,
    ).order_by("date_added", "id")
    for entry in logged_entries:
        data = entry.data
        if not isinstance(data, dict):
            continue
        try:
            pull_request_id = int(data["pull_request"])
        except (KeyError, TypeError, ValueError):
            continue
        latest_actions[pull_request_id] = entry
    return latest_actions


def _heal_has_other_open_prs(
    *,
    entry: GroupActionLogEntry,
    has_other_open_prs: bool,
) -> bool:
    """Heal the has_other_open_prs field on any action where it is present but null."""
    if "has_other_open_prs" not in entry.data or entry.data["has_other_open_prs"] is not None:
        return False

    entry.data = {**entry.data, "has_other_open_prs": has_other_open_prs}
    entry.save(update_fields=["data", "date_updated"])
    invalidate_group_derived_data(entry.group_id, cursor=(entry.date_added, entry.id))
    return True


def _get_new_pr_lifecycle_action(
    *,
    pull_request: _PullRequestLifecycleDetails,
    latest_action_type: int | None,
    has_other_open_prs: bool,
    group_id: int,
    project_id: int,
) -> (
    tuple[
        PullRequestClosedAction | PullRequestMergedAction | PullRequestReopenedAction,
        datetime | None,
    ]
    | None
):
    """Return the lifecycle action and timestamp missing from a pull request's log."""
    match pull_request.state:
        case PullRequestLifecycleState.MERGED:
            if latest_action_type == GroupActionType.PULL_REQUEST_MERGED:
                return None
            logger.info(
                "backfill_group_pr_lifecycle.merged",
                extra={
                    "group_id": group_id,
                    "project_id": project_id,
                    "pull_request_id": pull_request.id,
                    "state": pull_request.state,
                    "latest_action_type": latest_action_type,
                },
            )
            return (
                PullRequestMergedAction(
                    pull_request=pull_request.id,
                    has_other_open_prs=has_other_open_prs,
                ),
                pull_request.merged_at,
            )
        case PullRequestLifecycleState.CLOSED | PullRequestLifecycleState.SUPERSEDED:
            if latest_action_type == GroupActionType.PULL_REQUEST_CLOSED:
                return None
            logger.info(
                "backfill_group_pr_lifecycle.closed",
                extra={
                    "group_id": group_id,
                    "project_id": project_id,
                    "pull_request_id": pull_request.id,
                    "state": pull_request.state,
                    "latest_action_type": latest_action_type,
                },
            )
            return (
                PullRequestClosedAction(
                    pull_request=pull_request.id,
                    has_other_open_prs=has_other_open_prs,
                ),
                pull_request.closed_at,
            )
        case PullRequestLifecycleState.OPEN | PullRequestLifecycleState.LOCKED:
            # Reopen actions only make sense if we have previously logged a closed/merged action
            if latest_action_type not in (
                GroupActionType.PULL_REQUEST_CLOSED,
                GroupActionType.PULL_REQUEST_MERGED,
            ):
                return None
            # PullRequest does not store a reopened timestamp, so use the current time.
            date_added = timezone.now()
            logger.info(
                "backfill_group_pr_lifecycle.reopen",
                extra={
                    "group_id": group_id,
                    "project_id": project_id,
                    "pull_request_id": pull_request.id,
                    "state": pull_request.state,
                    "latest_action_type": latest_action_type,
                },
            )
            return PullRequestReopenedAction(pull_request=pull_request.id), date_added
        case _:
            # A null state is a legacy/unsynced pull request whose real state is unknown.
            logger.info(
                "backfill_group_pr_lifecycle.unknown_state",
                extra={
                    "group_id": group_id,
                    "project_id": project_id,
                    "pull_request_id": pull_request.id,
                    "state": pull_request.state,
                    "latest_action_type": latest_action_type,
                },
            )
            return None


def backfill_group_pr_lifecycle(*, group_id: int, project_id: int) -> int:
    """Backfill missing pull request lifecycle actions for a group.

    Each resolving pull request's current state is compared with its latest logged
    lifecycle action. Closed and merged actions use their persisted timestamps. An
    open pull request with a stale terminal action gets a synthetic reopen dated
    now because pull requests do not store a reopened timestamp.
    """
    pull_request_ids = list(
        GroupLink.objects.filter(
            group_id=group_id,
            project_id=project_id,
            linked_type=GroupLink.LinkedType.pull_request,
            relationship=GroupLink.Relationship.resolves,
        ).values_list("linked_id", flat=True)
    )
    if not pull_request_ids:
        return 0

    pull_requests = [
        _PullRequestLifecycleDetails(*pull_request)
        for pull_request in PullRequest.objects.filter(id__in=pull_request_ids).values_list(
            "id", "state", "closed_at", "merged_at"
        )
    ]
    open_pull_request_ids = {
        pull_request.id
        for pull_request in pull_requests
        if is_open_pull_request_state(pull_request.state)
    }

    latest_actions = _latest_pr_lifecycle_actions(group_id=group_id, project_id=project_id)

    entries: list[BackfillEntry] = []
    for pull_request in pull_requests:
        latest_action = latest_actions.get(pull_request.id)
        has_other_open_prs = bool(open_pull_request_ids - {pull_request.id})
        action_and_date = _get_new_pr_lifecycle_action(
            pull_request=pull_request,
            latest_action_type=latest_action.type if latest_action is not None else None,
            has_other_open_prs=has_other_open_prs,
            group_id=group_id,
            project_id=project_id,
        )
        if action_and_date is None:
            if latest_action is not None:
                _heal_has_other_open_prs(
                    entry=latest_action,
                    has_other_open_prs=has_other_open_prs,
                )
            continue
        action, date_added = action_and_date

        if date_added is None:
            logger.info(
                "backfill_group_pr_lifecycle.missing_timestamp",
                extra={
                    "group_id": group_id,
                    "project_id": project_id,
                    "pull_request_id": pull_request.id,
                    "state": pull_request.state,
                },
            )
            continue

        entries.append(
            BackfillEntry(
                action=action,
                actor=SYSTEM_ACTOR,
                source=BACKFILL_PR_LIFECYCLE_SOURCE,
                date_added=date_added,
                idempotency_key=f"pr-lifecycle:{pull_request.id}:{action.get_type().value}",
            )
        )

    entries.sort(key=lambda entry: entry.date_added)
    return backfill_actions(entries=entries, group_id=group_id, project_id=project_id)
