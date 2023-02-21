from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone
from freezegun import freeze_time

from sentry.dynamic_sampling import generate_rules
from sentry.dynamic_sampling.tasks import prioritise_projects
from sentry.snuba.metrics import TransactionMRI
from sentry.testutils import BaseMetricsLayerTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers import Feature

MOCK_DATETIME = (timezone.now() - timedelta(days=1)).replace(
    hour=0, minute=0, second=0, microsecond=0
)


@freeze_time(MOCK_DATETIME)
class TestPrioritiseProjectsTask(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    @property
    def now(self):
        return MOCK_DATETIME

    def create_project_and_add_metrics(self, name, count, org):
        # Create 4 projects
        proj = self.create_project(name=name, organization=org)

        # disable all biases
        proj.update_option(
            "sentry:dynamic_sampling_biases",
            [
                {"id": "boostEnvironments", "active": False},
                {"id": "ignoreHealthChecks", "active": False},
                {"id": "boostLatestRelease", "active": False},
                {"id": "boostKeyTransactions", "active": False},
            ],
        )
        # Store performance metrics for proj A
        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction"},
            hours_before_now=1,
            value=count,
            project_id=proj.id,
            org_id=org.id,
        )
        return proj

    @patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
    def test_prioritise_projects_simple(self, get_blended_sample_rate):
        get_blended_sample_rate.return_value = 0.25
        # Create a org
        test_org = self.create_organization(name="sample-org")

        # Create 4 projects
        proj_a = self.create_project_and_add_metrics("a", 9, test_org)
        proj_b = self.create_project_and_add_metrics("b", 7, test_org)
        proj_c = self.create_project_and_add_metrics("c", 3, test_org)
        proj_d = self.create_project_and_add_metrics("d", 1, test_org)

        with Feature({"organizations:ds-prioritise-by-project-bias": True}):
            prioritise_projects()

        # we expect only uniform rule
        assert generate_rules(proj_a)[0]["samplingValue"] == {
            "type": "sampleRate",
            "value": pytest.approx(0.16666666666666666),
        }
        assert generate_rules(proj_b)[0]["samplingValue"] == {
            "type": "sampleRate",
            "value": pytest.approx(0.19642857142857142),
        }
        assert generate_rules(proj_c)[0]["samplingValue"] == {"type": "sampleRate", "value": 0.375}
        assert generate_rules(proj_d)[0]["samplingValue"] == {"type": "sampleRate", "value": 1.0}
