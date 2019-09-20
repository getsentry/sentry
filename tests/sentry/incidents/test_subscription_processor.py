from __future__ import absolute_import

from datetime import timedelta
from time import time
from random import randint
from uuid import uuid4

from django.utils import timezone
from exam import fixture, patcher
from freezegun import freeze_time

from sentry.incidents.logic import create_alert_rule
from sentry.snuba.subscriptions import query_aggregation_to_snuba
from sentry.incidents.models import AlertRuleThresholdType, Incident, IncidentStatus, IncidentType
from sentry.incidents.subscription_processor import get_alert_rule_stats, SubscriptionProcessor
from sentry.snuba.models import QueryAggregations
from sentry.testutils import TestCase
from sentry.utils.dates import to_timestamp


@freeze_time()
class ProcessUpdateTest(TestCase):
    metrics = patcher("sentry.incidents.subscription_processor.metrics")

    @fixture
    def other_project(self):
        return self.create_project()

    @fixture
    def sub(self):
        return self.rule.query_subscriptions.filter(project=self.project).get()

    @fixture
    def other_sub(self):
        return self.rule.query_subscriptions.filter(project=self.other_project).get()

    @fixture
    def rule(self):
        rule = create_alert_rule(
            self.organization,
            [self.project, self.other_project],
            "some rule",
            AlertRuleThresholdType.ABOVE,
            query="",
            aggregation=QueryAggregations.TOTAL,
            time_window=1,
            alert_threshold=100,
            resolve_threshold=10,
            threshold_period=1,
        )
        return rule

    def build_subscription_update(self, subscription, time_delta=None, value=None):
        if time_delta is not None:
            timestamp = int(to_timestamp(timezone.now() + time_delta))
        else:
            timestamp = int(time())

        values = {}

        if subscription:
            aggregation_type = query_aggregation_to_snuba[
                QueryAggregations(subscription.aggregation)
            ]
            value = randint(0, 100) if value is None else value
            values = {aggregation_type[2]: value}
        return {
            "subscription_id": subscription.subscription_id if subscription else uuid4().hex,
            "values": values,
            "timestamp": timestamp,
            "interval": 1,
            "partition": 1,
            "offset": 1,
        }

    def send_update(self, rule, value, time_delta=None, subscription=None):
        if time_delta is None:
            time_delta = timedelta()
        if subscription is None:
            subscription = self.sub
        processor = SubscriptionProcessor(subscription)
        message = self.build_subscription_update(subscription, value=value, time_delta=time_delta)
        processor.process_update(message)
        return processor

    def assert_no_active_incident(self, rule, subscription=None):
        assert not self.active_incident_exists(rule, subscription=subscription)

    def assert_active_incident(self, rule, subscription=None):
        assert self.active_incident_exists(rule, subscription=subscription)

    def active_incident_exists(self, rule, subscription=None):
        if subscription is None:
            subscription = self.sub
        return Incident.objects.filter(
            type=IncidentType.ALERT_TRIGGERED.value,
            status=IncidentStatus.OPEN.value,
            alert_rule=rule,
            projects=subscription.project,
        ).exists()

    def assert_trigger_counts(self, processor, alert_triggers=0, resolve_triggers=0):
        assert processor.alert_triggers == alert_triggers
        assert processor.resolve_triggers == resolve_triggers
        assert get_alert_rule_stats(processor.alert_rule, processor.subscription)[1:] == (
            alert_triggers,
            resolve_triggers,
        )

    def test_removed_alert_rule(self):
        message = self.build_subscription_update(self.sub)
        self.rule.delete()
        SubscriptionProcessor(self.sub).process_update(message)
        self.metrics.incr.assert_called_once_with(
            "incidents.alert_rules.no_alert_rule_for_subscription"
        )
        # TODO: Check subscription is deleted once we start doing that

    def test_skip_already_processed_update(self):
        self.send_update(self.rule, self.rule.alert_threshold)
        self.metrics.incr.reset_mock()
        self.send_update(self.rule, self.rule.alert_threshold)
        self.metrics.incr.assert_called_once_with(
            "incidents.alert_rules.skipping_already_processed_update"
        )
        self.metrics.incr.reset_mock()
        self.send_update(self.rule, self.rule.alert_threshold, timedelta(hours=-1))
        self.metrics.incr.assert_called_once_with(
            "incidents.alert_rules.skipping_already_processed_update"
        )
        self.metrics.incr.reset_mock()
        self.send_update(self.rule, self.rule.alert_threshold, timedelta(hours=1))
        self.metrics.incr.assert_not_called()  # NOQA

    def test_no_alert(self):
        rule = self.rule
        processor = self.send_update(rule, rule.alert_threshold)
        self.assert_trigger_counts(processor, 0, 0)
        self.assert_no_active_incident(self.rule)

    def test_alert(self):
        # Verify that an alert rule that only expects a single update to be over the
        # alert threshold triggers correctly
        rule = self.rule
        processor = self.send_update(rule, rule.alert_threshold + 1)
        self.assert_trigger_counts(processor, 0, 0)
        self.assert_active_incident(rule)

    def test_alert_multiple_triggers(self):
        # Verify that a rule that expects two consecutive updates to be over the
        # alert threshold triggers correctly
        rule = self.rule
        rule.update(threshold_period=2)
        processor = self.send_update(rule, rule.alert_threshold + 1, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, 1, 0)
        self.assert_no_active_incident(rule)

        processor = self.send_update(rule, rule.alert_threshold + 1, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, 0, 0)
        self.assert_active_incident(rule)

    def test_alert_multiple_triggers_non_consecutive(self):
        # Verify that a rule that expects two consecutive updates to be over the
        # alert threshold doesn't trigger if there are two updates that are above with
        # an update that is below the threshold in the middle
        rule = self.rule
        rule.update(threshold_period=2)
        processor = self.send_update(rule, rule.alert_threshold + 1, timedelta(minutes=-3))
        self.assert_trigger_counts(processor, 1, 0)
        self.assert_no_active_incident(rule)

        processor = self.send_update(rule, rule.alert_threshold, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, 0, 0)
        self.assert_no_active_incident(rule)

        processor = self.send_update(rule, rule.alert_threshold + 1, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, 1, 0)
        self.assert_no_active_incident(rule)

    def test_no_active_incident_resolve(self):
        # Test that we don't track stats for resolving if there are no active incidents
        # related to the alert rule.
        rule = self.rule
        processor = self.send_update(rule, rule.resolve_threshold - 1)
        self.assert_trigger_counts(processor, 0, 0)
        self.assert_no_active_incident(rule)

    def test_resolve(self):
        # Verify that an alert rule that only expects a single update to be under the
        # resolve threshold triggers correctly
        rule = self.rule
        processor = self.send_update(rule, rule.alert_threshold + 1, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, 0, 0)
        self.assert_active_incident(rule)

        processor = self.send_update(rule, rule.resolve_threshold - 1, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, 0, 0)
        self.assert_no_active_incident(rule)

    def test_resolve_multiple_triggers(self):
        # Verify that a rule that expects two consecutive updates to be under the
        # resolve threshold triggers correctly
        rule = self.rule

        processor = self.send_update(rule, rule.alert_threshold + 1, timedelta(minutes=-3))
        self.assert_trigger_counts(processor, 0, 0)
        self.assert_active_incident(rule)

        rule.update(threshold_period=2)
        processor = self.send_update(rule, rule.resolve_threshold - 1, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, 0, 1)
        self.assert_active_incident(rule)

        processor = self.send_update(rule, rule.resolve_threshold - 1, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, 0, 0)
        self.assert_no_active_incident(rule)

    def test_resolve_multiple_triggers_non_consecutive(self):
        # Verify that a rule that expects two consecutive updates to be under the
        # resolve threshold doesn't trigger if there's two updates that are below with
        # an update that is above the threshold in the middle
        rule = self.rule

        processor = self.send_update(rule, rule.alert_threshold + 1, timedelta(minutes=-4))
        self.assert_trigger_counts(processor, 0, 0)
        self.assert_active_incident(rule)

        rule.update(threshold_period=2)
        processor = self.send_update(rule, rule.resolve_threshold - 1, timedelta(minutes=-3))
        self.assert_trigger_counts(processor, 0, 1)
        self.assert_active_incident(rule)

        processor = self.send_update(rule, rule.resolve_threshold, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, 0, 0)
        self.assert_active_incident(rule)

        processor = self.send_update(rule, rule.resolve_threshold - 1, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, 0, 1)
        self.assert_active_incident(rule)

    def test_reversed_threshold_alert(self):
        # Test that inverting thresholds correctly alerts
        rule = self.rule
        rule.update(threshold_type=AlertRuleThresholdType.BELOW.value)
        processor = self.send_update(rule, rule.alert_threshold + 1, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, 0, 0)
        self.assert_no_active_incident(rule)

        processor = self.send_update(rule, rule.alert_threshold - 1, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, 0, 0)
        self.assert_active_incident(rule)

    def test_reversed_threshold_resolve(self):
        # Test that inverting thresholds correctly resolves
        rule = self.rule
        rule.update(threshold_type=AlertRuleThresholdType.BELOW.value)

        processor = self.send_update(rule, rule.alert_threshold - 1, timedelta(minutes=-3))
        self.assert_trigger_counts(processor, 0, 0)
        self.assert_active_incident(rule)

        processor = self.send_update(rule, rule.resolve_threshold - 1, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, 0, 0)
        self.assert_active_incident(rule)

        processor = self.send_update(rule, rule.resolve_threshold + 1, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, 0, 0)
        self.assert_no_active_incident(rule)

    def test_multiple_subscriptions_do_not_conflict(self):
        # Verify that multiple subscriptions associated with a rule don't conflict with
        # each other
        rule = self.rule
        rule.update(threshold_period=2)

        # Send an update through for the first subscription. This shouldn't trigger an
        # incident, since we need two consecutive updates that are over the threshold.
        processor = self.send_update(
            rule, rule.alert_threshold + 1, timedelta(minutes=-10), subscription=self.sub
        )
        self.assert_trigger_counts(processor, 1, 0)
        self.assert_no_active_incident(rule, self.sub)

        # Have an update come through for the other sub. This shouldn't influence the original
        processor = self.send_update(
            rule, rule.alert_threshold + 1, timedelta(minutes=-9), subscription=self.other_sub
        )
        self.assert_trigger_counts(processor, 1, 0)
        self.assert_no_active_incident(rule, self.sub)
        self.assert_no_active_incident(rule, self.other_sub)

        # Send another update through for the first subscription. This should trigger an
        # incident for just this subscription.
        processor = self.send_update(
            rule, rule.alert_threshold + 1, timedelta(minutes=-9), subscription=self.sub
        )
        self.assert_trigger_counts(processor, 0, 0)
        self.assert_active_incident(rule, self.sub)
        self.assert_no_active_incident(rule, self.other_sub)

        # Send another update through for the second subscription. This should trigger an
        # incident for just this subscription.
        processor = self.send_update(
            rule, rule.alert_threshold + 1, timedelta(minutes=-8), subscription=self.other_sub
        )
        self.assert_trigger_counts(processor, 0, 0)
        self.assert_active_incident(rule, self.sub)
        self.assert_active_incident(rule, self.other_sub)

        # Now we want to test that resolving is isolated. Send another update through
        # for the first subscription.
        processor = self.send_update(
            rule, rule.resolve_threshold - 1, timedelta(minutes=-7), subscription=self.sub
        )
        self.assert_trigger_counts(processor, 0, 1)
        self.assert_active_incident(rule, self.sub)
        self.assert_active_incident(rule, self.other_sub)

        processor = self.send_update(
            rule, rule.resolve_threshold - 1, timedelta(minutes=-7), subscription=self.other_sub
        )
        self.assert_trigger_counts(processor, 0, 1)
        self.assert_active_incident(rule, self.sub)
        self.assert_active_incident(rule, self.other_sub)

        # This second update for the second subscription should resolve its incident,
        # but not the incident from the first subscription.
        processor = self.send_update(
            rule, rule.resolve_threshold - 1, timedelta(minutes=-6), subscription=self.other_sub
        )
        self.assert_trigger_counts(processor, 0, 0)
        self.assert_active_incident(rule, self.sub)
        self.assert_no_active_incident(rule, self.other_sub)

        # This second update for the first subscription should resolve its incident now.
        processor = self.send_update(
            rule, rule.resolve_threshold - 1, timedelta(minutes=-6), subscription=self.sub
        )
        self.assert_trigger_counts(processor, 0, 0)
        self.assert_no_active_incident(rule, self.sub)
        self.assert_no_active_incident(rule, self.other_sub)
