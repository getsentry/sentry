import pytest
from snuba_sdk import Limit, Offset

from sentry.sentry_metrics.client import generic_metrics_backend
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.datasource import get_series
from sentry.snuba.metrics.query import MetricField
from sentry.testutils.cases import BaseMetricsLayerTestCase, TestCase
from sentry.testutils.metrics_backend import GenericMetricsTestMixIn

pytestmark = pytest.mark.sentry_metrics


class MetricsInterfaceTestCase(BaseMetricsLayerTestCase, TestCase, GenericMetricsTestMixIn):
    def setUp(self):
        super().setUp()


class SnubaMetricsInterfaceTest(MetricsInterfaceTestCase):
    @property
    def now(self):
        return BaseMetricsLayerTestCase.MOCK_DATETIME

    def test_simple(self):

        test_project = self.create_project()

        generic_metrics_backend.distribution(
            self.use_case_id,
            self.organization.id,
            test_project.id,
            self.metric_name,
            [100, 200, 300],
            {},
            self.unit,
        )

        metrics_query = self.build_metrics_query(
            before_now="1h",
            granularity="1h",
            select=[
                MetricField(
                    op="count",
                    metric_mri=self.get_mri(self.metric_name, "d", self.use_case_id, self.unit),
                ),
            ],
            project_ids=[test_project.id],
            groupby=[],
            orderby=[],
            limit=Limit(limit=1),
            offset=Offset(offset=0),
            include_series=False,
        )

        data = get_series(
            [test_project],
            metrics_query=metrics_query,
            include_meta=True,
            use_case_id=UseCaseID.TRANSACTIONS,
        )
        groups = data["groups"]
        assert len(groups) == 1

        expected_count = 3
        expected_alias = "count(measurements.speed)"
        assert groups[0]["totals"] == {
            expected_alias: expected_count,
        }
        assert data["meta"] == sorted(
            [
                {"name": expected_alias, "type": "UInt64"},
            ],
            key=lambda elem: elem["name"],
        )
