from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.snuba.models import QuerySubscription
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.workflow_engine.models import DataSource
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class DeleteDataSourceTest(BaseWorkflowTest, HybridCloudTestMixin):
    def setUp(self):
        self.alert_rule = self.create_alert_rule()
        self.snuba_query = self.alert_rule.snuba_query
        self.subscription = QuerySubscription.objects.get(snuba_query_id=self.snuba_query.id)
        self.data_source = self.create_data_source(
            organization=self.organization, source_id=self.subscription.id
        )

    def test_simple(self):
        self.ScheduledDeletion.schedule(instance=self.data_source, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not DataSource.objects.filter(id=self.data_source.id).exists()
        assert not QuerySubscription.objects.filter(id=self.subscription.id).exists()
