import unittest
from datetime import datetime, timedelta, timezone
from functools import cached_property
from random import randint
from unittest import mock
from unittest.mock import Mock, call, patch
from uuid import uuid4

import pytest
from django.utils import timezone as django_timezone

from sentry.incidents.logic import (
    CRITICAL_TRIGGER_LABEL,
    WARNING_TRIGGER_LABEL,
    create_alert_rule_trigger,
    create_alert_rule_trigger_action,
    update_alert_rule,
)
from sentry.incidents.models import (
    AlertRule,
    AlertRuleThresholdType,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
    Incident,
    IncidentActivity,
    IncidentStatus,
    IncidentTrigger,
    IncidentType,
    TriggerStatus,
)
from sentry.incidents.subscription_processor import (
    SubscriptionProcessor,
    build_alert_rule_stat_keys,
    build_alert_rule_trigger_stat_key,
    build_trigger_stat_keys,
    get_alert_rule_stats,
    get_redis_client,
    partition,
    update_alert_rule_stats,
)
from sentry.models.integrations.integration import Integration
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.indexer.postgres.models import MetricsKeyIndexer
from sentry.sentry_metrics.utils import resolve_tag_key, resolve_tag_value
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription, SnubaQueryEventType
from sentry.testutils.cases import BaseMetricsTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time, iso_format
from sentry.utils import json
from sentry.utils.dates import to_timestamp

EMPTY = object()


pytestmark = [pytest.mark.sentry_metrics]


@freeze_time()
class ProcessUpdateBaseClass(TestCase, SnubaTestCase):
    @pytest.fixture(autouse=True)
    def _setup_metrics_patch(self):
        with mock.patch("sentry.incidents.subscription_processor.metrics") as self.metrics:
            yield

    def setUp(self):
        super().setUp()
        self.old_handlers = AlertRuleTriggerAction._type_registrations
        AlertRuleTriggerAction._type_registrations = {}
        self.email_action_handler = Mock()
        AlertRuleTriggerAction.register_type("email", AlertRuleTriggerAction.Type.EMAIL, [])(
            self.email_action_handler
        )
        self._run_tasks = self.tasks()
        self._run_tasks.__enter__()

    def tearDown(self):
        super().tearDown()
        AlertRuleTriggerAction._type_registrations = self.old_handlers
        self._run_tasks.__exit__(None, None, None)

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
                assert (
                    not self.email_action_handler.called
                ), self.email_action_handler.call_args_list
            else:
                for call_args in self.email_action_handler.call_args_list:
                    assert call_args[0][1] != incident
        else:
            assert self.email_action_handler.call_args_list == [
                call(action, incident, project) for action in actions
            ]

    def assert_actions_fired_for_incident(self, incident, actions, fire_args, project=None):
        actions = [] if actions is None else actions
        project = self.project if project is None else project
        self.assert_action_handler_called_with_actions(incident, actions, project)
        assert len(actions) == len(self.email_action_handler.return_value.fire.call_args_list)
        if fire_args:
            assert [
                call(*args) for args in fire_args
            ] == self.email_action_handler.return_value.fire.call_args_list

    def assert_actions_resolved_for_incident(self, incident, actions, resolve_args, project=None):
        project = self.project if project is None else project
        actions = [] if actions is None else actions
        self.assert_action_handler_called_with_actions(incident, actions, project)
        assert len(actions) == len(self.email_action_handler.return_value.resolve.call_args_list)
        if resolve_args:
            assert [
                call(*args) for args in resolve_args
            ] == self.email_action_handler.return_value.resolve.call_args_list

    def assert_no_active_incident(self, rule, subscription=None):
        assert not self.active_incident_exists(rule, subscription=subscription)

    def assert_active_incident(self, rule, subscription=None):
        incidents = self.active_incident_exists(rule, subscription=subscription)
        assert incidents
        return incidents[0]

    @property
    def sub(self):
        raise NotImplementedError

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
        alert_stats, resolve_stats = get_alert_rule_stats(
            processor.alert_rule, processor.subscription, [trigger]
        )[1:]
        assert alert_stats[trigger.id] == alert_triggers
        assert resolve_stats[trigger.id] == resolve_triggers

    def latest_activity(self, incident):
        return IncidentActivity.objects.filter(incident=incident).order_by("-id").first()

    def assert_incident_is_latest_for_rule(self, incident):
        last_incident = (
            Incident.objects.filter(alert_rule=incident.alert_rule).order_by("-date_added").first()
        )
        assert last_incident == incident


