from datetime import datetime, timedelta, timezone

import pytest

from sentry.sentry_metrics.query_experimental import get_series
from sentry.sentry_metrics.query_experimental.types import (
    FILTER,
    AggregationFn,
    ArithmeticFn,
    Column,
    Condition,
    Function,
    MetricQueryScope,
    MetricRange,
    Op,
    SeriesQuery,
)
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.testutils import BaseMetricsLayerTestCase, TestCase

pytestmark = pytest.mark.sentry_metrics


# Set yesterday at noon as the current time. This is within the allowed
# timeframe for backdating metrics, which is required to store metrics.
MOCK_DATETIME = (datetime.now() - timedelta(days=1)).replace(
    hour=12, minute=0, second=0, microsecond=0, tzinfo=timezone.utc
)


class MetricsQueryTest(BaseMetricsLayerTestCase, TestCase):
    @property
    def now(self):
        return MOCK_DATETIME

    def test_basic(self):
        MRI = "d:transactions/duration@millisecond"
        VALUES = [
            (self.now + timedelta(hours=0), 100.0),
            (self.now + timedelta(hours=1), 120.0),
            (self.now + timedelta(hours=2), 80.0),
            (self.now + timedelta(hours=3), 100.0),
        ]

        for ts, value in VALUES:
            self.store_metric(
                org_id=1,
                project_id=1,
                type="distribution",
                name=MRI,
                tags={},
                timestamp=int(ts.timestamp()),
                value=value,
                use_case_id=UseCaseID.TRANSACTIONS,
            )

        query = SeriesQuery(
            scope=MetricQueryScope(org_id=1, project_ids=[1]),
            range=MetricRange.start_at(self.now, hours=4, interval=3600),
            expressions=[Function(AggregationFn.AVG.value, [Column(MRI)])],
        )

        result = get_series(query)
        assert list(result.iter_groups()) == [{}]
        assert list(result.iter_series()) == VALUES

    def test_groupby(self):
        MRI = "d:transactions/duration@millisecond"
        VALUES = [
            (self.now + timedelta(hours=0), 100.0, "a"),
            (self.now + timedelta(hours=1), 120.0, "a"),
            (self.now + timedelta(hours=2), 80.0, "a"),
            (self.now + timedelta(hours=3), 100.0, "b"),
        ]

        for ts, value, tx in VALUES:
            self.store_metric(
                org_id=1,
                project_id=1,
                type="distribution",
                name=MRI,
                tags={"transaction": tx},
                timestamp=int(ts.timestamp()),
                value=value,
                use_case_id=UseCaseID.TRANSACTIONS,
            )

        query = SeriesQuery(
            scope=MetricQueryScope(org_id=1, project_ids=[1]),
            range=MetricRange.start_at(self.now, hours=4, interval=3600),
            expressions=[Function(AggregationFn.AVG.value, [Column(MRI)])],
            groups=[Column("transaction")],
        )

        result = get_series(query)
        assert list(result.iter_groups()) == [{"transaction": "a"}, {"transaction": "b"}]
        assert list(result.iter_series(tags={"transaction": "b"})) == [
            (self.now + timedelta(hours=0), None),
            (self.now + timedelta(hours=1), None),
            (self.now + timedelta(hours=2), None),
            (self.now + timedelta(hours=3), 100.0),
        ]

    def test_filter(self):
        MRI = "d:transactions/duration@millisecond"
        VALUES = [
            (self.now + timedelta(hours=0), 100.0, "a"),
            (self.now + timedelta(hours=1), 120.0, "a"),
            (self.now + timedelta(hours=2), 80.0, "a"),
            (self.now + timedelta(hours=3), 100.0, "b"),
        ]

        for ts, value, tx in VALUES:
            self.store_metric(
                org_id=1,
                project_id=1,
                type="distribution",
                name=MRI,
                tags={"transaction": tx},
                timestamp=int(ts.timestamp()),
                value=value,
                use_case_id=UseCaseID.TRANSACTIONS,
            )

        query = SeriesQuery(
            scope=MetricQueryScope(org_id=1, project_ids=[1]),
            range=MetricRange.start_at(self.now, hours=4, interval=3600),
            expressions=[Function(AggregationFn.AVG.value, [Column(MRI)])],
            filters=[Condition(Column("transaction"), Op.EQ, "b")],
        )

        result = get_series(query)
        assert list(result.iter_series()) == [
            # TODO: Include all intervals in series
            # (self.now + timedelta(hours=0), None),
            # (self.now + timedelta(hours=1), None),
            # (self.now + timedelta(hours=2), None),
            (self.now + timedelta(hours=3), 100.0),
        ]

    @pytest.mark.skip(reason="TODO: refactor filter, conditions not allowed")
    def test_filter_expression(self):
        MRI = "d:transactions/duration@millisecond"
        VALUES = [
            (self.now + timedelta(hours=0), 100.0, "a"),
            (self.now + timedelta(hours=1), 120.0, "a"),
            (self.now + timedelta(hours=2), 80.0, "a"),
            (self.now + timedelta(hours=3), 100.0, "b"),
        ]

        for ts, value, tx in VALUES:
            self.store_metric(
                org_id=1,
                project_id=1,
                type="distribution",
                name=MRI,
                tags={"transaction": tx},
                timestamp=int(ts.timestamp()),
                value=value,
                use_case_id=UseCaseID.TRANSACTIONS,
            )

        expr = Function(
            AggregationFn.AVG.value,
            [Function(FILTER, [Column(MRI), Condition(Column("transaction"), Op.EQ, "b")])],
        )

        query = SeriesQuery(
            scope=MetricQueryScope(org_id=1, project_ids=[1]),
            range=MetricRange.start_at(self.now, hours=4, interval=3600),
            expressions=[expr],
        )

        result = get_series(query)
        assert list(result.iter_series()) == [
            # TODO: Include all intervals in series
            # (self.now + timedelta(hours=0), None),
            # (self.now + timedelta(hours=1), None),
            # (self.now + timedelta(hours=2), None),
            (self.now + timedelta(hours=3), 100.0),
        ]

    @pytest.mark.skip(reason="TODO: normalization not implemented")
    def test_filter_expression_outside(self):
        MRI = "d:transactions/duration@millisecond"
        VALUES = [
            (self.now + timedelta(hours=0), 100.0, "a"),
            (self.now + timedelta(hours=1), 120.0, "a"),
            (self.now + timedelta(hours=2), 80.0, "a"),
            (self.now + timedelta(hours=3), 100.0, "b"),
        ]

        for ts, value, tx in VALUES:
            self.store_metric(
                org_id=1,
                project_id=1,
                type="distribution",
                name=MRI,
                tags={"transaction": tx},
                timestamp=int(ts.timestamp()),
                value=value,
                use_case_id=UseCaseID.TRANSACTIONS,
            )

        expr = Function(
            FILTER,
            [
                Function(AggregationFn.AVG.value, [Column(MRI)]),
                Condition(Column("transaction"), Op.EQ, "b"),
            ],
        )

        query = SeriesQuery(
            scope=MetricQueryScope(org_id=1, project_ids=[1]),
            range=MetricRange.start_at(self.now, hours=4, interval=3600),
            expressions=[expr],
        )

        result = get_series(query)
        assert list(result.iter_series()) == [
            # TODO: Include all intervals in series
            # (self.now + timedelta(hours=0), None),
            # (self.now + timedelta(hours=1), None),
            # (self.now + timedelta(hours=2), None),
            (self.now + timedelta(hours=3), 100.0),
        ]

    def test_arithmetic(self):
        MRI = "d:transactions/duration@millisecond"
        VALUES = [
            (self.now + timedelta(hours=0), 100.0),
            (self.now + timedelta(hours=1), 120.0),
            (self.now + timedelta(hours=2), 80.0),
            (self.now + timedelta(hours=3), 100.0),
        ]

        for ts, value in VALUES:
            self.store_metric(
                org_id=1,
                project_id=1,
                type="distribution",
                name=MRI,
                tags={},
                timestamp=int(ts.timestamp()),
                value=value,
                use_case_id=UseCaseID.TRANSACTIONS,
            )

        expr = Function(
            ArithmeticFn.MULTIPLY.value, [Function(AggregationFn.AVG.value, [Column(MRI)]), 2]
        )

        query = SeriesQuery(
            scope=MetricQueryScope(org_id=1, project_ids=[1]),
            range=MetricRange.start_at(self.now, hours=4, interval=3600),
            expressions=[expr],
        )

        result = get_series(query)
        assert list(result.iter_series()) == [
            (self.now + timedelta(hours=0), 2 * 100.0),
            (self.now + timedelta(hours=1), 2 * 120.0),
            (self.now + timedelta(hours=2), 2 * 80.0),
            (self.now + timedelta(hours=3), 2 * 100.0),
        ]


# TODO: Test missing tag
# TODO: Test missing tag value
# TODO: Test reverse tag mapping on sessions
