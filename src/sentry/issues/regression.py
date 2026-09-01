from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import UTC, datetime

from django.db import router, transaction
from django.db.models import OuterRef, Q, Subquery
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from sentry.models.grouphistory import RESOLVED_STATUSES, GroupHistory, GroupHistoryStatus
from sentry.models.groupmeta import GroupMeta

logger = logging.getLogger(__name__)

LATEST_REGRESSION_AT_META_KEY = "sentry:latest_regression_at"

_ISSUE_STATE_HISTORY_STATUSES = (
    GroupHistoryStatus.ONGOING,
    *RESOLVED_STATUSES,
    GroupHistoryStatus.IGNORED,
    GroupHistoryStatus.UNIGNORED,
    GroupHistoryStatus.REGRESSED,
    GroupHistoryStatus.ESCALATING,
    GroupHistoryStatus.ARCHIVED_UNTIL_ESCALATING,
    GroupHistoryStatus.ARCHIVED_FOREVER,
    GroupHistoryStatus.ARCHIVED_UNTIL_CONDITION_MET,
)


def _parse_stored_regression_at(group_id: int, value: str) -> datetime | None:
    try:
        parsed = parse_datetime(value)
    except (TypeError, ValueError, OverflowError):
        parsed = None

    if parsed is None or timezone.is_naive(parsed):
        logger.warning(
            "issues.latest_regression.invalid_group_meta",
            extra={"group_id": group_id},
        )
        return None

    return parsed.astimezone(UTC)


def _get_latest_history_regression_at(group_ids: Sequence[int]) -> datetime | None:
    previous_status = (
        GroupHistory.objects.filter(
            group_id=OuterRef("group_id"),
            status__in=_ISSUE_STATE_HISTORY_STATUSES,
        )
        .filter(
            Q(date_added__lt=OuterRef("date_added"))
            | Q(date_added=OuterRef("date_added"), id__lt=OuterRef("id"))
        )
        .order_by("-date_added", "-id")
        .values("status")[:1]
    )

    return (
        GroupHistory.objects.filter(
            group_id__in=group_ids,
            status__in=(GroupHistoryStatus.REGRESSED, GroupHistoryStatus.ONGOING),
        )
        .alias(previous_status=Subquery(previous_status))
        .filter(
            Q(status=GroupHistoryStatus.REGRESSED)
            | Q(
                status=GroupHistoryStatus.ONGOING,
                previous_status__in=RESOLVED_STATUSES,
            )
        )
        .order_by("-date_added", "-id")
        .values_list("date_added", flat=True)
        .first()
    )


def get_latest_regression_at(group_ids: Sequence[int]) -> datetime | None:
    """Return the newest explicit or manual regression boundary for the given issues."""
    unique_group_ids = tuple(set(group_ids))
    if not unique_group_ids:
        return None

    latest_regression_at = _get_latest_history_regression_at(unique_group_ids)
    stored_values = GroupMeta.objects.filter(
        group_id__in=unique_group_ids,
        key=LATEST_REGRESSION_AT_META_KEY,
    ).values_list("group_id", "value")

    for group_id, value in stored_values:
        stored_regression_at = _parse_stored_regression_at(group_id, value)
        if stored_regression_at is not None and (
            latest_regression_at is None or stored_regression_at > latest_regression_at
        ):
            latest_regression_at = stored_regression_at

    return latest_regression_at


def advance_latest_regression_at(group_ids: Sequence[int], regression_at: datetime) -> None:
    """Monotonically persist a regression boundary for one or more issues."""
    unique_group_ids = tuple(sorted(set(group_ids)))
    if not unique_group_ids:
        return
    if timezone.is_naive(regression_at):
        raise ValueError("regression_at must be timezone-aware")

    regression_at = regression_at.astimezone(UTC)
    stored_value = regression_at.isoformat()
    database = router.db_for_write(GroupMeta)

    with transaction.atomic(using=database):
        GroupMeta.objects.using(database).bulk_create(
            [
                GroupMeta(
                    group_id=group_id,
                    key=LATEST_REGRESSION_AT_META_KEY,
                    value=stored_value,
                )
                for group_id in unique_group_ids
            ],
            ignore_conflicts=True,
        )
        group_metas = list(
            GroupMeta.objects.using(database)
            .select_for_update()
            .filter(
                group_id__in=unique_group_ids,
                key=LATEST_REGRESSION_AT_META_KEY,
            )
            .order_by("group_id")
        )

        group_metas_to_update = []
        for group_meta in group_metas:
            current_regression_at = _parse_stored_regression_at(
                group_meta.group_id, group_meta.value
            )
            if current_regression_at is None or current_regression_at < regression_at:
                group_meta.value = stored_value
                group_metas_to_update.append(group_meta)

        if group_metas_to_update:
            GroupMeta.objects.using(database).bulk_update(group_metas_to_update, ["value"])


def preserve_latest_regression_at(source_group_id: int, target_group_id: int) -> None:
    """Fold the source cutoff into the target before merge deletes the source history."""
    latest_regression_at = get_latest_regression_at((source_group_id, target_group_id))
    if latest_regression_at is None:
        return

    advance_latest_regression_at((target_group_id,), latest_regression_at)
