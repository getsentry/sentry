from datetime import datetime, timedelta

import pytest

from sentry.search.events.builder.metrics import MetricsQueryBuilder
from sentry.sentry_metrics.client import generic_metrics_backend
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import BaseMetricsLayerTestCase, TestCase

use_case_id = UseCaseID.TRANSACTIONS
metric_name = "user"
values = [2, 3]
tags = {"a": "b"}

pytestmark = pytest.mark.sentry_metrics


class MetricsInterfaceTestCase(BaseMetricsLayerTestCase, TestCase):
    def setUp(self):
        super().setUp()
        self.projects = [self.project.id]
        self.params = {
            "organization_id": self.organization.id,
            "project_id": self.projects,
            "start": datetime.utcnow() - timedelta(days=1),
            "end": datetime.utcnow() + timedelta(days=1),
        }


class MetricsInterfaceTest(MetricsInterfaceTestCase):
    def test(self):
        generic_metrics_backend.set(
            use_case_id,
            self.organization.id,
            self.project.id,
            metric_name,
            values,
            tags,
            unit=None,
        )

        query = MetricsQueryBuilder(
            self.params,
            query="",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "count_unique(user)",
            ],
        )

        result = query.run_query("test_query")
        assert len(result["data"]) == 1
