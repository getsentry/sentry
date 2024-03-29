from datetime import timedelta

from sentry.incidents.models.alert_rule import AlertRule, AlertRuleThresholdType
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.snuba.subscriptions import create_snuba_query
from sentry.testutils.cases import TestMigrations


class AlertRuleProjectBackfillTest(TestMigrations):
    migrate_from = "0682_monitors_constrain_to_project_id_slug"
    migrate_to = "0683_alert_rule_project_backfill_migration"

    def setup_before_migration(self):
        self.snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.ERROR,
            dataset=Dataset.Events,
            query="",
            aggregate="",
            time_window=timedelta(minutes=5),
            resolution=timedelta(minutes=5),
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
        self.query_subscription = self.snuba_query.query_subscriptions.get()

        assert self.alert_rule.projects is None
        assert self.query_subscription.project == self.project

    def test(self):
        self.alert_rule.refresh_from_db()
        assert self.alert_rule.projects is not None
        assert self.alert_rule.projects.get() == self.project