@freeze_time()
class ProcessUpdateTest(ProcessUpdateBaseClass):
    @pytest.fixture(autouse=True)
    def _setup_slack_client(self):
        with mock.patch("sentry.integrations.slack.SlackClient.post") as self.slack_client:
            yield

    @cached_property
    def other_project(self):
        return self.create_project()

    @cached_property
    def sub(self):
        return self.rule.snuba_query.subscriptions.filter(project=self.project).get()

    @cached_property
    def other_sub(self):
        return self.rule.snuba_query.subscriptions.filter(project=self.other_project).get()

    @cached_property
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
            event_types=[
                SnubaQueryEventType.EventType.ERROR,
                SnubaQueryEventType.EventType.DEFAULT,
            ],
        )
        # Make sure the trigger exists
        trigger = create_alert_rule_trigger(rule, CRITICAL_TRIGGER_LABEL, 100)
        create_alert_rule_trigger_action(
            trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.USER,
            str(self.user.id),
        )
        return rule

    @cached_property
    def comparison_rule_above(self):
        rule = self.rule
        rule.update(comparison_delta=60 * 60, resolve_threshold=None)
        rule.snuba_query.update(time_window=60 * 60)
        self.trigger.update(alert_threshold=150)
        return rule

    @cached_property
    def comparison_rule_below(self):
        rule = self.rule
        rule.update(
            comparison_delta=60,
            threshold_type=AlertRuleThresholdType.BELOW.value,
            resolve_threshold=None,
        )
        rule.snuba_query.update(time_window=60 * 60)
        self.trigger.update(alert_threshold=50)
        return rule

    @cached_property
    def trigger(self):
        return self.rule.alertruletrigger_set.get()

    @cached_property
    def action(self):
        return self.trigger.alertruletriggeraction_set.get()

    def build_subscription_update(self, subscription, time_delta=None, value=EMPTY):
        if time_delta is not None:
            timestamp = django_timezone.now() + time_delta
        else:
            timestamp = django_timezone.now()
        timestamp = timestamp.replace(tzinfo=timezone.utc, microsecond=0)

        data = {}

        if subscription:
            data = {"some_col_name": randint(0, 100) if value is EMPTY else value}
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
        with self.feature(
            ["organizations:incidents", "organizations:performance-view"]
        ), self.capture_on_commit_callbacks(execute=True):
            processor.process_update(message)
        return processor

    def assert_slack_calls(self, trigger_labels):
        expected_result = [f"{label}: some rule 2" for label in trigger_labels]
        actual = [
            (call_kwargs["data"]["text"], json.loads(call_kwargs["data"]["attachments"]))
            for (_, call_kwargs) in self.slack_client.call_args_list
        ]

        assert len(expected_result) == len(actual)
        for expected, (text, attachments) in zip(expected_result, actual):
            assert expected in text
            assert len(attachments) > 0
        self.slack_client.reset_mock()

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
        assert self.metrics.incr.call_count == 0

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
            django_timezone.now().replace(microsecond=0)
            - timedelta(seconds=rule.snuba_query.time_window)
        )
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        latest_activity = self.latest_activity(incident)
        uuid = str(latest_activity.notification_uuid)
        self.assert_actions_fired_for_incident(
            incident,
            [self.action],
            [(trigger.alert_threshold + 1, IncidentStatus.CRITICAL, uuid)],
        )

    def test_alert_dedupe(self):
        # Verify that an alert rule that only expects a single update to be over the
        # alert threshold triggers correctly
        rule = self.rule
        c_trigger = self.trigger
        create_alert_rule_trigger_action(
            self.trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.USER,
            str(self.user.id),
        )
        w_trigger = create_alert_rule_trigger(
            self.rule, WARNING_TRIGGER_LABEL, c_trigger.alert_threshold - 10
        )
        w_action = create_alert_rule_trigger_action(
            w_trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.USER,
            str(self.user.id),
        )

        processor = self.send_update(rule, c_trigger.alert_threshold + 1)
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        assert incident.date_started == (
            django_timezone.now().replace(microsecond=0)
            - timedelta(seconds=rule.snuba_query.time_window)
        )
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident,
            [w_action],
            [(c_trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY)],
        )

    def test_alert_nullable(self):
        # Verify that an alert rule that only expects a single update to be over the
        # alert threshold triggers correctly
        rule = self.rule
        self.trigger
        processor = self.send_update(rule, None)
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        self.assert_no_active_incident(rule)

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
        self.assert_actions_fired_for_incident(
            incident,
            [self.action],
            [(trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY)],
        )

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
        self.assert_actions_fired_for_incident(
            incident,
            [self.action],
            [(trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY)],
        )

        processor = self.send_update(rule, rule.resolve_threshold - 1, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident, [self.action], [(rule.resolve_threshold - 1, IncidentStatus.CLOSED, mock.ANY)]
        )

    def test_resolve_multiple_threshold_periods(self):
        # Verify that a rule that expects two consecutive updates to be under the
        # resolve threshold triggers correctly
        rule = self.rule
        trigger = self.trigger

        processor = self.send_update(rule, trigger.alert_threshold + 1, timedelta(minutes=-3))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident,
            [self.action],
            [(trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY)],
        )

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
        self.assert_actions_resolved_for_incident(
            incident, [self.action], [(rule.resolve_threshold - 1, IncidentStatus.CLOSED, mock.ANY)]
        )

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
        self.assert_actions_fired_for_incident(
            incident,
            [self.action],
            [(trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY)],
        )

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
        self.assert_actions_fired_for_incident(
            incident,
            [self.action],
            [(trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY)],
        )

        processor = self.send_update(rule, trigger.alert_threshold - 1, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident,
            [self.action],
            [(trigger.alert_threshold - 1, IncidentStatus.CLOSED, mock.ANY)],
        )

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
        self.assert_actions_fired_for_incident(
            incident,
            [self.action],
            [(trigger.alert_threshold + 0.1, IncidentStatus.CRITICAL, mock.ANY)],
        )

        processor = self.send_update(rule, trigger.alert_threshold, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident, [self.action], [(trigger.alert_threshold, IncidentStatus.CLOSED, mock.ANY)]
        )

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
        self.assert_actions_fired_for_incident(
            incident,
            [self.action],
            [(trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY)],
        )

        processor = self.send_update(rule, trigger.alert_threshold, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident, [self.action], [(trigger.alert_threshold, IncidentStatus.CLOSED, mock.ANY)]
        )

    def test_auto_resolve_reversed(self):
        # Test auto resolving works correctly when threshold is reversed
        rule = self.rule
        rule.update(resolve_threshold=None, threshold_type=AlertRuleThresholdType.BELOW.value)
        trigger = self.trigger
        processor = self.send_update(rule, trigger.alert_threshold - 1, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident,
            [self.action],
            [(trigger.alert_threshold - 1, IncidentStatus.CRITICAL, mock.ANY)],
        )

        processor = self.send_update(rule, trigger.alert_threshold + 1, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident,
            [self.action],
            [(trigger.alert_threshold + 1, IncidentStatus.CLOSED, mock.ANY)],
        )

    def test_auto_resolve_multiple_trigger(self):
        # Test auto resolving works correctly when multiple triggers are present.
        rule = self.rule
        rule.update(resolve_threshold=None)
        trigger = self.trigger
        other_trigger = create_alert_rule_trigger(
            self.rule, WARNING_TRIGGER_LABEL, trigger.alert_threshold - 10
        )
        other_action = create_alert_rule_trigger_action(
            other_trigger, AlertRuleTriggerAction.Type.EMAIL, AlertRuleTriggerAction.TargetType.USER
        )
        processor = self.send_update(rule, trigger.alert_threshold + 1, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_exists_with_status(incident, other_trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident,
            [other_action, self.action],
            [
                (trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY),
                (trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY),
            ],
        )

        processor = self.send_update(rule, other_trigger.alert_threshold - 1, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.RESOLVED)
        self.assert_trigger_exists_with_status(incident, other_trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident,
            [other_action, self.action],
            [
                (other_trigger.alert_threshold - 1, IncidentStatus.CLOSED, mock.ANY),
                (other_trigger.alert_threshold - 1, IncidentStatus.CLOSED, mock.ANY),
            ],
        )

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
        self.assert_actions_fired_for_incident(
            incident,
            [self.action],
            [(trigger.alert_threshold - 1, IncidentStatus.CRITICAL, mock.ANY)],
        )

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
        self.assert_actions_fired_for_incident(
            incident,
            [self.action],
            [(trigger.alert_threshold - 1, IncidentStatus.CRITICAL, mock.ANY)],
        )

        processor = self.send_update(rule, rule.resolve_threshold - 1, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_action_handler_called_with_actions(incident, [])

        processor = self.send_update(rule, rule.resolve_threshold + 1, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident, [self.action], [(rule.resolve_threshold + 1, IncidentStatus.CLOSED, mock.ANY)]
        )

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
        self.assert_actions_fired_for_incident(
            incident,
            [self.action],
            [(trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY)],
        )
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
        self.assert_actions_fired_for_incident(
            other_incident,
            [self.action],
            [(trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY)],
            self.other_project,
        )

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
        self.assert_actions_resolved_for_incident(
            other_incident,
            [self.action],
            [(rule.resolve_threshold - 1, IncidentStatus.CLOSED, mock.ANY)],
            self.other_project,
        )

        # This second update for the first subscription should resolve its incident now.
        processor = self.send_update(
            rule, rule.resolve_threshold - 1, timedelta(minutes=-6), subscription=self.sub
        )
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        self.assert_no_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident, [self.action], [(rule.resolve_threshold - 1, IncidentStatus.CLOSED, mock.ANY)]
        )
        self.assert_no_active_incident(rule, self.other_sub)
        self.assert_trigger_exists_with_status(other_incident, self.trigger, TriggerStatus.RESOLVED)
        self.assert_action_handler_called_with_actions(other_incident, [])

    def test_multiple_triggers(self):
        rule = self.rule
        rule.update(threshold_period=1)
        trigger = self.trigger
        warning_trigger = create_alert_rule_trigger(
            self.rule, WARNING_TRIGGER_LABEL, trigger.alert_threshold - 20
        )
        warning_action = create_alert_rule_trigger_action(
            warning_trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.USER,
            str(self.user.id),
        )
        processor = self.send_update(
            rule, warning_trigger.alert_threshold + 1, timedelta(minutes=-10), subscription=self.sub
        )
        self.assert_trigger_counts(processor, warning_trigger, 0, 0)
        self.assert_trigger_counts(processor, trigger, 0, 0)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_does_not_exist(trigger)
        self.assert_actions_fired_for_incident(
            incident,
            [warning_action],
            [(warning_trigger.alert_threshold + 1, IncidentStatus.WARNING, mock.ANY)],
        )

        processor = self.send_update(
            rule, trigger.alert_threshold + 1, timedelta(minutes=-9), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, warning_trigger, 0, 0)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident,
            [warning_action],
            [(trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY)],
        )

        processor = self.send_update(
            rule, trigger.alert_threshold - 1, timedelta(minutes=-7), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, warning_trigger, 0, 0)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.RESOLVED)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.ACTIVE)
        self.assert_actions_resolved_for_incident(
            incident,
            [warning_action],
            [(trigger.alert_threshold - 1, IncidentStatus.WARNING, mock.ANY)],
        )

        processor = self.send_update(
            rule, rule.resolve_threshold - 1, timedelta(minutes=-6), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, warning_trigger, 0, 0)
        self.assert_no_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.RESOLVED)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident,
            [warning_action],
            [(rule.resolve_threshold - 1, IncidentStatus.CLOSED, mock.ANY)],
        )

    def test_multiple_triggers_no_warning_action(self):
        rule = self.rule
        rule.update(threshold_period=1)
        trigger = self.trigger
        warning_trigger = create_alert_rule_trigger(
            self.rule, WARNING_TRIGGER_LABEL, trigger.alert_threshold - 20
        )
        processor = self.send_update(
            rule, warning_trigger.alert_threshold + 1, timedelta(minutes=-10), subscription=self.sub
        )
        self.assert_trigger_counts(processor, warning_trigger, 0, 0)
        self.assert_trigger_counts(processor, trigger, 0, 0)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_does_not_exist(trigger)
        self.assert_action_handler_called_with_actions(None, [])

        processor = self.send_update(
            rule, trigger.alert_threshold + 1, timedelta(minutes=-9), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, warning_trigger, 0, 0)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident,
            [self.action],
            [(trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY)],
        )

        processor = self.send_update(
            rule, trigger.alert_threshold - 1, timedelta(minutes=-7), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, warning_trigger, 0, 0)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.RESOLVED)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.ACTIVE)
        self.assert_actions_resolved_for_incident(
            incident,
            [self.action],
            [(trigger.alert_threshold - 1, IncidentStatus.WARNING, mock.ANY)],
        )

        processor = self.send_update(
            rule, rule.resolve_threshold - 1, timedelta(minutes=-6), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, warning_trigger, 0, 0)
        self.assert_no_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.RESOLVED)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident, [self.action], [(rule.resolve_threshold - 1, IncidentStatus.CLOSED, mock.ANY)]
        )

    def test_multiple_triggers_threshold_period(self):
        rule = self.rule
        rule.update(threshold_period=2)
        trigger = self.trigger
        other_trigger = create_alert_rule_trigger(
            self.rule, WARNING_TRIGGER_LABEL, trigger.alert_threshold - 20
        )
        other_action = create_alert_rule_trigger_action(
            other_trigger, AlertRuleTriggerAction.Type.EMAIL, AlertRuleTriggerAction.TargetType.USER
        )
        processor = self.send_update(
            rule, other_trigger.alert_threshold + 1, timedelta(minutes=-10), subscription=self.sub
        )
        self.assert_trigger_counts(processor, other_trigger, 1, 0)
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_no_active_incident(rule, self.sub)
        self.assert_trigger_does_not_exist(trigger)
        self.assert_trigger_does_not_exist(other_trigger)
        self.assert_action_handler_called_with_actions(None, [])

        # This should cause both to increment, although only `other_trigger` should fire.
        processor = self.send_update(
            rule, trigger.alert_threshold + 1, timedelta(minutes=-9), subscription=self.sub
        )
        self.assert_trigger_counts(processor, other_trigger, 0, 0)
        self.assert_trigger_counts(processor, trigger, 1, 0)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_does_not_exist(trigger)
        self.assert_trigger_exists_with_status(incident, other_trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident,
            [other_action],
            [(trigger.alert_threshold + 1, IncidentStatus.WARNING, mock.ANY)],
        )

        # Now only `trigger` should increment and fire.
        processor = self.send_update(
            rule, trigger.alert_threshold + 1, timedelta(minutes=-8), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, other_trigger, 0, 0)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_exists_with_status(incident, other_trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident,
            [other_action, self.action],
            [
                (trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY),
                (trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY),
            ],
        )

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
        self.assert_actions_resolved_for_incident(
            incident,
            [other_action, self.action],
            [
                (rule.resolve_threshold - 1, IncidentStatus.CLOSED, mock.ANY),
                (rule.resolve_threshold - 1, IncidentStatus.CLOSED, mock.ANY),
            ],
        )

    def setup_for_distinct_actions_test(self):
        """Helper function to do the setup for the following multiple trigger + distinct action tests"""
        rule = self.rule
        rule.update(resolve_threshold=None)
        critical_trigger = self.trigger
        warning_trigger = create_alert_rule_trigger(
            self.rule, WARNING_TRIGGER_LABEL, critical_trigger.alert_threshold - 20
        )
        critical_action = self.action
        warning_action = create_alert_rule_trigger_action(
            warning_trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.USER,
            # "warning" prefix differentiates this action from the critical action, so it
            # doesn't get deduplicated
            "warning" + str(self.user.id),
        )
        return (
            critical_trigger,
            warning_trigger,
            critical_action,
            warning_action,
        )

    def test_distinct_actions_warning_to_resolved(self):
        """Tests distinct action behavior when alert status goes from Warning -> Resolved"""
        rule = self.rule
        (
            critical_trigger,
            warning_trigger,
            critical_action,
            warning_action,
        ) = self.setup_for_distinct_actions_test()
        self.send_update(
            rule, warning_trigger.alert_threshold + 1, timedelta(minutes=-10), subscription=self.sub
        )
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_does_not_exist(critical_trigger)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident,
            [warning_action],
            [
                (warning_trigger.alert_threshold + 1, IncidentStatus.WARNING, mock.ANY),
            ],
        )

        self.send_update(
            rule, warning_trigger.alert_threshold - 1, timedelta(minutes=-5), subscription=self.sub
        )
        self.assert_no_active_incident(rule)
        self.assert_trigger_does_not_exist_for_incident(incident, critical_trigger)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident,
            [warning_action],
            [
                (warning_trigger.alert_threshold - 1, IncidentStatus.CLOSED, mock.ANY),
            ],
        )

    def test_distinct_actions_critical_to_resolved(self):
        """Tests distinct action behavior when alert status goes from Critical -> Resolved"""
        rule = self.rule
        (
            critical_trigger,
            warning_trigger,
            critical_action,
            warning_action,
        ) = self.setup_for_distinct_actions_test()
        self.send_update(
            rule,
            critical_trigger.alert_threshold + 1,
            timedelta(minutes=-10),
            subscription=self.sub,
        )
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, critical_trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident,
            [warning_action, critical_action],
            [
                (critical_trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY),
                (critical_trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY),
            ],
        )

        self.send_update(
            rule, warning_trigger.alert_threshold - 1, timedelta(minutes=-5), subscription=self.sub
        )
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, critical_trigger, TriggerStatus.RESOLVED)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident,
            [warning_action, critical_action],
            [
                (warning_trigger.alert_threshold - 1, IncidentStatus.CLOSED, mock.ANY),
                (warning_trigger.alert_threshold - 1, IncidentStatus.CLOSED, mock.ANY),
            ],
        )

    def test_distinct_actions_warning_to_critical_to_resolved(self):
        """Tests distinct action behavior when alert status goes from Warning -> Critical -> Resolved"""
        rule = self.rule
        (
            critical_trigger,
            warning_trigger,
            critical_action,
            warning_action,
        ) = self.setup_for_distinct_actions_test()
        self.send_update(
            rule, warning_trigger.alert_threshold + 1, timedelta(minutes=-15), subscription=self.sub
        )
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_does_not_exist_for_incident(incident, critical_trigger)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident,
            [warning_action],
            [
                (warning_trigger.alert_threshold + 1, IncidentStatus.WARNING, mock.ANY),
            ],
        )

        self.send_update(
            rule,
            critical_trigger.alert_threshold + 1,
            timedelta(minutes=-10),
            subscription=self.sub,
        )
        self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, critical_trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident,
            [warning_action, critical_action],
            [
                (critical_trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY),
                (critical_trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY),
            ],
        )

        self.send_update(
            rule, warning_trigger.alert_threshold - 1, timedelta(minutes=-5), subscription=self.sub
        )
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, critical_trigger, TriggerStatus.RESOLVED)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident,
            [warning_action, critical_action],
            [
                (warning_trigger.alert_threshold - 1, IncidentStatus.CLOSED, mock.ANY),
                (warning_trigger.alert_threshold - 1, IncidentStatus.CLOSED, mock.ANY),
            ],
        )

    def test_distinct_actions_critical_to_warning_to_resolved(self):
        """Tests distinct action behavior when alert status goes from Critical -> Warning -> Resolved"""
        rule = self.rule
        (
            critical_trigger,
            warning_trigger,
            critical_action,
            warning_action,
        ) = self.setup_for_distinct_actions_test()
        self.send_update(
            rule,
            critical_trigger.alert_threshold + 1,
            timedelta(minutes=-15),
            subscription=self.sub,
        )
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, critical_trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident,
            [warning_action, critical_action],
            [
                (critical_trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY),
                (critical_trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY),
            ],
        )

        self.send_update(
            rule,
            critical_trigger.alert_threshold - 1,
            timedelta(minutes=-10),
            subscription=self.sub,
        )
        self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, critical_trigger, TriggerStatus.RESOLVED)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.ACTIVE)
        self.assert_actions_resolved_for_incident(
            incident,
            [warning_action, critical_action],
            [
                (critical_trigger.alert_threshold - 1, IncidentStatus.WARNING, mock.ANY),
                (critical_trigger.alert_threshold - 1, IncidentStatus.WARNING, mock.ANY),
            ],
        )

        self.send_update(
            rule, warning_trigger.alert_threshold - 1, timedelta(minutes=-5), subscription=self.sub
        )
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, critical_trigger, TriggerStatus.RESOLVED)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident,
            [warning_action, critical_action],
            [
                (warning_trigger.alert_threshold - 1, IncidentStatus.CLOSED, mock.ANY),
                (warning_trigger.alert_threshold - 1, IncidentStatus.CLOSED, mock.ANY),
            ],
        )

    def setup_for_duplicate_actions_test(self):
        """Helper function to do the setup for the following multiple trigger + duplicate action tests"""
        rule = self.rule
        rule.update(resolve_threshold=None)
        critical_trigger = self.trigger
        warning_trigger = create_alert_rule_trigger(
            self.rule, WARNING_TRIGGER_LABEL, critical_trigger.alert_threshold - 20
        )
        critical_action = self.action
        warning_action = create_alert_rule_trigger_action(
            warning_trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.USER,
            # same as critical action, so the critical should get deduplicated
            str(self.user.id),
        )
        return (
            critical_trigger,
            warning_trigger,
            critical_action,
            warning_action,
        )

    def test_duplicate_actions_warning_to_resolved(self):
        """Tests duplicate action behavior when alert status goes from Warning -> Resolved"""
        rule = self.rule
        (
            critical_trigger,
            warning_trigger,
            critical_action,
            warning_action,
        ) = self.setup_for_duplicate_actions_test()
        self.send_update(
            rule, warning_trigger.alert_threshold + 1, timedelta(minutes=-10), subscription=self.sub
        )
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_does_not_exist(critical_trigger)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident,
            [warning_action],
            [
                (warning_trigger.alert_threshold + 1, IncidentStatus.WARNING, mock.ANY),
            ],
        )

        self.send_update(
            rule, warning_trigger.alert_threshold - 1, timedelta(minutes=-5), subscription=self.sub
        )
        self.assert_no_active_incident(rule)
        self.assert_trigger_does_not_exist_for_incident(incident, critical_trigger)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident,
            [warning_action],
            [
                (warning_trigger.alert_threshold - 1, IncidentStatus.CLOSED, mock.ANY),
            ],
        )

    def test_duplicate_actions_critical_to_resolved(self):
        """Tests duplicate action behavior when alert status goes from Critical -> Resolved"""
        rule = self.rule
        (
            critical_trigger,
            warning_trigger,
            critical_action,
            warning_action,
        ) = self.setup_for_duplicate_actions_test()
        self.send_update(
            rule,
            critical_trigger.alert_threshold + 1,
            timedelta(minutes=-10),
            subscription=self.sub,
        )
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, critical_trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident,
            [warning_action],
            [
                (critical_trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY),
            ],
        )

        self.send_update(
            rule, warning_trigger.alert_threshold - 1, timedelta(minutes=-5), subscription=self.sub
        )
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, critical_trigger, TriggerStatus.RESOLVED)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident,
            [warning_action],
            [
                (warning_trigger.alert_threshold - 1, IncidentStatus.CLOSED, mock.ANY),
            ],
        )

    def test_duplicate_actions_warning_to_critical_to_resolved(self):
        """Tests duplicate action behavior when alert status goes from Warning -> Critical -> Resolved"""
        rule = self.rule
        (
            critical_trigger,
            warning_trigger,
            critical_action,
            warning_action,
        ) = self.setup_for_duplicate_actions_test()
        self.send_update(
            rule, warning_trigger.alert_threshold + 1, timedelta(minutes=-15), subscription=self.sub
        )
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_does_not_exist_for_incident(incident, critical_trigger)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident,
            [warning_action],
            [
                (warning_trigger.alert_threshold + 1, IncidentStatus.WARNING, mock.ANY),
            ],
        )

        self.send_update(
            rule,
            critical_trigger.alert_threshold + 1,
            timedelta(minutes=-10),
            subscription=self.sub,
        )
        self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, critical_trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident,
            [warning_action],
            [
                (critical_trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY),
            ],
        )

        self.send_update(
            rule, warning_trigger.alert_threshold - 1, timedelta(minutes=-5), subscription=self.sub
        )
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, critical_trigger, TriggerStatus.RESOLVED)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident,
            [warning_action],
            [
                (warning_trigger.alert_threshold - 1, IncidentStatus.CLOSED, mock.ANY),
            ],
        )

    def test_duplicate_actions_critical_to_warning_to_resolved(self):
        """Tests duplicate action behavior when alert status goes from Critical -> Warning -> Resolved"""
        rule = self.rule
        (
            critical_trigger,
            warning_trigger,
            critical_action,
            warning_action,
        ) = self.setup_for_duplicate_actions_test()
        self.send_update(
            rule,
            critical_trigger.alert_threshold + 1,
            timedelta(minutes=-15),
            subscription=self.sub,
        )
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, critical_trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident,
            [warning_action],
            [
                (critical_trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY),
            ],
        )

        self.send_update(
            rule,
            critical_trigger.alert_threshold - 1,
            timedelta(minutes=-10),
            subscription=self.sub,
        )
        self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, critical_trigger, TriggerStatus.RESOLVED)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.ACTIVE)
        self.assert_actions_resolved_for_incident(
            incident,
            [warning_action],
            [
                (critical_trigger.alert_threshold - 1, IncidentStatus.WARNING, mock.ANY),
            ],
        )

        self.send_update(
            rule, warning_trigger.alert_threshold - 1, timedelta(minutes=-5), subscription=self.sub
        )
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, critical_trigger, TriggerStatus.RESOLVED)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident,
            [warning_action],
            [
                (warning_trigger.alert_threshold - 1, IncidentStatus.CLOSED, mock.ANY),
            ],
        )

    def test_slack_multiple_triggers_critical_before_warning(self):
        """
        Test that ensures that when we get a critical update is sent followed by a warning update,
        the warning update is not swallowed and an alert is triggered as a warning alert granted
        the count is above the warning trigger threshold
        """
        from sentry.incidents.action_handlers import SlackActionHandler

        slack_handler = SlackActionHandler

        # Create Slack Integration
        integration = Integration.objects.create(
            provider="slack",
            name="Team A",
            external_id="TXXXXXXX1",
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        integration.add_organization(self.project.organization, self.user)

        # Register Slack Handler
        AlertRuleTriggerAction.register_type(
            "slack",
            AlertRuleTriggerAction.Type.SLACK,
            [AlertRuleTriggerAction.TargetType.SPECIFIC],
            integration_provider="slack",
        )(slack_handler)

        rule = self.create_alert_rule(
            projects=[self.project, self.other_project],
            name="some rule 2",
            query="",
            aggregate="count()",
            time_window=1,
            threshold_type=AlertRuleThresholdType.ABOVE,
            resolve_threshold=10,
            threshold_period=1,
        )

        trigger = create_alert_rule_trigger(rule, "critical", 100)
        trigger_warning = create_alert_rule_trigger(rule, "warning", 10)

        for t in [trigger, trigger_warning]:
            create_alert_rule_trigger_action(
                t,
                AlertRuleTriggerAction.Type.SLACK,
                AlertRuleTriggerAction.TargetType.SPECIFIC,
                integration_id=integration.id,
                input_channel_id="#workflow",
            )

        # Send Critical Update
        self.send_update(
            rule,
            trigger.alert_threshold + 5,
            timedelta(minutes=-10),
            subscription=rule.snuba_query.subscriptions.filter(project=self.project).get(),
        )
        self.assert_slack_calls(["Critical"])

        # Send Warning Update
        self.send_update(
            rule,
            trigger_warning.alert_threshold + 5,
            timedelta(minutes=0),
            subscription=rule.snuba_query.subscriptions.filter(project=self.project).get(),
        )
        self.assert_slack_calls(["Warning"])
        self.assert_active_incident(rule)

    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_slack_metric_alert_chart(self, mock_generate_chart):
        from sentry.incidents.action_handlers import SlackActionHandler

        slack_handler = SlackActionHandler

        # Create Slack Integration
        integration = Integration.objects.create(
            provider="slack",
            name="Team A",
            external_id="TXXXXXXX1",
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        integration.add_organization(self.project.organization, self.user)

        # Register Slack Handler
        AlertRuleTriggerAction.register_type(
            "slack",
            AlertRuleTriggerAction.Type.SLACK,
            [AlertRuleTriggerAction.TargetType.SPECIFIC],
            integration_provider="slack",
        )(slack_handler)

        rule = self.create_alert_rule(
            projects=[self.project, self.other_project],
            name="some rule 2",
            query="",
            aggregate="count()",
            time_window=1,
            threshold_type=AlertRuleThresholdType.ABOVE,
            resolve_threshold=10,
            threshold_period=1,
        )

        trigger = create_alert_rule_trigger(rule, "critical", 100)
        channel_name = "#workflow"
        create_alert_rule_trigger_action(
            trigger,
            AlertRuleTriggerAction.Type.SLACK,
            AlertRuleTriggerAction.TargetType.SPECIFIC,
            integration_id=integration.id,
            input_channel_id=channel_name,
            target_identifier=channel_name,
        )

        # Send Critical Update
        with self.feature(
            [
                "organizations:incidents",
                "organizations:discover",
                "organizations:discover-basic",
                "organizations:metric-alert-chartcuterie",
            ]
        ):
            self.send_update(
                rule,
                trigger.alert_threshold + 5,
                timedelta(minutes=-10),
                subscription=rule.snuba_query.subscriptions.filter(project=self.project).get(),
            )

        self.assert_slack_calls(["Critical"])
        incident = self.assert_active_incident(rule)

        assert len(mock_generate_chart.mock_calls) == 1
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["rule"]["id"] == str(rule.id)
        assert chart_data["selectedIncident"]["identifier"] == str(incident.identifier)
        series_data = chart_data["timeseriesData"][0]["data"]
        assert len(series_data) > 0

    def test_slack_multiple_triggers_critical_fired_twice_before_warning(self):
        """
        Test that ensures that when we get a critical update is sent followed by a warning update,
        the warning update is not swallowed and an alert is triggered as a warning alert granted
        the count is above the warning trigger threshold
        """
        from sentry.incidents.action_handlers import SlackActionHandler

        slack_handler = SlackActionHandler

        # Create Slack Integration
        integration = Integration.objects.create(
            provider="slack",
            name="Team A",
            external_id="TXXXXXXX1",
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        integration.add_organization(self.project.organization, self.user)

        # Register Slack Handler
        AlertRuleTriggerAction.register_type(
            "slack",
            AlertRuleTriggerAction.Type.SLACK,
            [AlertRuleTriggerAction.TargetType.SPECIFIC],
            integration_provider="slack",
        )(slack_handler)

        rule = self.create_alert_rule(
            projects=[self.project, self.other_project],
            name="some rule 2",
            query="",
            aggregate="count()",
            time_window=1,
            threshold_type=AlertRuleThresholdType.ABOVE,
            resolve_threshold=10,
            threshold_period=1,
        )

        trigger = create_alert_rule_trigger(rule, "critical", 100)
        trigger_warning = create_alert_rule_trigger(rule, "warning", 10)

        for t in [trigger, trigger_warning]:
            create_alert_rule_trigger_action(
                t,
                AlertRuleTriggerAction.Type.SLACK,
                AlertRuleTriggerAction.TargetType.SPECIFIC,
                integration_id=integration.id,
                input_channel_id="#workflow",
            )

        self.assert_slack_calls([])

        # Send update above critical
        self.send_update(
            rule,
            trigger.alert_threshold + 5,
            timedelta(minutes=-10),
            subscription=rule.snuba_query.subscriptions.filter(project=self.project).get(),
        )

        self.assert_slack_calls(["Critical"])

        # Send second update above critical
        self.send_update(
            rule,
            trigger.alert_threshold + 6,
            timedelta(minutes=-9),
            subscription=rule.snuba_query.subscriptions.filter(project=self.project).get(),
        )
        self.assert_slack_calls([])

        # Send update below critical but above warning
        self.send_update(
            rule,
            trigger_warning.alert_threshold + 5,
            timedelta(minutes=0),
            subscription=rule.snuba_query.subscriptions.filter(project=self.project).get(),
        )
        self.assert_active_incident(rule)
        self.assert_slack_calls(["Warning"])

    def test_multiple_triggers_at_same_time(self):
        # Check that both triggers fire if an update comes through that exceeds both of
        # their thresholds
        rule = self.rule
        trigger = self.trigger
        other_trigger = create_alert_rule_trigger(
            self.rule, WARNING_TRIGGER_LABEL, trigger.alert_threshold - 20
        )
        other_action = create_alert_rule_trigger_action(
            other_trigger, AlertRuleTriggerAction.Type.EMAIL, AlertRuleTriggerAction.TargetType.USER
        )

        processor = self.send_update(
            rule, trigger.alert_threshold + 1, timedelta(minutes=-10), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, other_trigger, 0, 0)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_exists_with_status(incident, other_trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident,
            [
                other_action,
                self.action,
            ],
            [
                (trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY),
                (trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY),
            ],
        )

        processor = self.send_update(
            rule, rule.resolve_threshold - 1, timedelta(minutes=-9), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, other_trigger, 0, 0)
        self.assert_no_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.RESOLVED)
        self.assert_trigger_exists_with_status(incident, other_trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident,
            [other_action, self.action],
            [
                (rule.resolve_threshold - 1, IncidentStatus.CLOSED, mock.ANY),
                (rule.resolve_threshold - 1, IncidentStatus.CLOSED, mock.ANY),
            ],
        )

    def test_multiple_triggers_with_identical_actions_at_same_time(self):
        # Check that both triggers fire if an update comes through that exceeds both of
        # their thresholds
        rule = self.rule
        trigger = self.trigger
        other_trigger = create_alert_rule_trigger(
            self.rule, WARNING_TRIGGER_LABEL, trigger.alert_threshold - 20
        )
        other_action = create_alert_rule_trigger_action(
            other_trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.USER,
            str(self.user.id),
        )

        processor = self.send_update(
            rule, trigger.alert_threshold + 1, timedelta(minutes=-10), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, other_trigger, 0, 0)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_exists_with_status(incident, other_trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident,
            [
                other_action,
            ],
            [
                (trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY),
            ],
        )

        processor = self.send_update(
            rule, rule.resolve_threshold - 1, timedelta(minutes=-9), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, other_trigger, 0, 0)
        self.assert_no_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.RESOLVED)
        self.assert_trigger_exists_with_status(incident, other_trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident,
            [other_action],
            [
                (rule.resolve_threshold - 1, IncidentStatus.CLOSED, mock.ANY),
            ],
        )

    def test_multiple_triggers_resolve_separately(self):
        # Check that resolve triggers fire separately
        rule = self.rule
        trigger = self.trigger
        other_trigger = create_alert_rule_trigger(
            self.rule, WARNING_TRIGGER_LABEL, trigger.alert_threshold - 20
        )
        other_action = create_alert_rule_trigger_action(
            other_trigger, AlertRuleTriggerAction.Type.EMAIL, AlertRuleTriggerAction.TargetType.USER
        )

        processor = self.send_update(
            rule, trigger.alert_threshold + 1, timedelta(minutes=-10), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, other_trigger, 0, 0)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_exists_with_status(incident, other_trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident,
            [other_action, self.action],
            [
                (trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY),
                (trigger.alert_threshold + 1, IncidentStatus.CRITICAL, mock.ANY),
            ],
        )

        processor = self.send_update(
            rule, trigger.alert_threshold - 1, timedelta(minutes=-9), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, other_trigger, 0, 0)
        incident = self.assert_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, other_trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident,
            [other_action, self.action],
            [
                (trigger.alert_threshold - 1, IncidentStatus.WARNING, mock.ANY),
                (trigger.alert_threshold - 1, IncidentStatus.WARNING, mock.ANY),
            ],
        )

        processor = self.send_update(
            rule, rule.resolve_threshold - 1, timedelta(minutes=-8), subscription=self.sub
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, other_trigger, 0, 0)
        self.assert_no_active_incident(rule, self.sub)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.RESOLVED)
        self.assert_trigger_exists_with_status(incident, other_trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident,
            [other_action, self.action],
            [
                (rule.resolve_threshold - 1, IncidentStatus.CLOSED, mock.ANY),
                (rule.resolve_threshold - 1, IncidentStatus.CLOSED, mock.ANY),
            ],
        )

    def test_comparison_alert_above(self):
        rule = self.comparison_rule_above
        comparison_delta = timedelta(seconds=rule.comparison_delta)
        trigger = self.trigger
        processor = self.send_update(
            rule, trigger.alert_threshold + 1, timedelta(minutes=-10), subscription=self.sub
        )
        # Shouldn't trigger, since there should be no data in the comparison period
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_does_not_exist(trigger)
        self.assert_action_handler_called_with_actions(None, [])
        self.metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.skipping_update_comparison_value_invalid"),
                call("incidents.alert_rules.skipping_update_invalid_aggregation_value"),
            ]
        )
        comparison_date = django_timezone.now() - comparison_delta

        for i in range(4):
            self.store_event(
                data={"timestamp": iso_format(comparison_date - timedelta(minutes=30 + i))},
                project_id=self.project.id,
            )

        self.metrics.incr.reset_mock()
        processor = self.send_update(rule, 2, timedelta(minutes=-9), subscription=self.sub)
        # Shouldn't trigger, since there are 4 events in the comparison period, and 2/4 == 50%
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_does_not_exist(trigger)
        self.assert_action_handler_called_with_actions(None, [])
        assert self.metrics.incr.call_count == 0

        processor = self.send_update(rule, 4, timedelta(minutes=-8), subscription=self.sub)
        # Shouldn't trigger, since there are 4 events in the comparison period, and 4/4 == 100%, so
        # no change
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_does_not_exist(trigger)
        self.assert_action_handler_called_with_actions(None, [])

        processor = self.send_update(rule, 6, timedelta(minutes=-7), subscription=self.sub)
        # Shouldn't trigger, 6/4 == 150%, but we want > 150%
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_does_not_exist(trigger)
        self.assert_action_handler_called_with_actions(None, [])

        processor = self.send_update(rule, 7, timedelta(minutes=-6), subscription=self.sub)
        # Should trigger, 7/4 == 175% > 150%
        self.assert_trigger_counts(processor, trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident, [self.action], [(175.0, IncidentStatus.CRITICAL, mock.ANY)]
        )

        # Check we successfully resolve
        processor = self.send_update(rule, 6, timedelta(minutes=-5), subscription=self.sub)
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident, [self.action], [(150, IncidentStatus.CLOSED, mock.ANY)]
        )

    def test_comparison_alert_below(self):
        rule = self.comparison_rule_below
        comparison_delta = timedelta(seconds=rule.comparison_delta)
        trigger = self.trigger
        processor = self.send_update(
            rule, trigger.alert_threshold + 1, timedelta(minutes=-10), subscription=self.sub
        )
        # Shouldn't trigger at all, since there should be no data in the comparison period
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_does_not_exist(trigger)
        self.assert_action_handler_called_with_actions(None, [])
        self.metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.skipping_update_comparison_value_invalid"),
                call("incidents.alert_rules.skipping_update_invalid_aggregation_value"),
            ]
        )
        comparison_date = django_timezone.now() - comparison_delta

        for i in range(4):
            self.store_event(
                data={
                    "timestamp": iso_format(comparison_date - timedelta(minutes=30 + i)),
                },
                project_id=self.project.id,
            )

        self.metrics.incr.reset_mock()
        processor = self.send_update(rule, 6, timedelta(minutes=-9), subscription=self.sub)
        # Shouldn't trigger, since there are 4 events in the comparison period, and 6/4== 150%
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_does_not_exist(trigger)
        self.assert_action_handler_called_with_actions(None, [])
        assert self.metrics.incr.call_count == 0

        processor = self.send_update(rule, 4, timedelta(minutes=-8), subscription=self.sub)
        # Shouldn't trigger, since there are 4 events in the comparison period, and 4/4== 100%
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_does_not_exist(trigger)
        self.assert_action_handler_called_with_actions(None, [])

        processor = self.send_update(rule, 2, timedelta(minutes=-7), subscription=self.sub)
        # Shouldn't trigger, 2/4== 50%, but we want < 50%
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_does_not_exist(trigger)
        self.assert_action_handler_called_with_actions(None, [])

        processor = self.send_update(rule, 1, timedelta(minutes=-6), subscription=self.sub)
        # Should trigger, 1/4== 25% < 50%
        self.assert_trigger_counts(processor, trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident, [self.action], [(25.0, IncidentStatus.CRITICAL, mock.ANY)]
        )

        # Check we successfully resolve
        processor = self.send_update(rule, 2, timedelta(minutes=-5), subscription=self.sub)
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident, [self.action], [(50.0, IncidentStatus.CLOSED, mock.ANY)]
        )

    def test_comparison_alert_different_aggregate(self):
        rule = self.comparison_rule_above
        update_alert_rule(rule, aggregate="count_unique(tags[sentry:user])")
        comparison_delta = timedelta(seconds=rule.comparison_delta)
        trigger = self.trigger
        processor = self.send_update(
            rule, trigger.alert_threshold + 1, timedelta(minutes=-10), subscription=self.sub
        )
        # Shouldn't trigger, since there should be no data in the comparison period
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_does_not_exist(trigger)
        self.assert_action_handler_called_with_actions(None, [])
        self.metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.skipping_update_comparison_value_invalid"),
                call("incidents.alert_rules.skipping_update_invalid_aggregation_value"),
            ]
        )
        comparison_date = django_timezone.now() - comparison_delta

        for i in range(4):
            self.store_event(
                data={
                    "timestamp": iso_format(comparison_date - timedelta(minutes=30 + i)),
                    "tags": {"sentry:user": i},
                },
                project_id=self.project.id,
            )

        self.metrics.incr.reset_mock()
        processor = self.send_update(rule, 2, timedelta(minutes=-9), subscription=self.sub)
        # Shouldn't trigger, since there are 4 events in the comparison period, and 2/4 == 50%
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_does_not_exist(trigger)
        self.assert_action_handler_called_with_actions(None, [])
        assert self.metrics.incr.call_count == 0

        processor = self.send_update(rule, 4, timedelta(minutes=-8), subscription=self.sub)
        # Shouldn't trigger, since there are 4 events in the comparison period, and 4/4 == 100%, so
        # no change
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_does_not_exist(trigger)
        self.assert_action_handler_called_with_actions(None, [])

        processor = self.send_update(rule, 6, timedelta(minutes=-7), subscription=self.sub)
        # Shouldn't trigger, 6/4 == 150%, but we want > 150%
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_does_not_exist(trigger)
        self.assert_action_handler_called_with_actions(None, [])

        processor = self.send_update(rule, 7, timedelta(minutes=-6), subscription=self.sub)
        # Should trigger, 7/4 == 175% > 150%
        self.assert_trigger_counts(processor, trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident, [self.action], [(175.0, IncidentStatus.CRITICAL, mock.ANY)]
        )

        # Check we successfully resolve
        processor = self.send_update(rule, 6, timedelta(minutes=-5), subscription=self.sub)
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident, [self.action], [(150.0, IncidentStatus.CLOSED, mock.ANY)]
        )

    def test_no_new_incidents_within_ten_minutes(self):
        # Verify that a new incident is not made for the same rule, trigger, and
        # subscription if an incident was already made within the last 10 minutes.
        rule = self.rule
        trigger = self.trigger
        processor = self.send_update(
            rule, trigger.alert_threshold + 1, timedelta(minutes=-2), self.sub
        )
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        original_incident = self.assert_active_incident(rule)
        original_incident.update(date_added=original_incident.date_added - timedelta(minutes=10))
        self.assert_trigger_exists_with_status(original_incident, trigger, TriggerStatus.ACTIVE)

        # resolve the trigger
        self.send_update(rule, 6, timedelta(minutes=-1), subscription=self.sub)
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(original_incident, trigger, TriggerStatus.RESOLVED)

        # fire trigger again within 10 minutes; no new incident should be made
        processor = self.send_update(rule, trigger.alert_threshold + 1, subscription=self.sub)
        self.assert_trigger_counts(processor, self.trigger, 1, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(original_incident, trigger, TriggerStatus.RESOLVED)
        self.assert_incident_is_latest_for_rule(original_incident)
        self.metrics.incr.assert_has_calls(
            [
                call(
                    "incidents.alert_rules.hit_rate_limit",
                    tags={
                        "last_incident_id": original_incident.id,
                        "project_id": self.sub.project.id,
                        "trigger_id": trigger.id,
                    },
                ),
            ],
            any_order=True,
        )

    def test_incident_made_after_ten_minutes(self):
        # Verify that a new incident will be made for the same rule, trigger, and
        # subscription if the last incident made for those was made more tha 10 minutes
        # ago
        rule = self.rule
        trigger = self.trigger
        processor = self.send_update(
            rule, trigger.alert_threshold + 1, timedelta(minutes=-2), self.sub
        )
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        original_incident = self.assert_active_incident(rule)
        original_incident.update(date_added=original_incident.date_added - timedelta(minutes=11))
        self.assert_trigger_exists_with_status(original_incident, trigger, TriggerStatus.ACTIVE)

        # resolve the trigger
        self.send_update(rule, 6, timedelta(minutes=-1), self.sub)
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(original_incident, trigger, TriggerStatus.RESOLVED)

        # fire trigger again after more than 10 minutes have passed; a new incident should be made
        processor = self.send_update(rule, trigger.alert_threshold + 1, subscription=self.sub)
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        new_incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(new_incident, trigger, TriggerStatus.ACTIVE)
        self.assert_incident_is_latest_for_rule(new_incident)


class MetricsCrashRateAlertProcessUpdateTest(ProcessUpdateBaseClass, BaseMetricsTestCase):
    @pytest.fixture(autouse=True)
    def _setup_metrics_patcher(self):
        with mock.patch(
            "sentry.snuba.entity_subscription.metrics"
        ) as self.entity_subscription_metrics:
            yield

    format = "v2"  # TODO: remove once subscriptions migrated

    def setUp(self):
        super().setUp()
        for status in ["exited", "crashed"]:
            self.store_session(
                self.build_session(
                    status=status,
                )
            )

    @cached_property
    def sub(self):
        return self.crash_rate_alert_rule.snuba_query.subscriptions.filter(
            project=self.project
        ).get()

    @cached_property
    def crash_rate_alert_rule(self):
        rule = self.create_alert_rule(
            projects=[self.project],
            dataset=Dataset.Metrics,
            name="JustAValidRule",
            query="",
            aggregate="percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
            time_window=1,
            threshold_type=AlertRuleThresholdType.BELOW,
            threshold_period=1,
        )
        trigger = create_alert_rule_trigger(rule, "critical", 80)
        create_alert_rule_trigger_action(
            trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.USER,
            str(self.user.id),
        )
        return rule

    @cached_property
    def crash_rate_alert_critical_trigger(self):
        return self.crash_rate_alert_rule.alertruletrigger_set.get()

    @cached_property
    def crash_rate_alert_critical_action(self):
        return self.crash_rate_alert_critical_trigger.alertruletriggeraction_set.get()

    @cached_property
    def crash_rate_alert_warning_trigger(self):
        return create_alert_rule_trigger(self.crash_rate_alert_rule, "warning", 90)

    @cached_property
    def crash_rate_alert_warning_action(self):
        return create_alert_rule_trigger_action(
            self.crash_rate_alert_warning_trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.USER,
            str(self.user.id),
        )

    def send_crash_rate_alert_update(self, rule, value, subscription, time_delta=None, count=EMPTY):
        self.email_action_handler.reset_mock()
        if time_delta is None:
            time_delta = timedelta()
        processor = SubscriptionProcessor(subscription)

        if time_delta is not None:
            timestamp = django_timezone.now() + time_delta
        else:
            timestamp = django_timezone.now()
        timestamp = timestamp.replace(tzinfo=timezone.utc, microsecond=0)

        with self.feature(
            ["organizations:incidents", "organizations:performance-view"]
        ), self.capture_on_commit_callbacks(execute=True):
            if value is None:
                numerator, denominator = 0, 0
            else:
                if count is EMPTY:
                    numerator, denominator = value.as_integer_ratio()
                else:
                    denominator = count
                    numerator = int(value * denominator)
            processor.process_update(
                {
                    "entity": "entity",
                    "subscription_id": subscription.subscription_id
                    if subscription
                    else uuid4().hex,
                    "values": {
                        "data": [
                            {
                                "project_id": 8,
                                "count": denominator,
                                "crashed": numerator,
                            },
                        ]
                    },
                    "timestamp": timestamp,
                }
            )
        return processor

    def test_crash_rate_alert_for_sessions_with_auto_resolve_critical(self):
        """
        Test that ensures that a Critical alert is triggered when `crash_free_percentage` falls
        below the Critical threshold and then is Resolved once `crash_free_percentage` goes above
        the threshold (when no resolve_threshold is set)
        """
        rule = self.crash_rate_alert_rule
        trigger = self.crash_rate_alert_critical_trigger
        action_critical = self.crash_rate_alert_critical_action

        # Send Critical Update
        update_value = (1 - trigger.alert_threshold / 100) + 0.05
        self.send_crash_rate_alert_update(
            rule=rule,
            value=update_value,
            time_delta=timedelta(minutes=-2),
            subscription=rule.snuba_query.subscriptions.filter(project=self.project).get(),
        )
        incident = self.assert_active_incident(rule)
        self.assert_actions_fired_for_incident(
            incident, [action_critical], [(75.0, IncidentStatus.CRITICAL, mock.ANY)]
        )
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)

        update_value = (1 - trigger.alert_threshold / 100) - 0.05
        self.send_crash_rate_alert_update(
            rule=rule,
            value=update_value,
            time_delta=timedelta(minutes=-1),
            subscription=rule.snuba_query.subscriptions.filter(project=self.project).get(),
        )
        self.assert_no_active_incident(rule)
        self.assert_actions_resolved_for_incident(
            incident, [action_critical], [(85.0, IncidentStatus.CLOSED, mock.ANY)]
        )

    def test_crash_rate_alert_for_sessions_with_auto_resolve_warning(self):
        """
        Test that ensures that a Warning alert is triggered when `crash_free_percentage` falls
        below the Warning threshold and then is Resolved once `crash_free_percentage` goes above
        the threshold (when no resolve_threshold is set)
        """
        rule = self.crash_rate_alert_rule
        trigger_warning = self.crash_rate_alert_warning_trigger
        action_warning = self.crash_rate_alert_warning_action

        # Send Warning Update
        update_value = (1 - trigger_warning.alert_threshold / 100) + 0.05
        self.send_crash_rate_alert_update(
            rule=rule,
            value=update_value,
            time_delta=timedelta(minutes=-3),
            subscription=rule.snuba_query.subscriptions.filter(project=self.project).get(),
        )

        incident = self.assert_active_incident(rule)
        self.assert_actions_fired_for_incident(
            incident, [action_warning], [(85.0, IncidentStatus.WARNING, mock.ANY)]
        )
        self.assert_trigger_exists_with_status(incident, trigger_warning, TriggerStatus.ACTIVE)

        update_value = (1 - trigger_warning.alert_threshold / 100) - 0.05
        self.send_crash_rate_alert_update(
            rule=rule,
            value=update_value,
            time_delta=timedelta(minutes=-1),
            subscription=rule.snuba_query.subscriptions.filter(project=self.project).get(),
        )
        self.assert_actions_resolved_for_incident(
            incident, [action_warning], [(95.0, IncidentStatus.CLOSED, mock.ANY)]
        )
        self.assert_no_active_incident(rule)

    def test_crash_rate_alert_for_sessions_with_critical_warning_then_resolved(self):
        """
        Test that tests the behavior of going from Critical status to Warning status to Resolved
        for Crash Rate Alerts
        """
        rule = self.crash_rate_alert_rule

        trigger = self.crash_rate_alert_critical_trigger
        trigger_warning = self.crash_rate_alert_warning_trigger
        action_warning = self.crash_rate_alert_warning_action

        # Send Critical Update
        update_value = (1 - trigger.alert_threshold / 100) + 0.05
        self.send_crash_rate_alert_update(
            rule=rule,
            value=update_value,
            time_delta=timedelta(minutes=-10),
            subscription=rule.snuba_query.subscriptions.filter(project=self.project).get(),
        )
        incident = self.assert_active_incident(rule)
        self.assert_actions_fired_for_incident(
            incident, [action_warning], [(75.0, IncidentStatus.CRITICAL, mock.ANY)]
        )
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)

        # Send Warning Update
        update_value = (1 - trigger_warning.alert_threshold / 100) + 0.05
        self.send_crash_rate_alert_update(
            rule=rule,
            value=update_value,
            time_delta=timedelta(minutes=-3),
            subscription=rule.snuba_query.subscriptions.filter(project=self.project).get(),
        )

        incident = self.assert_active_incident(rule)
        self.assert_actions_resolved_for_incident(
            incident, [action_warning], [(85.0, IncidentStatus.WARNING, mock.ANY)]
        )
        self.assert_trigger_exists_with_status(incident, trigger_warning, TriggerStatus.ACTIVE)

        # Send update higher than warning threshold
        update_value = (1 - trigger_warning.alert_threshold / 100) - 0.05
        self.send_crash_rate_alert_update(
            rule=rule,
            value=update_value,
            time_delta=timedelta(minutes=-1),
            subscription=rule.snuba_query.subscriptions.filter(project=self.project).get(),
        )
        self.assert_actions_resolved_for_incident(
            incident, [action_warning], [(95.0, IncidentStatus.CLOSED, mock.ANY)]
        )
        self.assert_no_active_incident(rule)

    def test_crash_rate_alert_for_sessions_with_triggers_lower_than_resolve_threshold(self):
        """
        Test that ensures that when `crash_rate_percentage` goes above the warning threshold but
        lower than the resolve threshold, incident is not resolved
        """
        rule = self.crash_rate_alert_rule
        rule.resolve_threshold = 95
        rule.save()

        trigger = self.crash_rate_alert_critical_trigger
        trigger_warning = self.crash_rate_alert_warning_trigger

        action_warning = self.crash_rate_alert_warning_action
        self.crash_rate_alert_warning_action

        # Send Critical Update
        update_value = (1 - trigger.alert_threshold / 100) + 0.05
        self.send_crash_rate_alert_update(
            rule=rule,
            value=update_value,
            time_delta=timedelta(minutes=-10),
            subscription=rule.snuba_query.subscriptions.filter(project=self.project).get(),
        )
        incident = self.assert_active_incident(rule)
        self.assert_actions_fired_for_incident(
            incident, [action_warning], [(75.0, IncidentStatus.CRITICAL, mock.ANY)]
        )
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)

        # Send Warning Update
        update_value = (1 - trigger_warning.alert_threshold / 100) + 0.05
        self.send_crash_rate_alert_update(
            rule=rule,
            value=update_value,
            time_delta=timedelta(minutes=-3),
            subscription=rule.snuba_query.subscriptions.filter(project=self.project).get(),
        )

        incident = self.assert_active_incident(rule)
        self.assert_actions_resolved_for_incident(
            incident, [action_warning], [(85.0, IncidentStatus.WARNING, mock.ANY)]
        )
        self.assert_trigger_exists_with_status(incident, trigger_warning, TriggerStatus.ACTIVE)

        # Send update higher than warning threshold but lower than resolve threshold
        update_value = (1 - trigger_warning.alert_threshold / 100) - 0.05
        self.send_crash_rate_alert_update(
            rule=rule,
            value=update_value,
            time_delta=timedelta(minutes=-1),
            subscription=rule.snuba_query.subscriptions.filter(project=self.project).get(),
        )
        self.assert_active_incident(rule)

    def test_crash_rate_alert_for_sessions_with_no_sessions_data(self):
        """
        Test that ensures we skip the Crash Rate Alert processing if we have no sessions data
        """
        rule = self.crash_rate_alert_rule

        self.send_crash_rate_alert_update(
            rule=rule,
            value=None,
            subscription=rule.snuba_query.subscriptions.filter(project=self.project).get(),
        )
        self.metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.ignore_update_no_session_data"),
                call("incidents.alert_rules.skipping_update_invalid_aggregation_value"),
            ],
            any_order=True,
        )

    @patch("sentry.incidents.subscription_processor.CRASH_RATE_ALERT_MINIMUM_THRESHOLD", 30)
    def test_crash_rate_alert_when_session_count_is_lower_than_minimum_threshold(self):
        rule = self.crash_rate_alert_rule
        trigger = self.crash_rate_alert_critical_trigger

        # Send Critical Update
        update_value = (1 - trigger.alert_threshold / 100) + 0.05
        self.send_crash_rate_alert_update(
            rule=rule,
            value=update_value,
            count=10,
            time_delta=timedelta(minutes=-10),
            subscription=rule.snuba_query.subscriptions.filter(project=self.project).get(),
        )
        self.assert_no_active_incident(rule)
        self.metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.ignore_update_count_lower_than_min_threshold"),
                call("incidents.alert_rules.skipping_update_invalid_aggregation_value"),
            ],
            any_order=True,
        )

    @patch("sentry.incidents.subscription_processor.CRASH_RATE_ALERT_MINIMUM_THRESHOLD", 30)
    def test_crash_rate_alert_when_session_count_is_higher_than_minimum_threshold(self):
        rule = self.crash_rate_alert_rule
        trigger = self.crash_rate_alert_critical_trigger
        action_critical = self.crash_rate_alert_critical_action

        # Send Critical Update
        update_value = (1 - trigger.alert_threshold / 100) + 0.05
        self.send_crash_rate_alert_update(
            rule=rule,
            value=update_value,
            count=31,
            time_delta=timedelta(minutes=-10),
            subscription=rule.snuba_query.subscriptions.filter(project=self.project).get(),
        )
        incident = self.assert_active_incident(rule)
        self.assert_actions_fired_for_incident(incident, [action_critical], None)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)

    def test_multiple_threshold_trigger_is_reset_when_no_sessions_data(self):
        rule = self.crash_rate_alert_rule
        rule.update(threshold_period=2)

        trigger = self.crash_rate_alert_critical_trigger
        update_value = (1 - trigger.alert_threshold / 100) + 0.05
        subscription = rule.snuba_query.subscriptions.filter(project=self.project).get()

        processor = self.send_crash_rate_alert_update(
            rule=rule,
            value=update_value,
            time_delta=timedelta(minutes=-2),
            subscription=subscription,
        )

        self.assert_trigger_counts(processor, trigger, 1, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_does_not_exist(trigger)
        self.assert_action_handler_called_with_actions(None, [])

        processor = self.send_crash_rate_alert_update(
            rule=rule,
            value=None,
            time_delta=timedelta(minutes=-1),
            subscription=subscription,
        )
        self.metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.ignore_update_no_session_data"),
                call("incidents.alert_rules.skipping_update_invalid_aggregation_value"),
            ],
            any_order=True,
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)

    @patch("sentry.incidents.subscription_processor.CRASH_RATE_ALERT_MINIMUM_THRESHOLD", 30)
    def test_multiple_threshold_trigger_is_reset_when_count_is_lower_than_min_threshold(self):
        rule = self.crash_rate_alert_rule
        rule.update(threshold_period=2)

        trigger = self.crash_rate_alert_critical_trigger
        update_value = (1 - trigger.alert_threshold / 100) + 0.05
        subscription = rule.snuba_query.subscriptions.filter(project=self.project).get()

        processor = self.send_crash_rate_alert_update(
            rule=rule,
            value=update_value,
            time_delta=timedelta(minutes=-2),
            subscription=subscription,
        )

        self.assert_trigger_counts(processor, trigger, 1, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_does_not_exist(trigger)
        self.assert_action_handler_called_with_actions(None, [])

        processor = self.send_crash_rate_alert_update(
            rule=rule,
            value=update_value,
            count=1,
            time_delta=timedelta(minutes=-1),
            subscription=subscription,
        )
        self.metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.ignore_update_count_lower_than_min_threshold"),
                call("incidents.alert_rules.skipping_update_invalid_aggregation_value"),
            ],
            any_order=True,
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)

    def test_multiple_threshold_resolve_is_reset_when_no_sessions_data(self):
        rule = self.crash_rate_alert_rule
        trigger = self.crash_rate_alert_critical_trigger
        action_critical = self.crash_rate_alert_critical_action
        subscription = rule.snuba_query.subscriptions.filter(project=self.project).get()

        # Send critical update to get an incident fired
        update_value = (1 - trigger.alert_threshold / 100) + 0.05
        processor = self.send_crash_rate_alert_update(
            rule=rule,
            value=update_value,
            time_delta=timedelta(minutes=-2),
            subscription=subscription,
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident,
            [action_critical],
            [(75.0, IncidentStatus.CRITICAL, mock.ANY)],
        )

        # Send a resolve update to increment the resolve count to 1
        rule.update(threshold_period=2)
        resolve_update_value = (1 - trigger.alert_threshold / 100) - 0.05
        processor = self.send_crash_rate_alert_update(
            rule=rule,
            value=resolve_update_value,
            time_delta=timedelta(minutes=-1),
            subscription=subscription,
        )
        self.assert_trigger_counts(processor, trigger, 0, 1)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_action_handler_called_with_actions(incident, [])

        # Send an empty update which should reset the resolve count to 0
        processor = self.send_crash_rate_alert_update(
            rule=rule,
            value=None,
            subscription=subscription,
        )
        self.metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.ignore_update_no_session_data"),
                call("incidents.alert_rules.skipping_update_invalid_aggregation_value"),
            ],
            any_order=True,
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_action_handler_called_with_actions(incident, [])

    @patch("sentry.incidents.subscription_processor.CRASH_RATE_ALERT_MINIMUM_THRESHOLD", 30)
    def test_multiple_threshold_resolve_is_reset_when_count_is_lower_than_min_threshold(self):
        rule = self.crash_rate_alert_rule
        trigger = self.crash_rate_alert_critical_trigger
        action_critical = self.crash_rate_alert_critical_action
        subscription = rule.snuba_query.subscriptions.filter(project=self.project).get()

        # Send critical update to get an incident fired
        update_value = (1 - trigger.alert_threshold / 100) + 0.05
        processor = self.send_crash_rate_alert_update(
            rule=rule,
            value=update_value,
            count=31,
            time_delta=timedelta(minutes=-2),
            subscription=subscription,
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(incident, [action_critical], None)

        # Send a resolve update to increment the resolve count to 1
        rule.update(threshold_period=2)
        resolve_update_value = (1 - trigger.alert_threshold / 100) - 0.05
        processor = self.send_crash_rate_alert_update(
            rule=rule,
            value=resolve_update_value,
            time_delta=timedelta(minutes=-1),
            subscription=subscription,
        )
        self.assert_trigger_counts(processor, trigger, 0, 1)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_action_handler_called_with_actions(incident, [])

        # Send an empty update which should reset the resolve count to 0
        processor = self.send_crash_rate_alert_update(
            rule=rule,
            value=resolve_update_value,
            count=10,
            subscription=subscription,
        )
        self.metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.ignore_update_count_lower_than_min_threshold"),
                call("incidents.alert_rules.skipping_update_invalid_aggregation_value"),
            ],
            any_order=True,
        )
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_action_handler_called_with_actions(incident, [])

    def test_ensure_case_when_no_metrics_index_not_found_is_handled_gracefully(self):
        MetricsKeyIndexer.objects.all().delete()
        rule = self.crash_rate_alert_rule
        subscription = rule.snuba_query.subscriptions.filter(project=self.project).get()
        processor = SubscriptionProcessor(subscription)
        processor.process_update(
            {
                "entity": "entity",
                "subscription_id": subscription.subscription_id,
                "values": {
                    # 1001 is a random int that doesn't map to anything in the indexer
                    "data": [
                        {
                            resolve_tag_key(
                                UseCaseKey.RELEASE_HEALTH, self.organization.id, "session.status"
                            ): 1001
                        }
                    ]
                },
                "timestamp": django_timezone.now(),
            }
        )
        self.assert_no_active_incident(rule)
        self.entity_subscription_metrics.incr.assert_has_calls(
            [
                call("incidents.entity_subscription.metric_index_not_found"),
            ]
        )
        self.metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.ignore_update_no_session_data"),
                call("incidents.alert_rules.skipping_update_invalid_aggregation_value"),
            ],
            any_order=True,
        )


