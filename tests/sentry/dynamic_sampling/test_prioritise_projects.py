from datetime import datetime, timezone

from freezegun import freeze_time

from sentry.dynamic_sampling.prioritise_projects import fetch_projects_with_total_volumes
from sentry.snuba.metrics import TransactionMRI
from sentry.testutils import BaseMetricsLayerTestCase, SnubaTestCase, TestCase

MOCK_DATETIME = datetime(2023, 8, 7, 0, 0, 0, tzinfo=timezone.utc)


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
            hours_before_now=1,
            value=1,
            project_id=p1.id,
            org_id=org1.id,
        )

        results = fetch_projects_with_total_volumes()
        assert results[org1.id] == [{p1.id: 1.0}]
