from datetime import timedelta

from django.utils import timezone
from freezegun import freeze_time

from sentry.dynamic_sampling.sliding_window import fetch_projects_with_total_root_transactions_count
from sentry.snuba.metrics import TransactionMRI
from sentry.testutils import BaseMetricsLayerTestCase, SnubaTestCase, TestCase

MOCK_DATETIME = (timezone.now() - timedelta(days=1)).replace(
    hour=0, minute=0, second=0, microsecond=0
)


@freeze_time(MOCK_DATETIME)
class SlidingWindowRebalancingSnubaQueryTest(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    @property
    def now(self):
        return MOCK_DATETIME

    def test_query_with_one_org_and_multiple_projects(self):
        org_1 = self.create_organization("test-org")
        project_1 = self.create_project(organization=org_1)
        project_2 = self.create_project(organization=org_1)

        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction"},
            minutes_before_now=30,
            value=100,
            project_id=project_1.id,
            org_id=org_1.id,
        )
        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction"},
            minutes_before_now=60,
            value=50,
            project_id=project_1.id,
            org_id=org_1.id,
        )

        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction"},
            minutes_before_now=30,
            value=200,
            project_id=project_2.id,
            org_id=org_1.id,
        )

        results = fetch_projects_with_total_root_transactions_count(org_ids=[org_1.id])
        assert results[org_1.id] == [(project_1.id, 150), (project_2.id, 200)]

    def test_query_with_multiple_orgs_and_multiple_projects(self):
        org_1 = self.create_organization("test-org-1")
        project_1 = self.create_project(organization=org_1)
        project_2 = self.create_project(organization=org_1)

        org_2 = self.create_organization("test-org-2")
        project_3 = self.create_project(organization=org_2)

        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction"},
            minutes_before_now=30,
            value=100,
            project_id=project_1.id,
            org_id=org_1.id,
        )

        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction"},
            minutes_before_now=30,
            value=200,
            project_id=project_2.id,
            org_id=org_1.id,
        )

        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction"},
            minutes_before_now=30,
            value=300,
            project_id=project_3.id,
            org_id=org_2.id,
        )

        results = fetch_projects_with_total_root_transactions_count(org_ids=[org_1.id, org_2.id])
        assert results[org_1.id] == [(project_1.id, 100), (project_2.id, 200)]
        assert results[org_2.id] == [(project_3.id, 300)]
