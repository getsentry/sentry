from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, List, Optional, Sequence, TypedDict, cast

from django.db.models import Count, Max, OuterRef, Subquery
from django.db.models.functions import TruncHour

from sentry.api.paginator import OffsetPaginator
from sentry.models.group import Group
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.rules.history.base import RuleGroupHistory, RuleHistoryBackend, TimeSeriesValue
from sentry.utils.cursors import CursorResult

if TYPE_CHECKING:
    from sentry.models.rule import Rule
    from sentry.utils.cursors import Cursor


class _Result(TypedDict):
    group: int
    count: int
    last_triggered: datetime
    event_id: str


def convert_results(results: Sequence[_Result]) -> Sequence[RuleGroupHistory]:
    group_lookup = {g.id: g for g in Group.objects.filter(id__in=[r["group"] for r in results])}
    return [
        RuleGroupHistory(group_lookup[r["group"]], r["count"], r["last_triggered"], r["event_id"])
        for r in results
    ]


# temporary hack for removing unnecessary subqueries from group by list
# TODO: remove when upgrade to django 3.0
class NoGroupBySubquery(Subquery):
    def get_group_by_cols(self, alias=None) -> List:
        return []


class PostgresRuleHistoryBackend(RuleHistoryBackend):
    def record(
        self,
        rule: Rule,
        group: Group,
        event_id: Optional[str] = None,
        notification_uuid: Optional[str] = None,
    ) -> None:
        RuleFireHistory.objects.create(
            project=rule.project,
            rule=rule,
            group=group,
            event_id=event_id,
            notification_uuid=notification_uuid,
        )

    def fetch_rule_groups_paginated(
        self,
        rule: Rule,
        start: datetime,
        end: datetime,
        cursor: Cursor | None = None,
        per_page: int = 25,
    ) -> CursorResult[Group]:
        filtered_history = RuleFireHistory.objects.filter(
            rule=rule,
            date_added__gte=start,
            date_added__lt=end,
        )

        # subquery that retrieves row with the largest date in a group
        group_max_dates = filtered_history.filter(group=OuterRef("group")).order_by("-date_added")[
            :1
        ]
        qs = (
            filtered_history.select_related("group")
            .values("group")
            .annotate(count=Count("group"))
            .annotate(event_id=NoGroupBySubquery(group_max_dates.values("event_id")))
            .annotate(last_triggered=Max("date_added"))
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
        start = start.replace(tzinfo=timezone.utc)
        end = end.replace(tzinfo=timezone.utc)
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
