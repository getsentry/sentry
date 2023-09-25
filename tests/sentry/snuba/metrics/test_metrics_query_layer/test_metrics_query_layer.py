"""
Metrics Service Layer Tests for Performance
"""

import pytest
from snuba_sdk.metrics_query import MetricsQuery
from snuba_sdk.timeseries import Metric, MetricsScope, Timeseries

from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.naming_layer import TransactionMRI
from sentry.snuba.metrics_layer.query import resolve_metrics_query
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

        resolved_metrics_query = resolve_metrics_query(metrics_query)
        assert resolved_metrics_query.query.metric.public_name == "transaction.duration"
        assert resolved_metrics_query.query.metric.id == indexer.resolve(
            UseCaseID.TRANSACTIONS,
            self.project.organization_id,
            TransactionMRI.DURATION.value,
        )
