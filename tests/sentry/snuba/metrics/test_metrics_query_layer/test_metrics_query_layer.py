"""
Metrics Service Layer Tests for Performance
"""

import pytest
from freezegun import freeze_time
from snuba_sdk.metrics_query import MetricScope, MetricsQuery
from snuba_sdk.timeseries import Metric, Timeseries

from sentry.snuba.metrics.naming_layer import TransactionMRI
from sentry.snuba.metrics_layer.query import resolve_metrics_query
from sentry.testutils.cases import BaseMetricsLayerTestCase, TestCase

pytestmark = pytest.mark.sentry_metrics


@freeze_time(BaseMetricsLayerTestCase.MOCK_DATETIME)
class MetricsQueryLayerTest(BaseMetricsLayerTestCase, TestCase):
    @property
    def now(self):
        return BaseMetricsLayerTestCase.MOCK_DATETIME

    def test_resolve_metrics_query(self):
        project_2 = self.create_project()
        project_3 = self.create_project()

        for project_id, value in (
            (self.project.id, 0),
            (self.project.id, 1),
            (project_2.id, 2),
            (project_3.id, 3),
        ):
            self.store_performance_metric(
                name=TransactionMRI.DURATION.value,
                project_id=project_id,
                tags={},
                value=value,
            )

        # metrics_query = self.build_metrics_query(
        #     before_now="1h",
        #     granularity="1h",
        #     select=[
        #         MetricField(
        #             op="count",
        #             metric_mri=TransactionMRI.DURATION.value,
        #         ),
        #     ],
        #     project_ids=[project_2.id, project_3.id],
        #     groupby=[MetricGroupByField(field="project_id")],
        #     orderby=[
        #         MetricOrderByField(
        #             MetricField(
        #                 op="count",
        #                 metric_mri=TransactionMRI.DURATION.value,
        #             ),
        #             direction=Direction.DESC,
        #         ),
        #         MetricOrderByField(
        #             field="project_id",
        #             direction=Direction.DESC,
        #         ),
        #     ],
        #     limit=Limit(limit=3),
        #     offset=Offset(offset=0),
        #     include_series=False,
        # )
        metrics_query = MetricsQuery(
            query=Timeseries(Metric(mri=TransactionMRI.DURATION.value), aggregate="count"),
            scope=MetricScope(
                org_ids=[1], project_ids=[self.project.id, project_2.id, project_3.id]
            ),
        )

        resolved_metrics_query = resolve_metrics_query(metrics_query)
        resolved_metrics_query
