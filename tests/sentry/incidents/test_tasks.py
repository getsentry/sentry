from datetime import timedelta, timezone
from functools import cached_property
from unittest import mock
from unittest.mock import Mock, call, patch

import pytest
from django.urls import reverse
from django.utils import timezone as django_timezone

from sentry.incidents.logic import (
    CRITICAL_TRIGGER_LABEL,
    create_alert_rule_trigger,
    create_alert_rule_trigger_action,
    create_incident_activity,
    subscribe_to_incident,
)
from sentry.incidents.models import (
    INCIDENT_STATUS,
    AlertRuleTriggerAction,
    IncidentActivityType,
    IncidentStatus,
    IncidentSubscription,
)
from sentry.incidents.tasks import (
    SUBSCRIPTION_METRICS_LOGGER,
    build_activity_context,
    generate_incident_activity_email,
    handle_subscription_metrics_logger,
    handle_trigger_action,
    send_subscriber_notifications,
)
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.utils import resolve_tag_key, resolve_tag_value
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.utils.http import absolute_uri

pytestmark = [pytest.mark.sentry_metrics, requires_snuba]


class BaseIncidentActivityTest(TestCase):
    @property
    def incident(self):
        return self.create_incident(title="hello")


class TestSendSubscriberNotifications(BaseIncidentActivityTest):
    @pytest.fixture(autouse=True)
    def _setup_send_async_patch(self):
        with mock.patch("sentry.utils.email.MessageBuilder.send_async") as self.send_async:
            yield

    def test_simple(self):
        activity = create_incident_activity(
            self.incident, IncidentActivityType.COMMENT, user=self.user, comment="hello"
        )
        send_subscriber_notifications(activity.id)
        # User shouldn't receive an email for their own activity
        assert self.send_async.call_count == 0

        self.send_async.reset_mock()
        non_member_user = self.create_user(email="non_member@test.com")
        subscribe_to_incident(activity.incident, non_member_user.id)

        member_user = self.create_user(email="member@test.com")
        self.create_member([self.team], user=member_user, organization=self.organization)
        subscribe_to_incident(activity.incident, member_user.id)
        send_subscriber_notifications(activity.id)
        self.send_async.assert_called_once_with([member_user.email])
        assert not IncidentSubscription.objects.filter(
            incident=activity.incident, user_id=non_member_user.id
        ).exists()
        assert IncidentSubscription.objects.filter(
            incident=activity.incident, user_id=member_user.id
        ).exists()

    def test_invalid_types(self):
        activity_type = IncidentActivityType.CREATED
        activity = create_incident_activity(self.incident, activity_type)
        send_subscriber_notifications(activity.id)
        assert self.send_async.call_count == 0
        self.send_async.reset_mock()


@region_silo_test
class TestGenerateIncidentActivityEmail(BaseIncidentActivityTest):
    @freeze_time()
    def test_simple(self):
        activity = create_incident_activity(
            self.incident, IncidentActivityType.COMMENT, user=self.user, comment="hello"
        )
        incident = activity.incident
        recipient = self.create_user()
        message = generate_incident_activity_email(activity, recipient)
        assert message.subject == f"Activity on Alert {incident.title} (#{incident.identifier})"
        assert message.type == "incident.activity"
        assert message.context == build_activity_context(activity, recipient)


@region_silo_test
class TestBuildActivityContext(BaseIncidentActivityTest):
    def run_test(
        self, activity, expected_username, expected_action, expected_comment, expected_recipient
    ):
        incident = activity.incident
        context = build_activity_context(activity, expected_recipient)
        assert context["user_name"] == expected_username
        assert (
            context["action"]
            == f"{expected_action} on alert {activity.incident.title} (#{activity.incident.identifier})"
        )
        assert (
            context["link"]
            == absolute_uri(
                reverse(
                    "sentry-metric-alert",
                    kwargs={
                        "organization_slug": incident.organization.slug,
                        "incident_id": incident.identifier,
                    },
                )
            )
            + "?referrer=incident_activity_email"
        )
        assert context["comment"] == expected_comment

    @freeze_time()
    def test_simple(self):
        activity = create_incident_activity(
            self.incident, IncidentActivityType.COMMENT, user=self.user, comment="hello"
        )
        recipient = self.create_user()
        user = user_service.get_user(user_id=activity.user_id)
        assert user is not None
        self.run_test(
            activity,
            expected_username=user.name,
            expected_action="left a comment",
            expected_comment=activity.comment,
            expected_recipient=recipient,
        )
        activity.type = IncidentActivityType.STATUS_CHANGE
        activity.value = str(IncidentStatus.CLOSED.value)
        activity.previous_value = str(IncidentStatus.WARNING.value)
        user = user_service.get_user(user_id=activity.user_id)
        assert user is not None
        self.run_test(
            activity,
            expected_username=user.name,
            expected_action="changed status from %s to %s"
            % (INCIDENT_STATUS[IncidentStatus.WARNING], INCIDENT_STATUS[IncidentStatus.CLOSED]),
            expected_comment=activity.comment,
            expected_recipient=recipient,
        )


