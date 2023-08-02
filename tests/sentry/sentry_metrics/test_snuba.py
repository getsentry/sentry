from datetime import datetime, timedelta

import pytest

from sentry.search.events.builder.metrics import MetricsQueryBuilder
from sentry.sentry_metrics.client import generic_metrics_backend
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import BaseMetricsLayerTestCase, TestCase
from sentry.testutils.metrics_backend import GenericMetricsTestMixIn

pytestmark = pytest.mark.sentry_metrics


class MetricsInterfaceTestCase(BaseMetricsLayerTestCase, TestCase, GenericMetricsTestMixIn):
    def setUp(self):
        super().setUp()
        self.projects = [self.project.id]
        self.params = {
            "organization_id": self.organization.id,
            "project_id": self.projects,
            "start": datetime.utcnow() - timedelta(days=1),
            "end": datetime.utcnow() + timedelta(days=1),
        }


class SnubaMetricsInterfaceTest(MetricsInterfaceTestCase):
    def test_produce_metrics(self):
        generic_metrics_backend.set(
            self.use_case_id,
            self.organization.id,
            self.project.id,
            self.metric_name,
            self.set_values,
            self.tags,
            self.unit,
        )

        query = MetricsQueryBuilder(
            self.params,
            query=f"project:{self.project.slug}",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "count_unique(user)",
            ],
        )

        result = query.run_query("test_query")
        assert len(result["data"]) == 1
