from datetime import timedelta

from django.utils import timezone
from freezegun import freeze_time

from sentry.dynamic_sampling.tasks.boost_low_volume_projects import (
    fetch_projects_with_total_root_transaction_count_and_rates,
)
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
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
        results = fetch_projects_with_total_root_transaction_count_and_rates(org_ids=[org1.id])
        assert results[org1.id] == [(p1.id, 1.0, 0, 0)]
