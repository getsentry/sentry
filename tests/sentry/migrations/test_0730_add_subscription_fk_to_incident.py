from datetime import timedelta

import pytest

from sentry.incidents.models.alert_rule import AlertRule, AlertRuleThresholdType
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.snuba.subscriptions import create_snuba_query
from sentry.testutils.cases import TestMigrations


class AlertRuleProjectBackfillTest(TestMigrations):
    migrate_from = "0729_backfill_groupsearchviews_with_pinned_searches"
    migrate_to = "0730_add_subscription_fk_to_incident"

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
        assert not self.incident.subscription

        snuba_query_existing_sub = create_snuba_query(
            aggregate="",
            dataset=Dataset.Events,
            environment=None,
            query="",
            query_type=SnubaQuery.Type.ERROR,
            resolution=timedelta(minutes=5),
            time_window=timedelta(minutes=5),
        )
        alert_rule_existing_sub = AlertRule.objects.create(
            organization=self.organization,
            snuba_query=snuba_query_existing_sub,
            name="foo",
            threshold_type=AlertRuleThresholdType.ABOVE.value,
            threshold_period=1,
            include_all_projects=False,
        )

        # creates a QuerySubscription for the alertrule and project
        alert_rule_existing_sub.subscribe_projects(projects=[self.project])
        self.query_subscription_existing_sub = snuba_query_existing_sub.subscriptions.get()

        self.incident_existing_sub = self.create_incident(
            projects=[self.project],
            alert_rule=alert_rule_existing_sub,
            subscription=self.query_subscription_existing_sub,
        )

        assert self.incident_existing_sub.alert_rule == alert_rule_existing_sub
        assert self.incident_existing_sub.subscription == self.query_subscription_existing_sub

        # Incident with a no subscriptions
        snuba_query_no_sub = create_snuba_query(
            aggregate="",
            dataset=Dataset.Events,
            environment=None,
            query="",
            query_type=SnubaQuery.Type.ERROR,
            resolution=timedelta(minutes=5),
            time_window=timedelta(minutes=5),
        )
        self.alert_rule_no_sub = AlertRule.objects.create(
            organization=self.organization,
            snuba_query=snuba_query_no_sub,
            name="foo",
            threshold_type=AlertRuleThresholdType.ABOVE.value,
            threshold_period=1,
            include_all_projects=False,
        )

        # creates a QuerySubscription for the alertrule and project
        self.alert_rule_no_sub.subscribe_projects(projects=[self.project])
        temp_subscription = snuba_query_no_sub.subscriptions.get()
        temp_subscription.delete()

        self.incident_no_sub = self.create_incident(
            projects=[self.project], alert_rule=self.alert_rule_no_sub
        )

        assert self.incident_no_sub.alert_rule == self.alert_rule_no_sub
        assert not self.incident_no_sub.subscription

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
        all_subscriptions = snuba_query_mult.subscriptions.all()

        self.incident_mult = self.create_incident(
            projects=[self.project], alert_rule=self.alert_rule_mult
        )

        assert len(all_subscriptions) > 1
        assert self.incident_mult.alert_rule
        assert not self.incident_mult.subscription

    @pytest.mark.skip(reason="old migration test")
    def test(self):
        self.incident.refresh_from_db()
        assert self.incident.subscription is not None
        assert self.incident.subscription == self.query_subscription

        self.query_subscription.delete()
        self.incident.refresh_from_db()
        assert self.incident
        assert self.incident.subscription is None

        self.incident_existing_sub.refresh_from_db()
        assert self.incident_existing_sub.subscription is not None
        assert self.incident_existing_sub.subscription == self.query_subscription_existing_sub

        self.incident_no_sub.refresh_from_db()
        assert not self.incident_no_sub.subscription

        self.incident_mult.refresh_from_db()
        assert not self.incident_mult.subscription
