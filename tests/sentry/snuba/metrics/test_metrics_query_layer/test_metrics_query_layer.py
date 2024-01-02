"""
Metrics Service Layer Tests for Performance
"""

from datetime import datetime, timedelta

import pytest
from snuba_sdk import (
    AliasedExpression,
    ArithmeticOperator,
    Column,
    Condition,
    Formula,
    Metric,
    MetricsQuery,
    MetricsScope,
    Op,
    Or,
    Timeseries,
)

from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.naming_layer import TransactionMRI
from sentry.snuba.metrics_layer.query import _resolve_granularity, _resolve_metrics_query
from sentry.testutils.cases import BaseMetricsLayerTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time

pytestmark = pytest.mark.sentry_metrics


@freeze_time(BaseMetricsLayerTestCase.MOCK_DATETIME)
class MetricsQueryLayerTest(BaseMetricsLayerTestCase, TestCase):
    @property
    def now(self):
        return BaseMetricsLayerTestCase.MOCK_DATETIME

    def test_resolve_metrics_query(self):
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            project_id=self.project.id,
            tags={},
            value=1,
        )
        metrics_query = MetricsQuery(
            query=Timeseries(Metric(mri=TransactionMRI.DURATION.value), aggregate="count"),
            scope=MetricsScope(
                org_ids=[self.project.organization_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.TRANSACTIONS.value,
            ),
        )

        resolved_metrics_query, mappings = _resolve_metrics_query(metrics_query)
        expected_metric_id = indexer.resolve(
            UseCaseID.TRANSACTIONS,
            self.project.organization_id,
            TransactionMRI.DURATION.value,
        )
        assert resolved_metrics_query.query.metric.id == expected_metric_id
        assert mappings[TransactionMRI.DURATION.value] == expected_metric_id

    def test_resolve_formula_metrics_query(self):
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            project_id=self.project.id,
            tags={},
            value=1,
        )
        metrics_query = MetricsQuery(
            query=Formula(
                ArithmeticOperator.PLUS,
                [
                    Timeseries(Metric(mri=TransactionMRI.DURATION.value), aggregate="count"),
                    Timeseries(Metric(mri=TransactionMRI.DURATION.value), aggregate="count"),
                ],
            ),
            scope=MetricsScope(
                org_ids=[self.project.organization_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.TRANSACTIONS.value,
            ),
        )

        resolved_metrics_query, mappings = _resolve_metrics_query(metrics_query)
        expected_metric_id = indexer.resolve(
            UseCaseID.TRANSACTIONS,
            self.project.organization_id,
            TransactionMRI.DURATION.value,
        )
        assert resolved_metrics_query.query.parameters[0].metric.id == expected_metric_id
        assert mappings[TransactionMRI.DURATION.value] == expected_metric_id

    def test_resolve_metrics_query_with_groupby(self):
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            project_id=self.project.id,
            tags={"transaction": "/checkout"},
            value=1,
        )
        metrics_query = MetricsQuery(
            query=Timeseries(
                Metric(public_name="transaction.duration"),
                aggregate="count",
                groupby=[Column("transaction")],
            ),
            scope=MetricsScope(
                org_ids=[self.project.organization_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.TRANSACTIONS.value,
            ),
        )
        expected_metric_id = indexer.resolve(
            UseCaseID.TRANSACTIONS,
            self.project.organization_id,
            TransactionMRI.DURATION.value,
        )
        expected_transaction_id = indexer.resolve(
            UseCaseID.TRANSACTIONS,
            self.project.organization_id,
            "transaction",
        )

        resolved_metrics_query, mappings = _resolve_metrics_query(metrics_query)
        assert resolved_metrics_query.query.metric.public_name == "transaction.duration"
        assert resolved_metrics_query.query.metric.mri == TransactionMRI.DURATION.value
        assert resolved_metrics_query.query.metric.id == expected_metric_id
        assert resolved_metrics_query.query.groupby == [
            AliasedExpression(Column(f"tags_raw[{expected_transaction_id}]"), "transaction")
        ]
        assert mappings[TransactionMRI.DURATION.value] == expected_metric_id
        assert mappings["transaction"] == expected_transaction_id

    def test_resolve_formula_metrics_query_with_groupby(self):
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            project_id=self.project.id,
            tags={"transaction": "/checkout", "status_code": "200"},
            value=1,
        )
        metrics_query = MetricsQuery(
            query=Formula(
                ArithmeticOperator.PLUS,
                [
                    Timeseries(
                        Metric(public_name="transaction.duration"),
                        aggregate="count",
                        groupby=[Column("transaction")],
                    ),
                    Timeseries(
                        Metric(mri=TransactionMRI.DURATION.value),
                        aggregate="count",
                        groupby=[Column("transaction")],
                    ),
                ],
                groupby=[Column("status_code")],
            ),
            scope=MetricsScope(
                org_ids=[self.project.organization_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.TRANSACTIONS.value,
            ),
        )
        expected_metric_id = indexer.resolve(
            UseCaseID.TRANSACTIONS,
            self.project.organization_id,
            TransactionMRI.DURATION.value,
        )
        expected_transaction_id = indexer.resolve(
            UseCaseID.TRANSACTIONS,
            self.project.organization_id,
            "transaction",
        )
        expected_status_code_id = indexer.resolve(
            UseCaseID.TRANSACTIONS,
            self.project.organization_id,
            "status_code",
        )

        resolved_metrics_query, mappings = _resolve_metrics_query(metrics_query)
        assert (
            resolved_metrics_query.query.parameters[0].metric.public_name == "transaction.duration"
        )
        assert (
            resolved_metrics_query.query.parameters[0].metric.mri == TransactionMRI.DURATION.value
        )
        assert resolved_metrics_query.query.parameters[0].metric.id == expected_metric_id
        assert resolved_metrics_query.query.parameters[0].groupby == [
            AliasedExpression(Column(f"tags_raw[{expected_transaction_id}]"), "transaction")
        ]
        assert resolved_metrics_query.query.parameters[1].groupby == [
            AliasedExpression(Column(f"tags_raw[{expected_transaction_id}]"), "transaction")
        ]
        assert resolved_metrics_query.query.groupby == [
            AliasedExpression(Column(f"tags_raw[{expected_status_code_id}]"), "status_code")
        ]
        assert mappings[TransactionMRI.DURATION.value] == expected_metric_id
        assert mappings["transaction"] == expected_transaction_id
        assert mappings["status_code"] == expected_status_code_id

    def test_resolve_metrics_query_with_filters(self):
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            project_id=self.project.id,
            tags={"transaction": "/checkout", "device": "BlackBerry"},
            value=1,
        )
        metrics_query = MetricsQuery(
            query=Timeseries(
                Metric(mri=TransactionMRI.DURATION.value),
                aggregate="count",
                filters=[
                    Condition(Column("transaction"), Op.EQ, "/checkout"),
                    Or(
                        [
                            Condition(Column("device"), Op.EQ, "BlackBerry"),
                            Condition(Column("device"), Op.EQ, "Nokia"),
                        ]
                    ),
                ],
                groupby=[Column("transaction")],
            ),
            scope=MetricsScope(
                org_ids=[self.project.organization_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.TRANSACTIONS.value,
            ),
        )
        expected_metric_id = indexer.resolve(
            UseCaseID.TRANSACTIONS,
            self.project.organization_id,
            TransactionMRI.DURATION.value,
        )
        expected_transaction_id = indexer.resolve(
            UseCaseID.TRANSACTIONS,
            self.project.organization_id,
            "transaction",
        )
        expected_device_id = indexer.resolve(
            UseCaseID.TRANSACTIONS,
            self.project.organization_id,
            "device",
        )

        resolved_metrics_query, mappings = _resolve_metrics_query(metrics_query)
        assert resolved_metrics_query.query.metric.id == expected_metric_id
        assert resolved_metrics_query.query.filters == [
            Condition(Column(f"tags_raw[{expected_transaction_id}]"), Op.EQ, "/checkout"),
            Or(
                [
                    Condition(Column(f"tags_raw[{expected_device_id}]"), Op.EQ, "BlackBerry"),
                    Condition(Column(f"tags_raw[{expected_device_id}]"), Op.EQ, "Nokia"),
                ]
            ),
        ]
        assert mappings[TransactionMRI.DURATION.value] == expected_metric_id
        assert mappings["transaction"] == expected_transaction_id
        assert mappings["device"] == expected_device_id

    def test_resolve_formula_metrics_query_with_filters(self):
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            project_id=self.project.id,
            tags={"transaction": "/checkout", "device": "BlackBerry", "status_code": "200"},
            value=1,
        )
        metrics_query = MetricsQuery(
            query=Formula(
                ArithmeticOperator.PLUS,
                [
                    Timeseries(
                        Metric(mri=TransactionMRI.DURATION.value),
                        aggregate="count",
                        filters=[
                            Condition(Column("transaction"), Op.EQ, "/checkout"),
                            Or(
                                [
                                    Condition(Column("device"), Op.EQ, "BlackBerry"),
                                    Condition(Column("device"), Op.EQ, "Nokia"),
                                ]
                            ),
                        ],
                        groupby=[Column("transaction")],
                    ),
                    Timeseries(
                        Metric(mri=TransactionMRI.DURATION.value),
                        aggregate="count",
                        filters=[
                            Condition(Column("transaction"), Op.EQ, "/cart"),
                            Or(
                                [
                                    Condition(Column("device"), Op.EQ, "Android"),
                                    Condition(Column("device"), Op.EQ, "Palm"),
                                ]
                            ),
                        ],
                        groupby=[Column("transaction")],
                    ),
                ],
                filters=[Condition(Column("status_code"), Op.EQ, "200")],
            ),
            scope=MetricsScope(
                org_ids=[self.project.organization_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.TRANSACTIONS.value,
            ),
        )
        expected_metric_id = indexer.resolve(
            UseCaseID.TRANSACTIONS,
            self.project.organization_id,
            TransactionMRI.DURATION.value,
        )
        expected_transaction_id = indexer.resolve(
            UseCaseID.TRANSACTIONS,
            self.project.organization_id,
            "transaction",
        )
        expected_device_id = indexer.resolve(
            UseCaseID.TRANSACTIONS,
            self.project.organization_id,
            "device",
        )
        expected_status_code_id = indexer.resolve(
            UseCaseID.TRANSACTIONS,
            self.project.organization_id,
            "status_code",
        )

        resolved_metrics_query, mappings = _resolve_metrics_query(metrics_query)
        assert resolved_metrics_query.query.parameters[0].metric.id == expected_metric_id
        assert resolved_metrics_query.query.parameters[0].filters == [
            Condition(Column(f"tags_raw[{expected_transaction_id}]"), Op.EQ, "/checkout"),
            Or(
                [
                    Condition(Column(f"tags_raw[{expected_device_id}]"), Op.EQ, "BlackBerry"),
                    Condition(Column(f"tags_raw[{expected_device_id}]"), Op.EQ, "Nokia"),
                ]
            ),
        ]
        assert resolved_metrics_query.query.parameters[1].filters == [
            Condition(Column(f"tags_raw[{expected_transaction_id}]"), Op.EQ, "/cart"),
            Or(
                [
                    Condition(Column(f"tags_raw[{expected_device_id}]"), Op.EQ, "Android"),
                    Condition(Column(f"tags_raw[{expected_device_id}]"), Op.EQ, "Palm"),
                ]
            ),
        ]
        assert resolved_metrics_query.query.filters == [
            Condition(Column(f"tags_raw[{expected_status_code_id}]"), Op.EQ, "200"),
        ]
        assert mappings[TransactionMRI.DURATION.value] == expected_metric_id
        assert mappings["transaction"] == expected_transaction_id
        assert mappings["device"] == expected_device_id
        assert mappings["status_code"] == expected_status_code_id


@pytest.mark.parametrize(
    "day_range, sec_offset, interval, expected",
    [
        # Interval tests
        (7, 0, timedelta(hours=1).total_seconds(), 3600),
        (7, 0, timedelta(seconds=10).total_seconds(), 10),
        (7, 0, timedelta(seconds=5).total_seconds(), 10),
        (7, 0, timedelta(hours=2).total_seconds(), 3600),
        (7, 0, timedelta(days=2).total_seconds(), 86400),
        # Totals tests
        (7, 0, None, 86400),
        (7, timedelta(hours=1).total_seconds(), None, 3600),
        (7, timedelta(hours=2).total_seconds(), None, 3600),
        (7, timedelta(hours=2, minutes=1).total_seconds(), None, 60),
        (7, timedelta(hours=2, minutes=2).total_seconds(), None, 60),
        (7, timedelta(hours=2, minutes=2, seconds=30).total_seconds(), None, 10),
        (7, timedelta(hours=2, minutes=2, seconds=10).total_seconds(), None, 10),
        (7, timedelta(hours=2, minutes=2, seconds=5).total_seconds(), None, 10),
    ],
)
def test_resolve_granularity(day_range: int, sec_offset: int, interval: int, expected: int) -> None:
    now = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    start = now - timedelta(days=day_range) - timedelta(seconds=sec_offset)
    end = now - timedelta(seconds=sec_offset)
    assert _resolve_granularity(start, end, interval) == expected
