from __future__ import absolute_import

import unittest
from datetime import timedelta
from time import time
from random import randint
from uuid import uuid4

import six
from django.utils import timezone
from exam import fixture, patcher
from freezegun import freeze_time
from mock import call, Mock

from sentry.incidents.logic import (
    create_alert_rule,
    create_alert_rule_trigger,
    create_alert_rule_trigger_action,
)
from sentry.snuba.subscriptions import query_aggregation_to_snuba
from sentry.incidents.models import (
    AlertRule,
    AlertRuleThresholdType,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
    Incident,
    IncidentStatus,
    IncidentTrigger,
    IncidentType,
    TriggerStatus,
)
from sentry.incidents.subscription_processor import (
    build_alert_rule_stat_keys,
    build_alert_rule_trigger_stat_key,
    build_trigger_stat_keys,
    get_alert_rule_stats,
    get_redis_client,
    partition,
    SubscriptionProcessor,
    update_alert_rule_stats,
)
from sentry.snuba.models import QueryAggregations, QuerySubscription
from sentry.testutils import TestCase
from sentry.utils.dates import to_timestamp


@freeze_time()
class ProcessUpdateTest(TestCase):
    metrics = patcher("sentry.incidents.subscription_processor.metrics")

    def setUp(self):
        super(ProcessUpdateTest, self).setUp()
        self.old_handlers = AlertRuleTriggerAction._type_registrations
        AlertRuleTriggerAction._type_registrations = {}
        self.email_action_handler = Mock()
        AlertRuleTriggerAction.register_type("email", AlertRuleTriggerAction.Type.EMAIL, [])(
            self.email_action_handler
        )
        self._run_tasks = self.tasks()
        self._run_tasks.__enter__()

    def tearDown(self):
        super(ProcessUpdateTest, self).tearDown()
        AlertRuleTriggerAction._type_registrations = self.old_handlers
        self._run_tasks.__exit__(None, None, None)

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
            query="",
            aggregation=QueryAggregations.TOTAL,
            time_window=1,
            threshold_period=1,
        )
        # Make sure the trigger exists
        trigger = create_alert_rule_trigger(
            rule, "hi", AlertRuleThresholdType.ABOVE, 100, resolve_threshold=10
        )
        create_alert_rule_trigger_action(
            trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.USER,
            six.text_type(self.user.id),
        )
        return rule

    @fixture
    def trigger(self):
        return self.rule.alertruletrigger_set.get()

    @fixture
    def action(self):
        return self.trigger.alertruletriggeraction_set.get()

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
        self.email_action_handler.reset_mock()
        if time_delta is None:
            time_delta = timedelta()
        if subscription is None:
            subscription = self.sub
        processor = SubscriptionProcessor(subscription)
        message = self.build_subscription_update(subscription, value=value, time_delta=time_delta)
        processor.process_update(message)
        return processor

    def assert_trigger_exists_with_status(self, incident, trigger, status):
        assert IncidentTrigger.objects.filter(
            incident=incident, alert_rule_trigger=trigger, status=status.value
        ).exists()

    def assert_trigger_does_not_exist_for_incident(self, incident, trigger):
        assert not IncidentTrigger.objects.filter(
            incident=incident, alert_rule_trigger=trigger
        ).exists()

    def assert_trigger_does_not_exist(self, trigger, incidents_to_exclude=None):
        if incidents_to_exclude is None:
            incidents_to_exclude = []
        assert (
            not IncidentTrigger.objects.filter(alert_rule_trigger=trigger)
            .exclude(incident__in=incidents_to_exclude)
            .exists()
        )

    def assert_action_handler_called_with_actions(self, incident, actions, project=None):
        project = self.project if project is None else project

        if not actions:
            if not incident:
                assert not self.email_action_handler.called
            else:
                for call_args in self.email_action_handler.call_args_list:
                    assert call_args[0][1] != incident
        else:
            self.email_action_handler.assert_has_calls(
                [call(action, incident, project) for action in actions], any_order=True
            )

    def assert_actions_fired_for_incident(self, incident, actions=None, project=None):
        actions = [] if actions is None else actions
        project = self.project if project is None else project
        self.assert_action_handler_called_with_actions(incident, actions, project)
        assert len(actions) == len(self.email_action_handler.return_value.fire.call_args_list)

    def assert_actions_resolved_for_incident(self, incident, actions=None, project=None):
        project = self.project if project is None else project
        actions = [] if actions is None else actions
        self.assert_action_handler_called_with_actions(incident, actions, project)
        assert len(actions) == len(self.email_action_handler.return_value.resolve.call_args_list)

    def assert_no_active_incident(self, rule, subscription=None):
        assert not self.active_incident_exists(rule, subscription=subscription)

    def assert_active_incident(self, rule, subscription=None):
        incidents = self.active_incident_exists(rule, subscription=subscription)
        assert incidents
        return incidents[0]

    def active_incident_exists(self, rule, subscription=None):
        if subscription is None:
            subscription = self.sub
        return list(
            Incident.objects.filter(
                type=IncidentType.ALERT_TRIGGERED.value,
                status=IncidentStatus.OPEN.value,
                alert_rule=rule,
                projects=subscription.project,
            )
        )

    def assert_trigger_counts(self, processor, trigger, alert_triggers=0, resolve_triggers=0):
        assert processor.trigger_alert_counts[trigger.id] == alert_triggers
        assert processor.trigger_resolve_counts[trigger.id] == resolve_triggers
        alert_stats, resolve_stats = get_alert_rule_stats(
            processor.alert_rule, processor.subscription, [trigger]
        )[1:]
        assert alert_stats[trigger.id] == alert_triggers
        assert resolve_stats[trigger.id] == resolve_triggers

    def test_removed_alert_rule(self):
        message = self.build_subscription_update(self.sub)
        self.rule.delete()
        SubscriptionProcessor(self.sub).process_update(message)
        self.metrics.incr.assert_called_once_with(
            "incidents.alert_rules.no_alert_rule_for_subscription"
        )
        # TODO: Check subscription is deleted once we start doing that

    def test_skip_already_processed_update(self):
        self.send_update(self.rule, self.trigger.alert_threshold)
        self.metrics.incr.reset_mock()
        self.send_update(self.rule, self.trigger.alert_threshold)
        self.metrics.incr.assert_called_once_with(
            "incidents.alert_rules.skipping_already_processed_update"
        )
        self.metrics.incr.reset_mock()
        self.send_update(self.rule, self.trigger.alert_threshold, timedelta(hours=-1))
        self.metrics.incr.assert_called_once_with(
            "incidents.alert_rules.skipping_already_processed_update"
        )
        self.metrics.incr.reset_mock()
        self.send_update(self.rule, self.trigger.alert_threshold, timedelta(hours=1))
        self.metrics.incr.assert_not_called()  # NOQA

    def test_no_alert(self):
        rule = self.rule
        trigger = self.trigger
        processor = self.send_update(rule, trigger.alert_threshold)
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        self.assert_no_active_incident(self.rule)
        self.assert_trigger_does_not_exist(self.trigger)
        self.assert_action_handler_called_with_actions(None, [])

    def test_alert(self):
        # Verify that an alert rule that only expects a single update to be over the
        # alert threshold triggers correctly
        rule = self.rule
        trigger = self.trigger
        processor = self.send_update(rule, trigger.alert_threshold + 1)
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(incident, [self.action])

    def test_alert_multiple_threshold_periods(self):
        # Verify that a rule that expects two consecutive updates to be over the
        # alert threshold triggers correctly
        rule = self.rule
        trigger = self.trigger
        rule.update(threshold_period=2)
        processor = self.send_update(rule, trigger.alert_threshold + 1, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, self.trigger, 1, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_does_not_exist(self.trigger)
        self.assert_action_handler_called_with_actions(None, [])

        processor = self.send_update(rule, trigger.alert_threshold + 1, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(incident, [self.action])

    def test_alert_multiple_triggers_non_consecutive(self):
        # Verify that a rule that expects two consecutive updates to be over the
        # alert threshold doesn't trigger if there are two updates that are above with
        # an update that is below the threshold in the middle
        rule = self.rule
        rule.update(threshold_period=2)
        trigger = self.trigger
        processor = self.send_update(rule, trigger.alert_threshold + 1, timedelta(minutes=-3))
        self.assert_trigger_counts(processor, self.trigger, 1, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_does_not_exist(self.trigger)
        self.assert_action_handler_called_with_actions(None, [])

        processor = self.send_update(rule, trigger.alert_threshold, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_does_not_exist(self.trigger)
        self.assert_action_handler_called_with_actions(None, [])

        processor = self.send_update(rule, trigger.alert_threshold + 1, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, self.trigger, 1, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_does_not_exist(self.trigger)
        self.assert_action_handler_called_with_actions(None, [])

    def test_no_active_incident_resolve(self):
        # Test that we don't track stats for resolving if there are no active incidents
        # related to the alert rule.
        rule = self.rule
        trigger = self.trigger
        processor = self.send_update(rule, trigger.resolve_threshold - 1)
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_does_not_exist(self.trigger)
        self.assert_action_handler_called_with_actions(None, [])

    def test_resolve(self):
        # Verify that an alert rule that only expects a single update to be under the
        # resolve threshold triggers correctly
        rule = self.rule
        trigger = self.trigger
        processor = self.send_update(rule, trigger.alert_threshold + 1, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(incident, [self.action])

        processor = self.send_update(rule, trigger.resolve_threshold - 1, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(incident, [self.action])

    def test_resolve_multiple_threshold_periods(self):
        # Verify that a rule that expects two consecutive updates to be under the
        # resolve threshold triggers correctly
        rule = self.rule
        trigger = self.trigger

        processor = self.send_update(rule, trigger.alert_threshold + 1, timedelta(minutes=-3))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(incident, [self.action])

        rule.update(threshold_period=2)
        processor = self.send_update(rule, trigger.resolve_threshold - 1, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, self.trigger, 0, 1)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_action_handler_called_with_actions(incident, [])

        processor = self.send_update(rule, trigger.resolve_threshold - 1, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(incident, [self.action])

    def test_resolve_multiple_threshold_periods_non_consecutive(self):
        # Verify that a rule that expects two consecutive updates to be under the
        # resolve threshold doesn't trigger if there's two updates that are below with
        # an update that is above the threshold in the middle
        rule = self.rule
        trigger = self.trigger

        processor = self.send_update(rule, trigger.alert_threshold + 1, timedelta(minutes=-4))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(incident, [self.action])

        rule.update(threshold_period=2)
        processor = self.send_update(rule, trigger.resolve_threshold - 1, timedelta(minutes=-3))
        self.assert_trigger_counts(processor, self.trigger, 0, 1)
        self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_action_handler_called_with_actions(incident, [])

        processor = self.send_update(rule, trigger.resolve_threshold, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_action_handler_called_with_actions(incident, [])

        processor = self.send_update(rule, trigger.resolve_threshold - 1, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, self.trigger, 0, 1)
        self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_action_handler_called_with_actions(incident, [])

    def test_reversed_threshold_alert(self):
        # Test that inverting thresholds correctly alerts
        rule = self.rule
        trigger = self.trigger
        trigger.update(threshold_type=AlertRuleThresholdType.BELOW.value)
        processor = self.send_update(rule, trigger.alert_threshold + 1, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_does_not_exist(self.trigger)
        self.assert_action_handler_called_with_actions(None, [])

        processor = self.send_update(rule, trigger.alert_threshold - 1, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(incident, [self.action])

    def test_reversed_threshold_resolve(self):
        # Test that inverting thresholds correctly resolves
        rule = self.rule
        trigger = self.trigger
        trigger.update(threshold_type=AlertRuleThresholdType.BELOW.value)

        processor = self.send_update(rule, trigger.alert_threshold - 1, timedelta(minutes=-3))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(incident, [self.action])

        processor = self.send_update(rule, trigger.resolve_threshold - 1, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_action_handler_called_with_actions(incident, [])

        processor = self.send_update(rule, trigger.resolve_threshold + 1, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(incident, [self.action])

    def test_multiple_subscriptions_do_not_conflict(self):
        # Verify that multiple subscriptions associated with a rule don't conflict with
        # each other
        rule = self.rule
        rule.update(threshold_period=2)
        trigger = self.trigger

        # Send an update through for the first subscription. This shouldn't trigger an
        # incident, since we need two consecutive updates that are over the threshold.
        processor = self.send_update(
            rule, trigger.alert_threshold + 1, timedelta(minutes=-10), subscription=self.sub
        )
        self.assert_trigger_counts(processor, self.trigger, 1, 0)
        self.assert_no_active_incident(rule, self.sub)
        self.assert_trigger_does_not_exist(self.trigger)
        self.assert_action_handler_called_with_actions(None, [])

        # Have an update come through for the other sub. This shouldn't influence the original
        processor = self.send_update(
            rule, trigger.alert_threshold + 1, timedelta(minutes=-9), subscription=self.other_sub
        )
        self.assert_trigger_counts(processor, self.trigger, 1, 0)
        self.assert_no_active_incident(rule, self.sub)
        self.assert_trigger_does_not_exist(self.trigger)
        self.assert_no_active_incident(rule, self.other_sub)
        self.assert_trigger_does_not_exist(self.trigger)
        self.assert_action_handler_called_with_actions(None, [])

        # Send another update through for the first subscription. This should trigger an
        # incident for just this subscription.
        processor = self.send_update(
            rule, trigger.alert_threshold + 1, timedelta(minutes=-9), subscription=self.sub
        )
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(incident, [self.action])
        self.assert_no_active_incident(rule, self.other_sub)
        self.assert_trigger_does_not_exist(self.trigger, [incident])

        # Send another update through for the second subscription. This should trigger an
        # incident for just this subscription.
        processor = self.send_update(
            rule, trigger.alert_threshold + 1, timedelta(minutes=-8), subscription=self.other_sub
        )
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_action_handler_called_with_actions(incident, [])
        other_incident = self.assert_active_incident(rule, self.other_sub)
        self.assert_trigger_exists_with_status(other_incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(other_incident, [self.action], self.other_project)

        # Now we want to test that resolving is isolated. Send another update through
        # for the first subscription.
        processor = self.send_update(
            rule, trigger.resolve_threshold - 1, timedelta(minutes=-7), subscription=self.sub
        )
        self.assert_trigger_counts(processor, self.trigger, 0, 1)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_action_handler_called_with_actions(incident, [])
        other_incident = self.assert_active_incident(rule, self.other_sub)
        self.assert_trigger_exists_with_status(other_incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_action_handler_called_with_actions(other_incident, [])

        processor = self.send_update(
            rule, trigger.resolve_threshold - 1, timedelta(minutes=-7), subscription=self.other_sub
        )
        self.assert_trigger_counts(processor, self.trigger, 0, 1)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_action_handler_called_with_actions(incident, [])
        other_incident = self.assert_active_incident(rule, self.other_sub)
        self.assert_trigger_exists_with_status(other_incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_action_handler_called_with_actions(other_incident, [])

        # This second update for the second subscription should resolve its incident,
        # but not the incident from the first subscription.
        processor = self.send_update(
            rule, trigger.resolve_threshold - 1, timedelta(minutes=-6), subscription=self.other_sub
        )
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_no_active_incident(rule, self.other_sub)
        self.assert_trigger_exists_with_status(other_incident, self.trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(other_incident, [self.action], self.other_project)

        # This second update for the first subscription should resolve its incident now.
        processor = self.send_update(
            rule, trigger.resolve_threshold - 1, timedelta(minutes=-6), subscription=self.sub
        )
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        self.assert_no_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(incident, [self.action])
        self.assert_no_active_incident(rule, self.other_sub)
        self.assert_trigger_exists_with_status(other_incident, self.trigger, TriggerStatus.RESOLVED)
        self.assert_action_handler_called_with_actions(other_incident, [])

    def test_multiple_triggers(self):
        rule = self.rule
        rule.update(threshold_period=2)
        trigger = self.trigger
        other_trigger = create_alert_rule_trigger(
            self.rule, "hello", AlertRuleThresholdType.ABOVE, 200, resolve_threshold=50
        )
        other_action = create_alert_rule_trigger_action(
            other_trigger, AlertRuleTriggerAction.Type.EMAIL, AlertRuleTriggerAction.TargetType.USER
        )
        processor = self.send_update(
            rule, trigger.alert_threshold + 1, timedelta(minutes=-10), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 1, 0)
        self.assert_trigger_counts(processor, other_trigger, 0, 0)
        self.assert_no_active_incident(rule, self.sub)
        self.assert_trigger_does_not_exist(trigger)
        self.assert_trigger_does_not_exist(other_trigger)
        self.assert_action_handler_called_with_actions(None, [])

        # This should cause both to increment, although only `trigger` should fire.
        processor = self.send_update(
            rule, other_trigger.alert_threshold + 1, timedelta(minutes=-9), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, other_trigger, 1, 0)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_does_not_exist(other_trigger)
        self.assert_actions_fired_for_incident(incident, [self.action])

        # Now only `other_trigger` should increment and fire.
        processor = self.send_update(
            rule, other_trigger.alert_threshold + 1, timedelta(minutes=-8), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, other_trigger, 0, 0)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_exists_with_status(incident, other_trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(incident, [other_action])

        # Now send through two updates where we're below threshold for `other_trigger`.
        # The trigger should end up resolved, but the incident should still be active
        processor = self.send_update(
            rule, other_trigger.resolve_threshold - 1, timedelta(minutes=-7), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, other_trigger, 0, 1)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_exists_with_status(incident, other_trigger, TriggerStatus.ACTIVE)
        self.assert_action_handler_called_with_actions(incident, [])

        processor = self.send_update(
            rule, other_trigger.resolve_threshold - 1, timedelta(minutes=-6), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, other_trigger, 0, 0)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_exists_with_status(incident, other_trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(incident, [other_action])

        # Now we push the other trigger below the resolve threshold twice. This should
        # close the incident.
        processor = self.send_update(
            rule, trigger.resolve_threshold - 1, timedelta(minutes=-5), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 1)
        self.assert_trigger_counts(processor, other_trigger, 0, 0)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_exists_with_status(incident, other_trigger, TriggerStatus.RESOLVED)
        self.assert_action_handler_called_with_actions(incident, [])

        processor = self.send_update(
            rule, trigger.resolve_threshold - 1, timedelta(minutes=-4), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, other_trigger, 0, 0)
        self.assert_no_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.RESOLVED)
        self.assert_trigger_exists_with_status(incident, other_trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(incident, [self.action])

    def test_multiple_triggers_at_same_time(self):
        # Check that both triggers fire if an update comes through that exceeds both of
        # their thresholds
        rule = self.rule
        trigger = self.trigger
        other_trigger = create_alert_rule_trigger(
            self.rule, "hello", AlertRuleThresholdType.ABOVE, 200, resolve_threshold=50
        )
        other_action = create_alert_rule_trigger_action(
            other_trigger, AlertRuleTriggerAction.Type.EMAIL, AlertRuleTriggerAction.TargetType.USER
        )

        processor = self.send_update(
            rule, other_trigger.alert_threshold + 1, timedelta(minutes=-10), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, other_trigger, 0, 0)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_exists_with_status(incident, other_trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(incident, [self.action, other_action])

        processor = self.send_update(
            rule, trigger.resolve_threshold - 1, timedelta(minutes=-9), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, other_trigger, 0, 0)
        self.assert_no_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.RESOLVED)
        self.assert_trigger_exists_with_status(incident, other_trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(incident, [self.action, other_action])

    def test_multiple_triggers_one_with_no_resolve(self):
        # Check that both triggers fire if an update comes through that exceeds both of
        # their thresholds
        rule = self.rule
        trigger = self.trigger
        other_trigger = create_alert_rule_trigger(
            self.rule, "hello", AlertRuleThresholdType.ABOVE, 200
        )
        other_action = create_alert_rule_trigger_action(
            other_trigger, AlertRuleTriggerAction.Type.EMAIL, AlertRuleTriggerAction.TargetType.USER
        )

        processor = self.send_update(
            rule, other_trigger.alert_threshold + 1, timedelta(minutes=-10), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, other_trigger, 0, 0)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_exists_with_status(incident, other_trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(incident, [self.action, other_action])

        processor = self.send_update(
            rule, trigger.resolve_threshold - 1, timedelta(minutes=-9), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, other_trigger, 0, 0)
        self.assert_no_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.RESOLVED)
        self.assert_trigger_exists_with_status(incident, other_trigger, TriggerStatus.ACTIVE)
        self.assert_actions_resolved_for_incident(incident, [self.action])


class TestBuildAlertRuleStatKeys(unittest.TestCase):
    def test(self):
        stat_keys = build_alert_rule_stat_keys(AlertRule(id=1), QuerySubscription(project_id=2))
        assert stat_keys == ["{alert_rule:1:project:2}:last_update"]


class TestBuildTriggerStatKeys(unittest.TestCase):
    def test(self):
        stat_keys = build_trigger_stat_keys(
            AlertRule(id=1),
            QuerySubscription(project_id=2),
            [AlertRuleTrigger(id=3), AlertRuleTrigger(id=4)],
        )
        assert stat_keys == [
            "{alert_rule:1:project:2}:trigger:3:alert_triggered",
            "{alert_rule:1:project:2}:trigger:3:resolve_triggered",
            "{alert_rule:1:project:2}:trigger:4:alert_triggered",
            "{alert_rule:1:project:2}:trigger:4:resolve_triggered",
        ]


class TestBuildAlertRuleTriggerStatKey(unittest.TestCase):
    def test(self):
        stat_key = build_alert_rule_trigger_stat_key(
            alert_rule_id=1, project_id=2, trigger_id=3, stat_key="hello"
        )
        assert stat_key == "{alert_rule:1:project:2}:trigger:3:hello"


class TestPartition(unittest.TestCase):
    def test(self):
        assert list(partition(range(8), 2)) == [(0, 1), (2, 3), (4, 5), (6, 7)]
        assert list(partition(range(9), 3)) == [(0, 1, 2), (3, 4, 5), (6, 7, 8)]


class TestGetAlertRuleStats(TestCase):
    def test(self):
        alert_rule = AlertRule(id=1)
        sub = QuerySubscription(project_id=2)
        triggers = [AlertRuleTrigger(id=3), AlertRuleTrigger(id=4)]
        client = get_redis_client()
        pipeline = client.pipeline()
        pipeline.set("{alert_rule:1:project:2}:last_update", 1234)
        for key, value in [
            ("{alert_rule:1:project:2}:trigger:3:alert_triggered", 1),
            ("{alert_rule:1:project:2}:trigger:3:resolve_triggered", 2),
            ("{alert_rule:1:project:2}:trigger:4:alert_triggered", 3),
            ("{alert_rule:1:project:2}:trigger:4:resolve_triggered", 4),
        ]:
            pipeline.set(key, value)
        pipeline.execute()

        last_update, alert_counts, resolve_counts = get_alert_rule_stats(alert_rule, sub, triggers)
        assert last_update == 1234
        assert alert_counts == {3: 1, 4: 3}
        assert resolve_counts == {3: 2, 4: 4}


class TestUpdateAlertRuleStats(TestCase):
    def test(self):
        alert_rule = AlertRule(id=1)
        sub = QuerySubscription(project_id=2)
        update_alert_rule_stats(alert_rule, sub, 1234, {3: 20, 4: 3}, {3: 10, 4: 15})
        client = get_redis_client()
        results = map(
            int,
            client.mget(
                [
                    "{alert_rule:1:project:2}:last_update",
                    "{alert_rule:1:project:2}:trigger:3:alert_triggered",
                    "{alert_rule:1:project:2}:trigger:3:resolve_triggered",
                    "{alert_rule:1:project:2}:trigger:4:alert_triggered",
                    "{alert_rule:1:project:2}:trigger:4:resolve_triggered",
                ]
            ),
        )

        assert results == [1234, 20, 10, 3, 15]
