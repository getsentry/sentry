from __future__ import absolute_import

import unittest
from datetime import datetime, timedelta
from random import randint
from uuid import uuid4

import pytz
import six
from django.utils import timezone
from exam import fixture, patcher
from freezegun import freeze_time
from sentry.utils.compat.mock import call, Mock

from sentry.incidents.logic import create_alert_rule_trigger, create_alert_rule_trigger_action
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
from sentry.snuba.models import QuerySubscription
from sentry.testutils import TestCase
from sentry.utils.dates import to_timestamp
from sentry.utils.compat import map


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
        return self.rule.snuba_query.subscriptions.filter(project=self.project).get()

    @fixture
    def other_sub(self):
        return self.rule.snuba_query.subscriptions.filter(project=self.other_project).get()

    @fixture
    def rule(self):
        rule = self.create_alert_rule(
            projects=[self.project, self.other_project],
            name="some rule",
            query="",
            aggregate="count()",
            time_window=1,
            threshold_type=AlertRuleThresholdType.ABOVE,
            resolve_threshold=10,
            threshold_period=1,
        )
        # Make sure the trigger exists
        trigger = create_alert_rule_trigger(rule, "hi", 100)
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
            timestamp = timezone.now() + time_delta
        else:
            timestamp = timezone.now()
        timestamp = timestamp.replace(tzinfo=pytz.utc, microsecond=0)

        data = {}

        if subscription:
            data = {"some_col_name": randint(0, 100) if value is None else value}
        values = {"data": [data]}
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
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
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
                alert_rule=rule,
                projects=subscription.project,
            ).exclude(status=IncidentStatus.CLOSED.value)
        )

    def assert_trigger_counts(self, processor, trigger, alert_triggers=0, resolve_triggers=0):
        assert processor.trigger_alert_counts[trigger.id] == alert_triggers
        assert processor.rule_resolve_counts == resolve_triggers
        alert_stats, resolve_stats = get_alert_rule_stats(
            processor.alert_rule, processor.subscription, [trigger]
        )[1:]
        assert alert_stats[trigger.id] == alert_triggers
        assert resolve_stats == resolve_triggers

    def test_removed_alert_rule(self):
        message = self.build_subscription_update(self.sub)
        self.rule.delete()
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            SubscriptionProcessor(self.sub).process_update(message)
        self.metrics.incr.assert_called_once_with(
            "incidents.alert_rules.no_alert_rule_for_subscription"
        )
        # TODO: Check subscription is deleted once we start doing that

    def test_removed_project(self):
        message = self.build_subscription_update(self.sub)
        self.project.delete()
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            SubscriptionProcessor(self.sub).process_update(message)
        self.metrics.incr.assert_called_once_with("incidents.alert_rules.ignore_deleted_project")

    def test_no_feature(self):
        message = self.build_subscription_update(self.sub)
        SubscriptionProcessor(self.sub).process_update(message)
        self.metrics.incr.assert_called_once_with(
            "incidents.alert_rules.ignore_update_missing_incidents"
        )

    def test_no_feature_performance(self):
        self.sub.snuba_query.dataset = "transactions"
        message = self.build_subscription_update(self.sub)
        with self.feature("organizations:incidents"):
            SubscriptionProcessor(self.sub).process_update(message)
        self.metrics.incr.assert_called_once_with(
            "incidents.alert_rules.ignore_update_missing_incidents_performance"
        )

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
        assert incident.date_started == (
            timezone.now().replace(microsecond=0) - timedelta(seconds=rule.snuba_query.time_window)
        )
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
        processor = self.send_update(rule, rule.resolve_threshold - 1)
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_does_not_exist(trigger)
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

        processor = self.send_update(rule, rule.resolve_threshold - 1, timedelta(minutes=-1))
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
        processor = self.send_update(rule, rule.resolve_threshold - 1, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, self.trigger, 0, 1)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_action_handler_called_with_actions(incident, [])

        processor = self.send_update(rule, rule.resolve_threshold - 1, timedelta(minutes=-1))
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
        processor = self.send_update(rule, rule.resolve_threshold - 1, timedelta(minutes=-3))
        self.assert_trigger_counts(processor, self.trigger, 0, 1)
        self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_action_handler_called_with_actions(incident, [])

        processor = self.send_update(rule, rule.resolve_threshold, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_action_handler_called_with_actions(incident, [])

        processor = self.send_update(rule, rule.resolve_threshold - 1, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, self.trigger, 0, 1)
        self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_action_handler_called_with_actions(incident, [])

    def test_auto_resolve(self):
        # Verify that we resolve an alert rule automatically even if no resolve
        # threshold is set
        rule = self.rule
        rule.update(resolve_threshold=None)
        trigger = self.trigger
        processor = self.send_update(rule, trigger.alert_threshold + 1, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(incident, [self.action])

        processor = self.send_update(rule, trigger.alert_threshold - 1, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(incident, [self.action])

    def test_auto_resolve_percent_boundary(self):
        # Verify that we resolve an alert rule automatically even if no resolve
        # threshold is set
        rule = self.rule
        rule.update(resolve_threshold=None)
        trigger = self.trigger
        trigger.update(alert_threshold=0.5)
        processor = self.send_update(rule, trigger.alert_threshold + 0.1, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(incident, [self.action])

        processor = self.send_update(rule, trigger.alert_threshold, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(incident, [self.action])

    def test_auto_resolve_boundary(self):
        # Verify that we resolve an alert rule automatically if the value hits the
        # original alert trigger value
        rule = self.rule
        rule.update(resolve_threshold=None)
        trigger = self.trigger
        processor = self.send_update(rule, trigger.alert_threshold + 1, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(incident, [self.action])

        processor = self.send_update(rule, trigger.alert_threshold, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(incident, [self.action])

    def test_auto_resolve_reversed(self):
        # Test auto resolving works correctly when threshold is reversed
        rule = self.rule
        rule.update(resolve_threshold=None, threshold_type=AlertRuleThresholdType.BELOW.value)
        trigger = self.trigger
        processor = self.send_update(rule, trigger.alert_threshold - 1, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(incident, [self.action])

        processor = self.send_update(rule, trigger.alert_threshold + 1, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(incident, [self.action])

    def test_auto_resolve_multiple_trigger(self):
        # Test auto resolving works correctly when multiple triggers are present.
        rule = self.rule
        rule.update(resolve_threshold=None)
        trigger = self.trigger
        other_trigger = create_alert_rule_trigger(self.rule, "hello", trigger.alert_threshold - 10)
        other_action = create_alert_rule_trigger_action(
            other_trigger, AlertRuleTriggerAction.Type.EMAIL, AlertRuleTriggerAction.TargetType.USER
        )
        processor = self.send_update(rule, trigger.alert_threshold + 1, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_exists_with_status(incident, other_trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(incident, [self.action, other_action])

        processor = self.send_update(rule, other_trigger.alert_threshold - 1, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.RESOLVED)
        self.assert_trigger_exists_with_status(incident, other_trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(incident, [self.action, other_action])

    def test_reversed_threshold_alert(self):
        # Test that inverting thresholds correctly alerts
        rule = self.rule
        trigger = self.trigger
        rule.update(threshold_type=AlertRuleThresholdType.BELOW.value)
        trigger.update(alert_threshold=rule.resolve_threshold + 1)
        processor = self.send_update(rule, trigger.alert_threshold + 1, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_does_not_exist(trigger)
        self.assert_action_handler_called_with_actions(None, [])

        processor = self.send_update(rule, trigger.alert_threshold - 1, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(incident, [self.action])

    def test_reversed_threshold_resolve(self):
        # Test that inverting thresholds correctly resolves
        rule = self.rule
        trigger = self.trigger
        rule.update(threshold_type=AlertRuleThresholdType.BELOW.value)
        trigger.update(alert_threshold=rule.resolve_threshold + 1)

        processor = self.send_update(rule, trigger.alert_threshold - 1, timedelta(minutes=-3))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(incident, [self.action])

        processor = self.send_update(rule, rule.resolve_threshold - 1, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_action_handler_called_with_actions(incident, [])

        processor = self.send_update(rule, rule.resolve_threshold + 1, timedelta(minutes=-1))
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
            rule, rule.resolve_threshold - 1, timedelta(minutes=-7), subscription=self.sub
        )
        self.assert_trigger_counts(processor, self.trigger, 0, 1)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_action_handler_called_with_actions(incident, [])
        other_incident = self.assert_active_incident(rule, self.other_sub)
        self.assert_trigger_exists_with_status(other_incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_action_handler_called_with_actions(other_incident, [])

        processor = self.send_update(
            rule, rule.resolve_threshold - 1, timedelta(minutes=-7), subscription=self.other_sub
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
            rule, rule.resolve_threshold - 1, timedelta(minutes=-6), subscription=self.other_sub
        )
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_no_active_incident(rule, self.other_sub)
        self.assert_trigger_exists_with_status(other_incident, self.trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(other_incident, [self.action], self.other_project)

        # This second update for the first subscription should resolve its incident now.
        processor = self.send_update(
            rule, rule.resolve_threshold - 1, timedelta(minutes=-6), subscription=self.sub
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
        other_trigger = create_alert_rule_trigger(self.rule, "hello", 200)
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

        # Now send through two updates where we're below threshold for the rule. This
        # should resolve all triggers and the incident should be closed.
        processor = self.send_update(
            rule, rule.resolve_threshold - 1, timedelta(minutes=-7), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 1)
        self.assert_trigger_counts(processor, other_trigger, 0, 1)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_exists_with_status(incident, other_trigger, TriggerStatus.ACTIVE)
        self.assert_action_handler_called_with_actions(incident, [])

        processor = self.send_update(
            rule, rule.resolve_threshold - 1, timedelta(minutes=-6), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, other_trigger, 0, 0)
        self.assert_no_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.RESOLVED)
        self.assert_trigger_exists_with_status(incident, other_trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(incident, [self.action, other_action])

    def test_multiple_triggers_at_same_time(self):
        # Check that both triggers fire if an update comes through that exceeds both of
        # their thresholds
        rule = self.rule
        trigger = self.trigger
        other_trigger = create_alert_rule_trigger(self.rule, "hello", 200)
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
            rule, rule.resolve_threshold - 1, timedelta(minutes=-9), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, other_trigger, 0, 0)
        self.assert_no_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.RESOLVED)
        self.assert_trigger_exists_with_status(incident, other_trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(incident, [self.action, other_action])


class TestBuildAlertRuleStatKeys(unittest.TestCase):
    def test(self):
        stat_keys = build_alert_rule_stat_keys(AlertRule(id=1), QuerySubscription(project_id=2))
        assert stat_keys == [
            "{alert_rule:1:project:2}:last_update",
            "{alert_rule:1:project:2}:resolve_triggered",
        ]


class TestBuildTriggerStatKeys(unittest.TestCase):
    def test(self):
        stat_keys = build_trigger_stat_keys(
            AlertRule(id=1),
            QuerySubscription(project_id=2),
            [AlertRuleTrigger(id=3), AlertRuleTrigger(id=4)],
        )
        assert stat_keys == [
            "{alert_rule:1:project:2}:trigger:3:alert_triggered",
            "{alert_rule:1:project:2}:trigger:4:alert_triggered",
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
        timestamp = datetime.now().replace(tzinfo=pytz.utc, microsecond=0)
        pipeline.set("{alert_rule:1:project:2}:last_update", int(to_timestamp(timestamp)))
        pipeline.set("{alert_rule:1:project:2}:resolve_triggered", 20)
        for key, value in [
            ("{alert_rule:1:project:2}:trigger:3:alert_triggered", 1),
            ("{alert_rule:1:project:2}:trigger:4:alert_triggered", 3),
        ]:
            pipeline.set(key, value)
        pipeline.execute()

        last_update, alert_counts, resolve_counts = get_alert_rule_stats(alert_rule, sub, triggers)
        assert last_update == timestamp
        assert alert_counts == {3: 1, 4: 3}
        assert resolve_counts == 20


class TestUpdateAlertRuleStats(TestCase):
    def test(self):
        alert_rule = AlertRule(id=1)
        sub = QuerySubscription(project_id=2)
        date = datetime.utcnow().replace(tzinfo=pytz.utc)
        update_alert_rule_stats(alert_rule, sub, date, {3: 20, 4: 3}, 15)
        client = get_redis_client()
        results = map(
            int,
            client.mget(
                [
                    "{alert_rule:1:project:2}:last_update",
                    "{alert_rule:1:project:2}:trigger:3:alert_triggered",
                    "{alert_rule:1:project:2}:trigger:4:alert_triggered",
                    "{alert_rule:1:project:2}:resolve_triggered",
                ]
            ),
        )

        assert results == [int(to_timestamp(date)), 20, 3, 15]
