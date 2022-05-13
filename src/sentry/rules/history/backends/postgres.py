from __future__ import annotations

from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Sequence, TypedDict, cast

import pytz
from django.db.models import Count, Max
from django.db.models.functions import TruncHour

from sentry.api.paginator import OffsetPaginator
from sentry.models import Group, RuleFireHistory
from sentry.rules.history.base import RuleGroupHistory, RuleHistoryBackend, TimeSeriesValue
from sentry.utils.cursors import CursorResult

if TYPE_CHECKING:
    from sentry.models import Rule
    from sentry.utils.cursors import Cursor


class _Result(TypedDict):
    group: int
    count: int
    last_triggered: datetime


def convert_results(results: Sequence[_Result]) -> Sequence[RuleGroupHistory]:
    group_lookup = {g.id: g for g in Group.objects.filter(id__in=[r["group"] for r in results])}
    return [
        RuleGroupHistory(group_lookup[r["group"]], r["count"], r["last_triggered"]) for r in results
    ]


class PostgresRuleHistoryBackend(RuleHistoryBackend):
    def record(self, rule: Rule, group: Group) -> None:
        RuleFireHistory.objects.create(project=rule.project, rule=rule, group=group)

    def fetch_rule_groups_paginated(
        self,
        rule: Rule,
        start: datetime,
        end: datetime,
        cursor: Cursor | None = None,
        per_page: int = 25,
    ) -> CursorResult[Group]:
        qs = (
            RuleFireHistory.objects.filter(
                rule=rule,
                date_added__gte=start,
                date_added__lt=end,
            )
            .select_related("group")
            .values("group")
            .annotate(count=Count("id"), last_triggered=Max("date_added"))
        )
        # TODO: Add types to paginators and remove this
        return cast(
            CursorResult[Group],
            OffsetPaginator(
                qs, order_by=("-count", "-last_triggered"), on_results=convert_results
            ).get_result(per_page, cursor),
        )

    def fetch_rule_hourly_stats(
        self, rule: Rule, start: datetime, end: datetime
    ) -> Sequence[TimeSeriesValue]:
        start = start.replace(tzinfo=pytz.utc)
        end = end.replace(tzinfo=pytz.utc)
        qs = (
            RuleFireHistory.objects.filter(
                rule=rule,
                date_added__gte=start,
                date_added__lt=end,
            )
            .annotate(bucket=TruncHour("date_added"))
            .order_by("bucket")
            .values("bucket")
            .annotate(count=Count("id"))
        )
        existing_data = {row["bucket"]: TimeSeriesValue(row["bucket"], row["count"]) for row in qs}

        results = []
        current = start.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
        while current <= end.replace(minute=0, second=0, microsecond=0):
            results.append(existing_data.get(current, TimeSeriesValue(current, 0)))
            current += timedelta(hours=1)
        return results