class MetricsCrashRateAlertProcessUpdateV1Test(MetricsCrashRateAlertProcessUpdateTest):
    """Repeat MetricsCrashRateUpdateAlertTest with old (v1) subscription updates.

    This entire test class can be removed once all subscriptions have been migrated to v2
    """

    def send_crash_rate_alert_update(self, rule, value, subscription, time_delta=None, count=EMPTY):
        org_id = self.organization.id
        self.email_action_handler.reset_mock()
        if time_delta is None:
            time_delta = timedelta()
        processor = SubscriptionProcessor(subscription)

        if time_delta is not None:
            timestamp = django_timezone.now() + time_delta
        else:
            timestamp = django_timezone.now()
        timestamp = timestamp.replace(tzinfo=timezone.utc, microsecond=0)

        with self.feature(
            ["organizations:incidents", "organizations:performance-view"]
        ), self.capture_on_commit_callbacks(execute=True):
            if value is None:
                numerator, denominator = 0, 0
            else:
                if count is EMPTY:
                    numerator, denominator = value.as_integer_ratio()
                else:
                    denominator = count
                    numerator = int(value * denominator)
            session_status = resolve_tag_key(UseCaseKey.RELEASE_HEALTH, org_id, "session.status")
            tag_value_init = resolve_tag_value(UseCaseKey.RELEASE_HEALTH, org_id, "init")
            tag_value_crashed = resolve_tag_value(UseCaseKey.RELEASE_HEALTH, org_id, "crashed")
            processor.process_update(
                {
                    "entity": "entity",
                    "subscription_id": subscription.subscription_id
                    if subscription
                    else uuid4().hex,
                    "values": {
                        "data": [
                            {"project_id": 8, session_status: tag_value_init, "value": denominator},
                            {
                                "project_id": 8,
                                session_status: tag_value_crashed,
                                "value": numerator,
                            },
                        ]
                    },
                    "timestamp": timestamp,
                }
            )
        return processor


