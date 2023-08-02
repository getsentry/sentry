from datetime import datetime, timedelta, timezone
from unittest import mock

import pytest

from sentry.sentry_metrics.query_experimental import get_series
from sentry.sentry_metrics.query_experimental.expansion import ExpressionRegistry
from sentry.sentry_metrics.query_experimental.naming import NameRegistry
from sentry.sentry_metrics.query_experimental.types import (
    Filter,
    Function,
    MetricName,
    MetricQueryScope,
    MetricRange,
    SeriesQuery,
    Tag,
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
            expressions=[Function("avg", [MetricName(MRI)])],
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
            expressions=[Function("avg", [MetricName(MRI)])],
            groups=[Tag("transaction")],
        )

        result = get_series(query)
        groups = sorted(result.iter_groups(), key=lambda g: g["transaction"])
        assert groups == [{"transaction": "a"}, {"transaction": "b"}]
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
            expressions=[Function("avg", [MetricName(MRI)])],
            filters=[Function("equals", [Tag("transaction"), "b"])],
        )

        result = get_series(query)
        assert list(result.iter_series()) == [
            (self.now + timedelta(hours=0), None),
            (self.now + timedelta(hours=1), None),
            (self.now + timedelta(hours=2), None),
            (self.now + timedelta(hours=3), 100.0),
        ]

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
            "avg", [Filter([MetricName(MRI), Function("equals", [Tag("transaction"), "b"])])]
        )

        query = SeriesQuery(
            scope=MetricQueryScope(org_id=1, project_ids=[1]),
            range=MetricRange.start_at(self.now, hours=4, interval=3600),
            expressions=[expr],
        )

        result = get_series(query)
        assert list(result.iter_series()) == [
            (self.now + timedelta(hours=0), None),
            (self.now + timedelta(hours=1), None),
            (self.now + timedelta(hours=2), None),
            (self.now + timedelta(hours=3), 100.0),
        ]

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

        expr = Filter(
            [
                Function("avg", [MetricName(MRI)]),
                Function("equals", [Tag("transaction"), "b"]),
            ]
        )

        query = SeriesQuery(
            scope=MetricQueryScope(org_id=1, project_ids=[1]),
            range=MetricRange.start_at(self.now, hours=4, interval=3600),
            expressions=[expr],
        )

        result = get_series(query)
        assert list(result.iter_series()) == [
            (self.now + timedelta(hours=0), None),
            (self.now + timedelta(hours=1), None),
            (self.now + timedelta(hours=2), None),
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

        query = SeriesQuery(
            scope=MetricQueryScope(org_id=1, project_ids=[1]),
            range=MetricRange.start_at(self.now, hours=4, interval=3600),
            expressions=[Function("multiply", [Function("avg", [MetricName(MRI)]), 2])],
        )

        result = get_series(query)
        assert list(result.iter_series()) == [
            (self.now + timedelta(hours=0), 2 * 100.0),
            (self.now + timedelta(hours=1), 2 * 120.0),
            (self.now + timedelta(hours=2), 2 * 80.0),
            (self.now + timedelta(hours=3), 2 * 100.0),
        ]

    @mock.patch(
        "sentry.sentry_metrics.query_experimental.expansion._REGISTRY",
        new_callable=ExpressionRegistry,
    )
    def test_expansion(self, registry: ExpressionRegistry):
        MRI_DURATION = "d:transactions/duration@millisecond"
        MRI_FAILURE_RATE = "e:transactions/failure_rate@none"
        OK_STATUSES = ("ok", "cancelled", "unknown")
        VALUES = [
            (self.now, 100.0, "ok"),
            (self.now, 100.0, "ok"),
            (self.now, 100.0, "failed"),
            (self.now, 100.0, "ok"),
        ]

        for ts, value, tx in VALUES:
            self.store_metric(
                org_id=1,
                project_id=1,
                type="distribution",
                name=MRI_DURATION,
                tags={"transaction.status": tx},
                timestamp=int(ts.timestamp()),
                value=value,
                use_case_id=UseCaseID.TRANSACTIONS,
            )

        registry.register(
            MRI_FAILURE_RATE,
            Function(
                "divide",
                [
                    Filter(
                        [
                            Function("count", [MetricName(MRI_DURATION)]),
                            Function("notIn", [Tag("transaction.status"), OK_STATUSES]),
                        ]
                    ),
                    Function("count", [MetricName(MRI_DURATION)]),
                ],
            ),
        )

        query = SeriesQuery(
            scope=MetricQueryScope(org_id=1, project_ids=[1]),
            range=MetricRange.start_at(self.now, hours=1, interval=3600),
            expressions=[MetricName(MRI_FAILURE_RATE)],
        )

        result = get_series(query)
        assert list(result.iter_series()) == [
            (self.now, 0.25),
        ]

    @mock.patch(
        "sentry.sentry_metrics.query_experimental.naming._REGISTRY",
        new_callable=NameRegistry,
    )
    def test_public_names(self, registry: NameRegistry):
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
                tags={"transaction.status": tx},  # NB: internal name with prefix
                timestamp=int(ts.timestamp()),
                value=value,
                use_case_id=UseCaseID.TRANSACTIONS,
            )

        registry.register(MRI, "transaction.duration")
        registry.register("transaction.status", "status")

        query = SeriesQuery(
            scope=MetricQueryScope(org_id=1, project_ids=[1]),
            range=MetricRange.start_at(self.now, hours=4, interval=3600),
            expressions=[Function("avg", [MetricName("transaction.duration")])],
            groups=[Tag("status")],
        )

        result = get_series(query, public=True)
        groups = sorted(result.iter_groups(), key=lambda g: g["status"])
        assert groups == [{"status": "a"}, {"status": "b"}]
        assert list(result.iter_series(tags={"status": "b"})) == [
            (self.now + timedelta(hours=0), None),
            (self.now + timedelta(hours=1), None),
            (self.now + timedelta(hours=2), None),
            (self.now + timedelta(hours=3), 100.0),
        ]


# TODO: Test missing tag
# TODO: Test missing tag value
# TODO: Test reverse tag mapping on sessions
# TODO: Test measurement lookup
# TODO: Test with indexing values
# TODO: Test cycles in MRIs
