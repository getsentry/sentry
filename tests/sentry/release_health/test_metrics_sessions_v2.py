from datetime import datetime
from typing import get_args
from unittest.mock import patch

from sentry.release_health.metrics_sessions_v2 import _SessionStatus, run_sessions_query


class QueryDefinitionMock:
    def __init__(self, query, start, end, raw_fields, fields, rollup) -> None:
        self.query = query
        self.start = start
        self.end = end
        self.raw_fields = raw_fields
        self.fields = fields
        self.rollup = rollup


@patch(
    "sentry.release_health.metrics_sessions_v2._fetch_data",
    lambda *args: ({}, {}),
)
@patch(
    "sentry.release_health.metrics_sessions_v2._flatten_data",
    lambda *args: {},
)
def test_ensure_nonempty_groups_when_no_metrics_data():
    """tests the groups, not the res"""

    query_fields = ["count_unique(user)", "sum(session)", "p50(session.duration)"]
    query = QueryDefinitionMock(
        "",
        start=datetime(2022, 1, 1, 0, 0),
        end=datetime(2022, 1, 1, 1, 30),
        raw_fields=query_fields,
        fields=query_fields,
        rollup=3600,
    )
    # with these start and end times and rollup value, there should
    # be two intervals - 00:00, 01:00
    num_intervals = 2

    result = run_sessions_query("1", query, "pageload")

    groups = result["groups"]
    unseen_statuses = set(get_args(_SessionStatus))
    assert len(groups) == len(unseen_statuses)

    for group in groups:
        by = group["by"]
        assert len(by) == 1
        assert by["session.status"] in unseen_statuses
        unseen_statuses.remove(by["session.status"])

        totals = group["totals"]
        assert len(totals) == len(query_fields)
        for field in query_fields:
            assert totals[field] == status_default_value(field)

        series = group["series"]
        assert len(series) == len(query_fields)
        for field in query_fields:
            field_value = status_default_value(field)
            assert series[field] == [field_value for _ in range(num_intervals)]

    assert len(unseen_statuses) == 0


def status_default_value(field: str):
    return 0 if field in ("sum(session)", "count_unique(user)") else None
