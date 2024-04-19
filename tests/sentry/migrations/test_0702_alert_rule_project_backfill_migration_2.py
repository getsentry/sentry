from datetime import timedelta

from sentry.incidents.models.alert_rule import AlertRule, AlertRuleThresholdType
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.snuba.subscriptions import create_snuba_query
from sentry.testutils.cases import TestMigrations


class AlertRuleProjectBackfillTest(TestMigrations):
    migrate_from = "0701_backfill_alertrule_user_team"
    migrate_to = "0702_alert_rule_project_backfill_migration_2"

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

        assert not self.alert_rule.projects.exists()
        assert self.query_subscription.project == self.project

        # Different project
        self.p2 = self.create_project(organization=self.organization)
        self.snuba_query_existing = create_snuba_query(
            aggregate="",
            dataset=Dataset.Events,
            environment=None,
            query="",
            query_type=SnubaQuery.Type.ERROR,
            resolution=timedelta(minutes=5),
            time_window=timedelta(minutes=5),
        )
        self.alert_rule_existing_project = AlertRule.objects.create(
            organization=self.organization,
            snuba_query=self.snuba_query_existing,
            name="foo",
            threshold_type=AlertRuleThresholdType.ABOVE.value,
            threshold_period=1,
            include_all_projects=False,
        )
        self.alert_rule_existing_project.projects.add(self.p2)

        # creates a QuerySubscription for the alertrule and project
        self.alert_rule_existing_project.subscribe_projects(projects=[self.project])
        self.query_subscription_existing_project = self.snuba_query_existing.subscriptions.get()

        assert self.alert_rule_existing_project.projects.exists()
        assert self.alert_rule_existing_project.projects.get() == self.p2
        assert self.query_subscription_existing_project.project == self.project

        # Multiple Projects
        self.p3 = self.create_project(organization=self.organization)
        self.snuba_query_multiple = create_snuba_query(
            aggregate="",
            dataset=Dataset.Events,
            environment=None,
            query="",
            query_type=SnubaQuery.Type.ERROR,
            resolution=timedelta(minutes=5),
            time_window=timedelta(minutes=5),
        )
        self.alert_rule_multiple_project = AlertRule.objects.create(
            organization=self.organization,
            snuba_query=self.snuba_query_multiple,
            name="foo",
            threshold_type=AlertRuleThresholdType.ABOVE.value,
            threshold_period=1,
            include_all_projects=False,
        )
        self.alert_rule_multiple_project.projects.add(self.p2)
        self.alert_rule_multiple_project.projects.add(self.p3)

        # creates a QuerySubscription for the alertrule and project
        self.alert_rule_multiple_project.subscribe_projects(projects=[self.project])
        self.query_subscription_multiple_project = self.snuba_query_multiple.subscriptions.get()

        assert self.alert_rule_multiple_project.projects.exists()
        assert len(self.alert_rule_multiple_project.projects.all()) == 2
        assert self.query_subscription_multiple_project.project == self.project

    def test(self):
        self.alert_rule.refresh_from_db()
        assert self.alert_rule.projects is not None
        assert self.alert_rule.projects.get() == self.project

        self.alert_rule_existing_project.refresh_from_db()
        assert self.alert_rule.projects is not None
        assert self.alert_rule.projects.get() == self.project

        self.alert_rule_existing_project.refresh_from_db()
        assert self.alert_rule.projects is not None
        assert self.alert_rule.projects.get() == self.project
