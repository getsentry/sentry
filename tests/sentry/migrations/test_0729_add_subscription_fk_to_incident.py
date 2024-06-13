from datetime import timedelta

from sentry.incidents.models.alert_rule import AlertRule, AlertRuleThresholdType
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.snuba.subscriptions import create_snuba_query
from sentry.testutils.cases import TestMigrations


class AlertRuleProjectBackfillTest(TestMigrations):
    migrate_from = "0728_incident_subscription_fk"
    migrate_to = "0729_add_subscription_fk_to_incident."

    def setup_before_migration(self, app):
        self.snuba_query = create_snuba_query(
            aggregate="",
            dataset=Dataset.Events,
            environment=None,
            query="",
            query_type=SnubaQuery.Type.ERROR,
            resolution=timedelta(minutes=5),
            time_window=timedelta(minutes=5),
        )
        self.alert_rule = AlertRule.objects.create(
            organization=self.organization,
            snuba_query=self.snuba_query,
            name="foo",
            threshold_type=AlertRuleThresholdType.ABOVE.value,
            threshold_period=1,
            include_all_projects=False,
        )

        # creates a QuerySubscription for the alertrule and project
        self.alert_rule.subscribe_projects(projects=[self.project])
        self.query_subscription = self.snuba_query.subscriptions.get()

        self.incident = self.create_incident(projects=[self.project], alert_rule=self.alert_rule)

        assert self.incident.alert_rule == self.alert_rule
        assert not self.incident.subscription.exists()

        # Incident with a deleted alert rule
        snuba_query_no_alrt = create_snuba_query(
            aggregate="",
            dataset=Dataset.Events,
            environment=None,
            query="",
            query_type=SnubaQuery.Type.ERROR,
            resolution=timedelta(minutes=5),
            time_window=timedelta(minutes=5),
        )
        temp_alert_rule = AlertRule.objects.create(
            organization=self.organization,
            snuba_query=snuba_query_no_alrt,
            name="foo",
            threshold_type=AlertRuleThresholdType.ABOVE.value,
            threshold_period=1,
            include_all_projects=False,
        )

        # creates a QuerySubscription for the alertrule and project
        temp_alert_rule.subscribe_projects(projects=[self.project])
        self.temp_subscription = snuba_query_no_alrt.subscriptions.get()

        self.incident_no_alrt = self.create_incident(
            projects=[self.project], alert_rule=temp_alert_rule
        )
        temp_alert_rule.delete()

        assert not self.incident_no_alrt.alert_rule.exists()
        assert not self.incident_no_alrt.subscription.exists()

        # Incident for alert rule with multiple subscriptions
        snuba_query_mult = create_snuba_query(
            aggregate="",
            dataset=Dataset.Events,
            environment=None,
            query="",
            query_type=SnubaQuery.Type.ERROR,
            resolution=timedelta(minutes=5),
            time_window=timedelta(minutes=5),
        )
        self.alert_rule_mult = AlertRule.objects.create(
            organization=self.organization,
            snuba_query=snuba_query_mult,
            name="foo",
            threshold_type=AlertRuleThresholdType.ABOVE.value,
            threshold_period=1,
            include_all_projects=False,
        )

        # creates a QuerySubscription for the alertrule and project
        self.alert_rule_mult.subscribe_projects(projects=[self.project])
        self.alert_rule_mult.subscribe_projects(projects=[self.project])
        all_subscriptions = self.alert_rule_mult.subscriptions.all()

        self.incident_mult = self.create_incident(
            projects=[self.project], alert_rule=self.alert_rule_mult
        )

        assert len(all_subscriptions) > 1
        assert self.incident_mult.alert_rule.exists()
        assert not self.incident_mult.subscription.exists()

    def test(self):
        self.incident.refresh_from_db()
        assert self.incident.subscription is not None
        assert self.incident.subscription.get() == self.query_subscription

        self.incident_no_alrt.refresh_from_db()
        assert not self.incident_no_alrt.subscription.exists()

        self.incident_mult.refresh_from_db()
        assert not self.incident_mult.subscription.exists()
