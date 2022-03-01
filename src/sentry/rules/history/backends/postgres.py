from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Mapping, Sequence

from django.db.models import Count

from sentry.api.paginator import OffsetPaginator
from sentry.models import Group, RuleFireHistory
from sentry.rules.history.base import RuleGroupHistory, RuleHistoryBackend

if TYPE_CHECKING:
    from sentry.models import Rule
    from sentry.utils.cursors import Cursor, CursorResult


def convert_results(results: Sequence[Mapping[str, int]]) -> Sequence[RuleGroupHistory]:
    group_lookup = {g.id: g for g in Group.objects.filter(id__in=[r["group"] for r in results])}
    return [RuleGroupHistory(group_lookup[r["group"]], r["count"]) for r in results]


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
    ) -> CursorResult:
        qs = (
            RuleFireHistory.objects.filter(
                rule=rule,
                date_added__gte=start,
                date_added__lt=end,
            )
            .select_related("group")
            .values("group")
            .annotate(count=Count("id"))
        )
        return OffsetPaginator(
            qs, order_by=("-count", "group"), on_results=convert_results
        ).get_result(per_page, cursor)
