from unittest.mock import patch
from urllib.parse import parse_qs

import orjson
import responses

from sentry.constants import ObjectStatus
from sentry.incidents.action_handlers import SlackActionHandler
from sentry.incidents.logic import update_incident_status
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.incidents.models.incident import IncidentStatus, IncidentStatusMethod
from sentry.models.notificationmessage import NotificationMessage
from sentry.models.options.organization_option import OrganizationOption
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.utils import json

from . import FireTest


@freeze_time()
class SlackActionHandlerTest(FireTest):
    @responses.activate
    def setUp(self):
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

    @responses.activate
    def run_test(self, incident, method, chart_url=None):
        from sentry.integrations.slack.message_builder.incidents import SlackIncidentsMessageBuilder

        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            status=200,
            content_type="application/json",
            body='{"ok": true}',
        )
        handler = SlackActionHandler(self.action, incident, self.project)
        metric_value = 1000
        status = IncidentStatus(incident.status)
        with self.tasks():
            getattr(handler, method)(metric_value, status)
        data = parse_qs(responses.calls[0].request.body)
        assert data["channel"] == [self.channel_id]
        slack_body = SlackIncidentsMessageBuilder(
            self.action, incident, IncidentStatus(incident.status), metric_value, chart_url
        ).build()
        assert isinstance(slack_body, dict)
        attachments = json.loads(data["attachments"][0])
        assert attachments[0]["color"] == slack_body["color"]
        assert attachments[0]["blocks"][0] in slack_body["blocks"]
        assert data["text"][0] == slack_body["text"]

    def test_fire_metric_alert(self):
        self.run_fire_test()

        assert NotificationMessage.objects.all().count() == 1

    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    @with_feature("organizations:slack-sdk-metric-alert")
    def test_fire_metric_alert_sdk(self, mock_api_call):
        mock_api_call.return_value = {
            "body": orjson.dumps({"ok": True}).decode(),
            "headers": {},
            "status": 200,
        }

        incident = self.create_incident(
            alert_rule=self.alert_rule, status=IncidentStatus.CLOSED.value
        )
        handler = SlackActionHandler(self.action, incident, self.project)
        metric_value = 1000
        status = IncidentStatus(incident.status)
        with self.tasks():
            getattr(handler, "fire")(metric_value, status)

        assert NotificationMessage.objects.all().count() == 1

    @with_feature("organizations:slack-sdk-metric-alert")
    def test_fire_metric_alert_sdk_error(self):
        incident = self.create_incident(
            alert_rule=self.alert_rule, status=IncidentStatus.CLOSED.value
        )
        handler = SlackActionHandler(self.action, incident, self.project)
        metric_value = 1000
        status = IncidentStatus(incident.status)
        with self.tasks():
            getattr(handler, "fire")(metric_value, status)

        assert NotificationMessage.objects.all().count() == 1
        msg = NotificationMessage.objects.all()[0]
        assert msg.error_code == 200
        assert msg.error_details["data"] == {"ok": False, "error": "invalid_auth"}

    def test_resolve_metric_alert_no_threading(self):
        OrganizationOption.objects.set_value(
            self.organization, "sentry:metric_alerts_thread_flag", False
        )
        incident = self.create_incident(
            alert_rule=self.alert_rule, status=IncidentStatus.CLOSED.value
        )
        update_incident_status(
            incident, IncidentStatus.CLOSED, status_method=IncidentStatusMethod.MANUAL
        )

        self.run_test(incident, "resolve")

        # we still save the message even if threading is disabled
        assert NotificationMessage.objects.all().count() == 1

    def test_resolve_metric_alert_with_threading(self):
        incident = self.create_incident(
            alert_rule=self.alert_rule, status=IncidentStatus.CLOSED.value
        )
        msg = NotificationMessage.objects.create(incident=incident, trigger_action=self.action)
        update_incident_status(
            incident, IncidentStatus.CLOSED, status_method=IncidentStatusMethod.MANUAL
        )
        self.run_test(incident, "resolve")
        assert (
            NotificationMessage.objects.filter(parent_notification_message_id=msg.id).count() == 1
        )

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

        handler = SlackActionHandler(action, incident, self.project)
        metric_value = 1000
        with self.tasks():
            handler.fire(metric_value, IncidentStatus(incident.status))

    @responses.activate
    def test_rule_snoozed(self):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CLOSED.value)
        self.snooze_rule(alert_rule=alert_rule)

        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            status=200,
            content_type="application/json",
            body='{"ok": true}',
        )
        handler = SlackActionHandler(self.action, incident, self.project)
        metric_value = 1000
        with self.tasks():
            handler.fire(metric_value, IncidentStatus(incident.status))

        assert len(responses.calls) == 0

    @responses.activate
    def test_rule_snoozed_by_user_still_sends(self):
        """We shouldn't be able to get into this state from the UI, but this test ensures that if an alert whose action
        is to notify an integration is muted for a specific user, that the alert still fires because it should only NOT
        fire if it's muted for everyone"""
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CLOSED.value)
        self.snooze_rule(user_id=self.user.id, alert_rule=alert_rule)

        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            status=200,
            content_type="application/json",
            body='{"ok": true}',
        )
        handler = SlackActionHandler(self.action, incident, self.project)
        metric_value = 1000
        with self.tasks():
            handler.fire(metric_value, IncidentStatus(incident.status))

        assert len(responses.calls) == 1

    @patch("sentry.analytics.record")
    def test_alert_sent_recorded(self, mock_record):
        self.run_fire_test()
        mock_record.assert_called_with(
            "alert.sent",
            organization_id=self.organization.id,
            project_id=self.project.id,
            provider="slack",
            alert_id=self.alert_rule.id,
            alert_type="metric_alert",
            external_id=str(self.action.target_identifier),
            notification_uuid="",
        )
