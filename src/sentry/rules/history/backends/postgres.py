from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import datetime, timedelta, timezone
from typing import TypedDict

from django.db import connection

from sentry.api.paginator import GenericOffsetPaginator
from sentry.models.group import Group
from sentry.models.rule import Rule
from sentry.rules.history.base import RuleGroupHistory, RuleHistoryBackend, TimeSeriesValue
from sentry.utils.cursors import Cursor, CursorResult
from sentry.workflow_engine.models.workflow import Workflow

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


def convert_hourly_stats(
    existing_data: dict[datetime, TimeSeriesValue], start: datetime, end: datetime
) -> list[TimeSeriesValue]:
    results = []
    current = start.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    while current <= end.replace(minute=0, second=0, microsecond=0):
        results.append(existing_data.get(current, TimeSeriesValue(current, 0)))
        current += timedelta(hours=1)
    return results


class PostgresRuleHistoryBackend(RuleHistoryBackend):
    def _fetch_workflow_fire_history(
        self,
        workflow_id: int | None,
        start: datetime,
        end: datetime,
        per_page: int,
        cursor: Cursor | None = None,
    ) -> CursorResult[RuleGroupHistory]:
        """
        Look up WorkflowFireHistory. Performs the raw SQL query with pagination.
        """

        def data_fn(offset: int, limit: int) -> list[_Result]:
            query = """
                SELECT
                    group_id as group,
                    COUNT(*) as count,
                    MAX(date_added) as last_triggered,
                    (ARRAY_AGG(event_id ORDER BY date_added DESC))[1] as event_id
                FROM workflow_engine_workflowfirehistory
                WHERE workflow_id = %s AND date_added >= %s AND date_added < %s
                GROUP BY group_id
                ORDER BY count DESC, last_triggered DESC
                LIMIT %s OFFSET %s
            """

            with connection.cursor() as cursor:
                cursor.execute(query, [workflow_id, start, end, limit, offset])
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

    def fetch_rule_groups_paginated(
        self,
        target: Workflow,
        start: datetime,
        end: datetime,
        cursor: Cursor | None = None,
        per_page: int = 25,
        project_id: int | None = None,
    ) -> CursorResult[RuleGroupHistory]:
        return self._fetch_workflow_fire_history(target.id, start, end, per_page, cursor)

    def _fetch_workflow_hourly_stats(
        self, workflow_id: int | None, start: datetime, end: datetime
    ) -> dict[datetime, TimeSeriesValue]:
        with connection.cursor() as db_cursor:
            db_cursor.execute(
                """
                SELECT
                    DATE_TRUNC('hour', date_added) as bucket,
                    COUNT(*) as count
                FROM workflow_engine_workflowfirehistory
                WHERE workflow_id = %s
                    AND date_added >= %s
                    AND date_added < %s
                GROUP BY DATE_TRUNC('hour', date_added)
                ORDER BY bucket
                """,
                [workflow_id, start, end],
            )

            results = db_cursor.fetchall()

        return {row[0]: TimeSeriesValue(row[0], row[1]) for row in results}

    def fetch_rule_hourly_stats(
        self,
        target: Rule | Workflow,
        start: datetime,
        end: datetime,
        project_id: int | None = None,
    ) -> Sequence[TimeSeriesValue]:
        start = start.replace(tzinfo=timezone.utc)
        end = end.replace(tzinfo=timezone.utc)
        existing_data: dict[datetime, TimeSeriesValue] = {}

        existing_data = self._fetch_workflow_hourly_stats(target.id, start, end)
        return convert_hourly_stats(existing_data, start, end)
