from unittest.mock import patch

import orjson
import pytest
import responses
from slack_sdk.errors import SlackApiError
from slack_sdk.web import SlackResponse

from sentry.analytics.events.alert_sent import AlertSentEvent
from sentry.constants import ObjectStatus
from sentry.incidents.logic import update_incident_status
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.incidents.models.incident import IncidentStatus, IncidentStatusMethod
from sentry.incidents.typings.metric_detector import AlertContext, MetricIssueContext
from sentry.integrations.messaging.spec import MessagingActionHandler
from sentry.integrations.slack.message_builder.incidents import SlackIncidentsMessageBuilder
from sentry.integrations.slack.spec import SlackMessagingSpec
from sentry.integrations.types import EventLifecycleOutcome
from sentry.models.options.organization_option import OrganizationOption
from sentry.notifications.models.notificationmessage import NotificationMessage
from sentry.testutils.asserts import assert_failure_metric
from sentry.testutils.helpers.analytics import assert_last_analytics_event
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.utils import json
from tests.sentry.integrations.slack.utils.test_mock_slack_response import mock_slack_response

from . import FireTest


@freeze_time()
@apply_feature_flag_on_cls("organizations:metric-alert-thread-flag")
class SlackActionHandlerTest(FireTest):
    @pytest.fixture(autouse=True)
    def mock_chat_postEphemeral(self):
        with mock_slack_response(
            "chat_scheduleMessage",
            body={"ok": True, "channel": "chan-id", "scheduled_message_id": "Q1298393284"},
        ) as self.mock_schedule:
            yield

    @pytest.fixture(autouse=True)
    def mock_chat_unfurl(self):
        with mock_slack_response(
            "chat_deleteScheduledMessage", body={"ok": True}
        ) as self.mock_delete:
            yield

    @responses.activate
    def setUp(self):
        self.spec = SlackMessagingSpec()
        self.handler = MessagingActionHandler(self.spec)

        token = "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="1",
            provider="slack",
            metadata={"access_token": token, "installation_type": "born_as_bot"},
        )
        self.channel_id = "some_id"
        self.channel_name = "#hello"
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.scheduleMessage",
            status=200,
            content_type="application/json",
            body=json.dumps(
                {"ok": "true", "channel": self.channel_id, "scheduled_message_id": "Q1298393284"}
            ),
        )
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.deleteScheduledMessage",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": True}),
        )
        self.action = self.create_alert_rule_trigger_action(
            target_identifier=self.channel_name,
            type=AlertRuleTriggerAction.Type.SLACK,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            integration=self.integration,
        )
        self.alert_rule = self.create_alert_rule()

    def run_test(self, incident, method, **kwargs):
        chart_url = kwargs.get("chart_url")
        metric_value = 1000
        status = IncidentStatus(incident.status)
        with self.tasks():
            getattr(self.handler, method)(
                action=self.action,
                incident=incident,
                project=self.project,
                new_status=status,
                metric_value=metric_value,
            )

        return incident, chart_url

    def _assert_blocks(self, mock_post, incident, metric_value, chart_url):
        slack_body = SlackIncidentsMessageBuilder(
            alert_context=AlertContext.from_alert_rule_incident(incident.alert_rule),
            metric_issue_context=MetricIssueContext.from_legacy_models(
                incident,
                IncidentStatus(incident.status),
                metric_value,
            ),
            organization=incident.organization,
            date_started=incident.date_started,
            chart_url=chart_url,
        ).build()
        assert isinstance(slack_body, dict)
        attachments = orjson.loads(mock_post.call_args.kwargs["attachments"])
        assert attachments[0]["color"] == slack_body["color"]
        assert attachments[0]["blocks"][0] in slack_body["blocks"]
        assert mock_post.call_args.kwargs["text"] == slack_body["text"]

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    @patch("sentry.integrations.slack.sdk_client.SlackSdkClient.chat_postMessage")
    def test_fire_metric_alert_sdk(self, mock_post, mock_api_call, mock_record):
        mock_api_call.return_value = {
            "body": orjson.dumps({"ok": True}).decode(),
            "headers": {},
            "status": 200,
        }

        incident, chart_url = self.run_fire_test()
        self._assert_blocks(mock_post, incident, 1000, chart_url)

        assert NotificationMessage.objects.all().count() == 1

        assert len(mock_record.mock_calls) == 4
        thread_ts_start, thread_ts_success, send_notification_start, send_notification_success = (
            mock_record.mock_calls
        )
        assert thread_ts_start.args[0] == EventLifecycleOutcome.STARTED
        assert thread_ts_success.args[0] == EventLifecycleOutcome.SUCCESS
        assert send_notification_start.args[0] == EventLifecycleOutcome.STARTED
        assert send_notification_success.args[0] == EventLifecycleOutcome.SUCCESS

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_fire_metric_alert_sdk_error(self, mock_record):
        self.run_fire_test()

        assert NotificationMessage.objects.all().count() == 1
        msg = NotificationMessage.objects.all()[0]
        assert msg.error_code == 200
        assert msg.error_details is not None
        assert msg.error_details["data"] == {"ok": False, "error": "invalid_auth"}

        assert len(mock_record.mock_calls) == 4
        thread_ts_start, thread_ts_failure, send_notification_start, send_notification_failure = (
            mock_record.mock_calls
        )
        assert thread_ts_start.args[0] == EventLifecycleOutcome.STARTED
        assert thread_ts_failure.args[0] == EventLifecycleOutcome.SUCCESS
        assert send_notification_start.args[0] == EventLifecycleOutcome.STARTED
        assert send_notification_failure.args[0] == EventLifecycleOutcome.FAILURE
        assert_failure_metric(mock_record, SlackApiError(message="", response={}))

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.slack.sdk_client.SlackSdkClient.chat_postMessage")
    def test_fire_metric_alert_slo_halt(self, mock_post, mock_record):
        mock_post.side_effect = SlackApiError(
            message="account_inactive",
            response=SlackResponse(
                client=None,
                http_verb="POST",
                api_url="https://slack.com/api/chat.postMessage",
                req_args={},
                data={"ok": False, "error": "account_inactive"},
                headers={},
                status_code=200,
            ),
        )
        self.run_fire_test()

        assert len(mock_record.mock_calls) == 4
        thread_ts_start, thread_ts_failure, send_notification_start, send_notification_failure = (
            mock_record.mock_calls
        )
        assert thread_ts_start.args[0] == EventLifecycleOutcome.STARTED
        assert thread_ts_failure.args[0] == EventLifecycleOutcome.SUCCESS
        assert send_notification_start.args[0] == EventLifecycleOutcome.STARTED
        assert send_notification_failure.args[0] == EventLifecycleOutcome.HALTED

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.slack.sdk_client.SlackSdkClient.chat_postMessage")
    def test_resolve_metric_alert_no_threading(self, mock_post, mock_record):
        OrganizationOption.objects.set_value(
            self.organization, "sentry:metric_alerts_thread_flag", False
        )
        incident = self.create_incident(
            alert_rule=self.alert_rule, status=IncidentStatus.CLOSED.value
        )
        update_incident_status(
            incident, IncidentStatus.CLOSED, status_method=IncidentStatusMethod.MANUAL
        )

        self.run_test(incident, "resolve", mock_post=mock_post)

        # we still save the message even if threading is disabled
        assert NotificationMessage.objects.all().count() == 1

        assert len(mock_record.mock_calls) == 4
        thread_ts_start, thread_ts_success, send_notification_start, send_notification_success = (
            mock_record.mock_calls
        )
        assert thread_ts_start.args[0] == EventLifecycleOutcome.STARTED
        assert thread_ts_success.args[0] == EventLifecycleOutcome.SUCCESS
        assert send_notification_start.args[0] == EventLifecycleOutcome.STARTED
        assert send_notification_success.args[0] == EventLifecycleOutcome.SUCCESS

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.slack.sdk_client.SlackSdkClient.chat_postMessage")
    def test_resolve_metric_alert_with_threading(self, mock_post, mock_record):
        incident = self.create_incident(
            alert_rule=self.alert_rule, status=IncidentStatus.CLOSED.value
        )
        msg = NotificationMessage.objects.create(incident=incident, trigger_action=self.action)
        update_incident_status(
            incident, IncidentStatus.CLOSED, status_method=IncidentStatusMethod.MANUAL
        )
        self.run_test(incident, "resolve", mock_post=mock_post)
        assert (
            NotificationMessage.objects.filter(parent_notification_message_id=msg.id).count() == 1
        )

        assert len(mock_record.mock_calls) == 4
        thread_ts_start, thread_ts_success, send_notification_start, send_notification_success = (
            mock_record.mock_calls
        )
        assert thread_ts_start.args[0] == EventLifecycleOutcome.STARTED
        assert thread_ts_success.args[0] == EventLifecycleOutcome.SUCCESS
        assert send_notification_start.args[0] == EventLifecycleOutcome.STARTED
        assert send_notification_success.args[0] == EventLifecycleOutcome.SUCCESS

    def test_fire_metric_alert_with_chart(self):
        self.run_fire_test(chart_url="chart-url")

    def test_fire_metric_alert_with_missing_integration(self):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CLOSED.value)
        integration = self.create_integration(
            organization=self.organization,
            external_id="2",
            provider="slack",
            status=ObjectStatus.DELETION_IN_PROGRESS,
        )
        action = AlertRuleTriggerAction.objects.create(
            alert_rule_trigger=self.create_alert_rule_trigger(),
            type=AlertRuleTriggerAction.Type.SLACK.value,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC.value,
            target_identifier="some_id",
            target_display="#hello",
            integration_id=integration.id,
            sentry_app_id=None,
        )

        metric_value = 1000
        with self.tasks():
            self.handler.fire(
                action=action,
                incident=incident,
                project=self.project,
                metric_value=metric_value,
                new_status=IncidentStatus(incident.status),
            )

    @patch("sentry.integrations.slack.sdk_client.SlackSdkClient.chat_postMessage")
    def test_rule_snoozed(self, mock_post):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CLOSED.value)
        self.snooze_rule(alert_rule=alert_rule)

        metric_value = 1000
        with self.tasks():
            self.handler.fire(
                action=self.action,
                incident=incident,
                project=self.project,
                metric_value=metric_value,
                new_status=IncidentStatus(incident.status),
            )

        assert not mock_post.called

    @patch("sentry.integrations.slack.sdk_client.SlackSdkClient.chat_postMessage")
    def test_rule_snoozed_by_user_still_sends(self, mock_post):
        """We shouldn't be able to get into this state from the UI, but this test ensures that if an alert whose action
        is to notify an integration is muted for a specific user, that the alert still fires because it should only NOT
        fire if it's muted for everyone"""
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CLOSED.value)
        self.snooze_rule(user_id=self.user.id, alert_rule=alert_rule)

        metric_value = 1000
        with self.tasks():
            self.handler.fire(
                action=self.action,
                incident=incident,
                project=self.project,
                metric_value=metric_value,
                new_status=IncidentStatus(incident.status),
            )

        mock_post.assert_called

    @patch("sentry.analytics.record")
    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_alert_sent_recorded(self, mock_api_call, mock_record):
        mock_api_call.return_value = {
            "body": orjson.dumps({"ok": True}).decode(),
            "headers": {},
            "status": 200,
        }
        self.run_fire_test()
        assert_last_analytics_event(
            mock_record,
            AlertSentEvent(
                organization_id=self.organization.id,
                project_id=self.project.id,
                provider="slack",
                alert_id=self.alert_rule.id,
                alert_type="metric_alert",
                external_id=str(self.action.target_identifier),
                notification_uuid="",
            ),
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    @patch("sentry.integrations.slack.sdk_client.SlackSdkClient.chat_postMessage")
    def test_update_metric_alert_in_thread(self, mock_post, mock_api_call, mock_record_event):
        """
        Tests that subsequent alerts for the same incident are posted as replies
        in a thread, and that critical alerts broadcast to the channel.
        """
        # Mocking Slack responses
        initial_ts = "12345.67890"
        update_ts = "98765.43210"
        mock_post.side_effect = [
            SlackResponse(
                client=None,
                http_verb="POST",
                api_url="...",
                req_args={},
                data={"ok": True, "ts": initial_ts, "channel": self.channel_id},
                headers={},
                status_code=200,
            ),
            SlackResponse(
                client=None,
                http_verb="POST",
                api_url="...",
                req_args={},
                data={"ok": True, "ts": update_ts, "channel": self.channel_id},
                headers={},
                status_code=200,
            ),
        ]
        mock_api_call.return_value = {
            "body": orjson.dumps({"ok": True}).decode(),
            "headers": {},
            "status": 200,
        }

        # 1. Fire initial warning alert
        incident = self.create_incident(
            alert_rule=self.alert_rule, status=IncidentStatus.WARNING.value
        )
        metric_value = 1000
        with self.tasks():
            self.handler.fire(
                action=self.action,
                incident=incident,
                project=self.project,
                metric_value=metric_value,
                new_status=IncidentStatus.WARNING,
            )

        # Assert initial post
        assert mock_post.call_count == 1
        first_call_args, first_call_kwargs = mock_post.call_args
        assert first_call_kwargs.get("thread_ts") is None
        assert first_call_kwargs.get("reply_broadcast") is False
        assert NotificationMessage.objects.filter(incident=incident).count() == 1
        parent_message = NotificationMessage.objects.get(incident=incident)
        assert parent_message.message_identifier == initial_ts
        assert parent_message.parent_notification_message_id is None

        # 2. Update incident status to critical and fire again
        update_incident_status(
            incident, IncidentStatus.CRITICAL, status_method=IncidentStatusMethod.MANUAL
        )
        metric_value_update = 2000
        with self.tasks():
            self.handler.fire(
                action=self.action,
                incident=incident,
                project=self.project,
                metric_value=metric_value_update,
                new_status=IncidentStatus.CRITICAL,
            )

        # Assert update post is in thread and broadcast
        assert mock_post.call_count == 2
        second_call_args, second_call_kwargs = mock_post.call_args
        assert second_call_kwargs.get("thread_ts") == initial_ts
        assert second_call_kwargs.get("reply_broadcast") is True

        # Assert new notification message is saved correctly
        assert NotificationMessage.objects.filter(incident=incident).count() == 2
        update_message = NotificationMessage.objects.exclude(id=parent_message.id).get(
            incident=incident
        )
        assert update_message.message_identifier == update_ts
        assert update_message.parent_notification_message_id == parent_message.id