@region_silo_test
class HandleTriggerActionTest(TestCase):
    @pytest.fixture(autouse=True)
    def _setup_metric_patch(self):
        with mock.patch("sentry.incidents.tasks.metrics") as self.metrics:
            yield

    @cached_property
    def alert_rule(self):
        return self.create_alert_rule()

    @cached_property
    def trigger(self):
        return create_alert_rule_trigger(self.alert_rule, CRITICAL_TRIGGER_LABEL, 100)

    @cached_property
    def action(self):
        return create_alert_rule_trigger_action(
            self.trigger, AlertRuleTriggerAction.Type.EMAIL, AlertRuleTriggerAction.TargetType.USER
        )

    def test_missing_trigger_action(self):
        with self.tasks():
            handle_trigger_action.delay(
                1000, 1001, self.project.id, "hello", IncidentStatus.CRITICAL.value
            )
        self.metrics.incr.assert_called_once_with(
            "incidents.alert_rules.action.skipping_missing_action"
        )

    def test_missing_incident(self):
        with self.tasks():
            handle_trigger_action.delay(
                self.action.id, 1001, self.project.id, "hello", IncidentStatus.CRITICAL.value
            )
        self.metrics.incr.assert_called_once_with(
            "incidents.alert_rules.action.skipping_missing_incident"
        )

    def test_missing_project(self):
        incident = self.create_incident()
        with self.tasks():
            handle_trigger_action.delay(
                self.action.id, incident.id, 1002, "hello", IncidentStatus.CRITICAL.value
            )
        self.metrics.incr.assert_called_once_with(
            "incidents.alert_rules.action.skipping_missing_project"
        )

    def test(self):
        with patch.object(AlertRuleTriggerAction, "_type_registrations", new={}):
            mock_handler = Mock()
            AlertRuleTriggerAction.register_type("email", AlertRuleTriggerAction.Type.EMAIL, [])(
                mock_handler
            )
            incident = self.create_incident()
            activity = create_incident_activity(
                incident,
                IncidentActivityType.STATUS_CHANGE,
                value=IncidentStatus.CRITICAL.value,
            )
            metric_value = 1234
            with self.tasks():
                handle_trigger_action.delay(
                    self.action.id,
                    incident.id,
                    self.project.id,
                    "fire",
                    IncidentStatus.CRITICAL.value,
                    metric_value=metric_value,
                )
            mock_handler.assert_called_once_with(self.action, incident, self.project)
            mock_handler.return_value.fire.assert_called_once_with(
                metric_value, IncidentStatus.CRITICAL, str(activity.notification_uuid)
            )


class TestHandleSubscriptionMetricsLogger(TestCase):
    @cached_property
    def subscription(self):
        snuba_query = create_snuba_query(
            SnubaQuery.Type.CRASH_RATE,
            Dataset.Metrics,
            "hello",
            "count()",
            timedelta(minutes=1),
            timedelta(minutes=1),
            None,
        )
        return create_snuba_subscription(self.project, SUBSCRIPTION_METRICS_LOGGER, snuba_query)

    def build_subscription_update(self):
        timestamp = django_timezone.now().replace(tzinfo=timezone.utc, microsecond=0)
        data = {
            "count": 100,
            "crashed": 2.0,
        }
        values = {"data": [data]}
        return {
            "subscription_id": self.subscription.subscription_id,
            "values": values,
            "timestamp": timestamp,
            "interval": 1,
            "partition": 1,
            "offset": 1,
        }

    def test(self):
        with patch("sentry.incidents.tasks.logger") as logger:
            subscription_update = self.build_subscription_update()
            handle_subscription_metrics_logger(subscription_update, self.subscription)
            assert logger.info.call_args_list == [
                call(
                    "handle_subscription_metrics_logger.message",
                    extra={
                        "subscription_id": self.subscription.id,
                        "dataset": self.subscription.snuba_query.dataset,
                        "snuba_subscription_id": self.subscription.subscription_id,
                        "result": subscription_update,
                        "aggregation_value": 98.0,
                    },
                )
            ]


@region_silo_test
class TestHandleSubscriptionMetricsLoggerV1(TestHandleSubscriptionMetricsLogger):
    """Repeat TestHandleSubscriptionMetricsLogger with old (v1) subscription updates.

    This entire test class can be removed once all subscriptions have been migrated to v2
    """

    def build_subscription_update(self):
        timestamp = django_timezone.now().replace(tzinfo=timezone.utc, microsecond=0)
        values = {
            "data": [
                {
                    resolve_tag_key(
                        UseCaseKey.RELEASE_HEALTH, self.organization.id, "session.status"
                    ): resolve_tag_value(UseCaseKey.RELEASE_HEALTH, self.organization.id, "init"),
                    "value": 100.0,
                },
                {
                    resolve_tag_key(
                        UseCaseKey.RELEASE_HEALTH, self.organization.id, "session.status"
                    ): resolve_tag_value(
                        UseCaseKey.RELEASE_HEALTH, self.organization.id, "crashed"
                    ),
                    "value": 2.0,
                },
            ]
        }
        return {
            "subscription_id": self.subscription.subscription_id,
            "values": values,
            "timestamp": timestamp,
            "interval": 1,
            "partition": 1,
            "offset": 1,
        }
