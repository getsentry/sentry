from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, TypedDict

from django.db import connection
from django.db.models import Count, Max, OuterRef, Subquery
from django.db.models.functions import TruncHour

from sentry.api.paginator import GenericOffsetPaginator, OffsetPaginator
from sentry.models.group import Group
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.rules.history.base import RuleGroupHistory, RuleHistoryBackend, TimeSeriesValue
from sentry.utils.cursors import Cursor, CursorResult
from sentry.workflow_engine.models import AlertRuleWorkflow

if TYPE_CHECKING:
    from sentry.models.rule import Rule

logger = logging.getLogger(__name__)


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
    def get_group_by_cols(self, alias=None) -> list:
        return []


class PostgresRuleHistoryBackend(RuleHistoryBackend):
    def record(
        self,
        rule: Rule,
        group: Group,
        event_id: str | None = None,
        notification_uuid: str | None = None,
    ) -> RuleFireHistory | None:
        return RuleFireHistory.objects.create(
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
    ) -> CursorResult[RuleGroupHistory]:
        try:
            alert_rule_workflow = AlertRuleWorkflow.objects.get(rule_id=rule.id)
            workflow = alert_rule_workflow.workflow

            # Performs the raw SQL query with pagination
            def data_fn(offset: int, limit: int) -> list[_Result]:
                query = """
                    WITH combined_data AS (
                        SELECT group_id, date_added, event_id
                        FROM sentry_rulefirehistory
                        WHERE rule_id = %s AND date_added >= %s AND date_added < %s
                        UNION ALL
                        SELECT group_id, date_added, event_id
                        FROM workflow_engine_workflowfirehistory
                        WHERE workflow_id = %s
                        AND date_added >= %s AND date_added < %s
                    )
                    SELECT
                        group_id as group,
                        COUNT(*) as count,
                        MAX(date_added) as last_triggered,
                        (ARRAY_AGG(event_id ORDER BY date_added DESC))[1] as event_id
                    FROM combined_data
                    GROUP BY group_id
                    ORDER BY count DESC, last_triggered DESC
                    LIMIT %s OFFSET %s
                """

                with connection.cursor() as cursor:
                    cursor.execute(
                        query, [rule.id, start, end, workflow.id, start, end, limit, offset]
                    )
                    return [
                        _Result(
                            group=row[0],
                            count=row[1],
                            last_triggered=row[2],
                            event_id=row[3],
                        )
                        for row in cursor.fetchall()
                    ]

            result = GenericOffsetPaginator(data_fn=data_fn).get_result(per_page, cursor)
            result.results = convert_results(result.results)

            return result

        except AlertRuleWorkflow.DoesNotExist:
            # If no workflow is associated with this rule, just use the original behavior
            logger.exception("No workflow associated with rule", extra={"rule_id": rule.id})
            pass

        rule_filtered_history = RuleFireHistory.objects.filter(
            rule=rule,
            date_added__gte=start,
            date_added__lt=end,
        )

        # subquery that retrieves row with the largest date in a group for RuleFireHistory
        rule_group_max_dates = rule_filtered_history.filter(group=OuterRef("group")).order_by(
            "-date_added"
        )[:1]
        qs = (
            rule_filtered_history.select_related("group")
            .values("group")
            .annotate(count=Count("group"))
            .annotate(event_id=NoGroupBySubquery(rule_group_max_dates.values("event_id")))
            .annotate(last_triggered=Max("date_added"))
        )

        return OffsetPaginator(
            qs, order_by=("-count", "-last_triggered"), on_results=convert_results
        ).get_result(per_page, cursor)

    def fetch_rule_hourly_stats(
        self, rule: Rule, start: datetime, end: datetime
    ) -> Sequence[TimeSeriesValue]:
        start = start.replace(tzinfo=timezone.utc)
        end = end.replace(tzinfo=timezone.utc)

        existing_data: dict[datetime, TimeSeriesValue] = {}

        try:
            alert_rule_workflow = AlertRuleWorkflow.objects.get(rule_id=rule.id)
            workflow = alert_rule_workflow.workflow

            # Use raw SQL to combine data from both tables
            with connection.cursor() as db_cursor:
                db_cursor.execute(
                    """
                    SELECT
                        DATE_TRUNC('hour', date_added) as bucket,
                        COUNT(*) as count
                    FROM (
                        SELECT date_added
                        FROM sentry_rulefirehistory
                        WHERE rule_id = %s
                            AND date_added >= %s
                            AND date_added < %s

                        UNION ALL

                        SELECT date_added
                        FROM workflow_engine_workflowfirehistory
                        WHERE workflow_id = %s
                            AND date_added >= %s
                            AND date_added < %s
                    ) combined_data
                    GROUP BY DATE_TRUNC('hour', date_added)
                    ORDER BY bucket
                    """,
                    [rule.id, start, end, workflow.id, start, end],
                )

                results = db_cursor.fetchall()

            # Convert raw SQL results to the expected format
            existing_data = {row[0]: TimeSeriesValue(row[0], row[1]) for row in results}

        except AlertRuleWorkflow.DoesNotExist:
            # If no workflow is associated with this rule, just use the original behavior
            logger.exception("No workflow associated with rule", extra={"rule_id": rule.id})
            pass

        if not existing_data:
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
            existing_data = {
                row["bucket"]: TimeSeriesValue(row["bucket"], row["count"]) for row in qs
            }

        # Fill in gaps with zero values for missing hours
        results = []
        current = start.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
        while current <= end.replace(minute=0, second=0, microsecond=0):
            results.append(existing_data.get(current, TimeSeriesValue(current, 0)))
            current += timedelta(hours=1)
        return results
