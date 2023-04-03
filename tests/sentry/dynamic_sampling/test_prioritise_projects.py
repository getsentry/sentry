from datetime import timedelta

import pytest
from django.utils import timezone
from freezegun import freeze_time

from sentry.dynamic_sampling.prioritise_projects import fetch_projects_with_total_volumes
from sentry.dynamic_sampling.rules.helpers.prioritise_project import apply_actual_sample_rate
from sentry.snuba.metrics import TransactionMRI
from sentry.testutils import BaseMetricsLayerTestCase, SnubaTestCase, TestCase

MOCK_DATETIME = (timezone.now() - timedelta(days=1)).replace(
    hour=0, minute=0, second=0, microsecond=0
)


@freeze_time(MOCK_DATETIME)
class PrioritiseProjectsSnubaQueryTest(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    @property
    def now(self):
        return MOCK_DATETIME

    def test_simple_one_org_one_project(self):
        org1 = self.create_organization("test-org")
        p1 = self.create_project(organization=org1)

        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction"},
            minutes_before_now=30,
            value=1,
            project_id=p1.id,
            org_id=org1.id,
        )
        with self.options({"dynamic-sampling.prioritise_projects.sample_rate": 1.0}):
            results = fetch_projects_with_total_volumes(org_ids=[org1.id])
        assert results[org1.id] == [(p1.id, 1.0, 0, 0)]

    def test_simple_one_org_one_project_sample_rate_zero(self):
        org1 = self.create_organization("test-org")
        p1 = self.create_project(organization=org1)

        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction"},
            minutes_before_now=30,
            value=1,
            project_id=p1.id,
            org_id=org1.id,
        )
        with self.options({"dynamic-sampling.prioritise_projects.sample_rate": 0.0}):
            results = fetch_projects_with_total_volumes(org_ids=[org1.id])
        # No results
        assert results == {}

    def test_simple_one_org_one_project_but_filtered_by_option(self):
        org1 = self.create_organization("test-org2")
        p1 = self.create_project(organization=org1)

        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction2"},
            minutes_before_now=30,
            value=1,
            project_id=p1.id,
            org_id=org1.id,
        )
        with self.options({"dynamic-sampling.prioritise_projects.sample_rate": 0}):
            results = fetch_projects_with_total_volumes(org_ids=[org1.id])
            # No data because rate is too small
            assert results[org1.id] == []


@pytest.mark.parametrize(
    "blended_sample_rate,adjusted_sample_rate,actual_sample_rate,new_adjusted_sample_rate",
    [
        (0.25, None, None, None),
        (0.25, None, 0.1, None),
        (0.25, 0.1, None, None),
        (0.1, 0.075, 0.2, 0.0675),  # actual_sample_rate > blended_sample_rate - over sampling
        (
            0.2,
            0.075,
            0.1,
            0.08249999999999999,
        ),  # actual_sample_rate < blended_sample_rate - under sampling
        (0.1, 0.1, 0.1, 0.1),  # actual_sample_rate == blended_sample_rate - we are good
        (0.1, 0.08, 0.1, 0.08),  # actual_sample_rate == blended_sample_rate - we are good
    ],
)
def test_apply_actual_sample_rate(
    blended_sample_rate, adjusted_sample_rate, actual_sample_rate, new_adjusted_sample_rate
):
    assert (
        apply_actual_sample_rate(blended_sample_rate, adjusted_sample_rate, actual_sample_rate)
        == new_adjusted_sample_rate
    )
