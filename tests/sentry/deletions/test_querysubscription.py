from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class DeleteQuerySubscriptionTest(BaseWorkflowTest, HybridCloudTestMixin):
    def test_alert_rule(self):
        """
        Test that we do not delete a SnubaQuery if it's still attached to an AlertRule
        """
        alert_rule = self.create_alert_rule()
        snuba_query = alert_rule.snuba_query
        subscription = QuerySubscription.objects.get(snuba_query_id=snuba_query.id)
        incident = self.create_incident(
            projects=[self.project], status=20, alert_rule=alert_rule, subscription=subscription
        )

        self.ScheduledDeletion.schedule(instance=subscription, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert SnubaQuery.objects.filter(id=snuba_query.id).exists()
        incident.refresh_from_db()
        assert incident.subscription_id is None
        assert not QuerySubscription.objects.filter(id=subscription.id).exists()

    def test_data_source(self):
        """
        Test that we delete the related SnubaQuery when the QuerySubscription was linked from a DataSource
        """
        snuba_query = self.create_snuba_query()
        subscription = QuerySubscription.objects.create(
            project=self.project,
            status=QuerySubscription.Status.ACTIVE.value,
            subscription_id="123",
            snuba_query=snuba_query,
        )
        self.create_data_source(organization=self.organization, source_id=subscription.id)

        self.ScheduledDeletion.schedule(instance=subscription, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not QuerySubscription.objects.filter(id=subscription.id).exists()
        assert not SnubaQuery.objects.filter(id=snuba_query.id).exists()