class TestBuildAlertRuleStatKeys(unittest.TestCase):
    def test(self):
        stat_keys = build_alert_rule_stat_keys(AlertRule(id=1), QuerySubscription(project_id=2))
        assert stat_keys == [
            "{alert_rule:1:project:2}:last_update",
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
        timestamp = datetime.now().replace(tzinfo=timezone.utc, microsecond=0)
        pipeline.set("{alert_rule:1:project:2}:last_update", int(to_timestamp(timestamp)))
        pipeline.set("{alert_rule:1:project:2}:resolve_triggered", 20)
        for key, value in [
            ("{alert_rule:1:project:2}:trigger:3:alert_triggered", 1),
            ("{alert_rule:1:project:2}:trigger:3:resolve_triggered", 2),
            ("{alert_rule:1:project:2}:trigger:4:alert_triggered", 3),
            ("{alert_rule:1:project:2}:trigger:4:resolve_triggered", 4),
        ]:
            pipeline.set(key, value)
        pipeline.execute()

        last_update, alert_counts, resolve_counts = get_alert_rule_stats(alert_rule, sub, triggers)
        assert last_update == timestamp
        assert alert_counts == {3: 1, 4: 3}
        assert resolve_counts == {3: 2, 4: 4}


class TestUpdateAlertRuleStats(TestCase):
    def test(self):
        alert_rule = AlertRule(id=1)
        sub = QuerySubscription(project_id=2)
        date = datetime.utcnow().replace(tzinfo=timezone.utc)
        update_alert_rule_stats(alert_rule, sub, date, {3: 20, 4: 3}, {3: 10, 4: 15})
        client = get_redis_client()
        results = [
            int(v)
            for v in client.mget(
                [
                    "{alert_rule:1:project:2}:last_update",
                    "{alert_rule:1:project:2}:trigger:3:alert_triggered",
                    "{alert_rule:1:project:2}:trigger:3:resolve_triggered",
                    "{alert_rule:1:project:2}:trigger:4:alert_triggered",
                    "{alert_rule:1:project:2}:trigger:4:resolve_triggered",
                ]
            )
            if v is not None
        ]

        assert results == [int(to_timestamp(date)), 20, 10, 3, 15]
