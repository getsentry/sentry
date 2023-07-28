from datetime import datetime, timedelta, timezone

from sentry.sentry_metrics.query_experimental import get_series
from sentry.sentry_metrics.query_experimental.types import (
    FILTER,
    AggregationFn,
    ArithmeticFn,
    Column,
    Condition,
    Function,
    MetricQueryScope,
    Op,
    SeriesQuery,
)
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.testutils import BaseMetricsLayerTestCase, TestCase


def __example_to_remove():
    """
    sum(transactions{status="error"}) / sum(transactions)
    """

    expr = Function(
        ArithmeticFn.DIVIDE.value,
        [
            Function(
                AggregationFn.SUM.value,
                [
                    Function(
                        FILTER,
                        [
                            Column("transactions"),
                            Condition(
                                lhs=Column("status"),
                                op=Op.EQ,
                                rhs="error",
                            ),
                        ],
                    )
                ],
            ),
            Function(AggregationFn.SUM.value, [Column("transactions")]),
        ],
    )

    query = SeriesQuery(
        scope=MetricQueryScope(org_id=1, project_ids=[1]),
        expressions=[expr],
        filters=[],
        groups=[],
        start=datetime(2023, 1, 1),
        end=datetime(2023, 1, 2),
        interval=3600,
    )

    result = get_series(query)
    assert result


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
            (self.now + timedelta(hours=0), 100),
            (self.now + timedelta(hours=1), 120),
            (self.now + timedelta(hours=2), 80),
            (self.now + timedelta(hours=3), 100),
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
            expressions=[Function(AggregationFn.AVG.value, [Column(MRI)])],
            filters=[],
            groups=[],
            start=self.now,
            end=self.now + timedelta(hours=4),
            interval=3600,
        )

        result = get_series(query)
        assert list(result.iter_groups()) == [{}]
        assert list(result.iter_series()) == VALUES

    def test_groupby(self):
        MRI = "d:transactions/duration@millisecond"
        VALUES = [
            (self.now + timedelta(hours=0), 100, "a"),
            (self.now + timedelta(hours=1), 120, "a"),
            (self.now + timedelta(hours=2), 80, "a"),
            (self.now + timedelta(hours=3), 100, "b"),
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
            expressions=[Function(AggregationFn.AVG.value, [Column(MRI)])],
            filters=[],
            groups=[Column("transaction")],
            start=self.now,
            end=self.now + timedelta(hours=4),
            interval=3600,
        )

        result = get_series(query)
        assert list(result.iter_groups()) == [{"transaction": "a"}, {"transaction": "b"}]
        assert list(result.iter_series(tags={"transaction": "b"})) == [
            (self.now + timedelta(hours=0), None),
            (self.now + timedelta(hours=1), None),
            (self.now + timedelta(hours=2), None),
            (self.now + timedelta(hours=3), 100),
        ]


# TODO: grouping
# TODO: filter
# TODO: arithmetic
# TODO: Test missing tag
