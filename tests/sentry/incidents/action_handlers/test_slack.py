from unittest.mock import patch
from urllib.parse import parse_qs

import responses

from sentry.constants import ObjectStatus
from sentry.incidents.action_handlers import SlackActionHandler
from sentry.incidents.models import AlertRuleTriggerAction, IncidentStatus
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import region_silo_test
from sentry.utils import json

from . import FireTest


@freeze_time()
@region_silo_test
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
        with self.tasks():
            getattr(handler, method)(metric_value, IncidentStatus(incident.status))
        data = parse_qs(responses.calls[0].request.body)
        assert data["channel"] == [self.channel_id]
        slack_body = SlackIncidentsMessageBuilder(
            incident, IncidentStatus(incident.status), metric_value, chart_url
        ).build()
        assert isinstance(slack_body, dict)
        attachments = json.loads(data["attachments"][0])
        assert attachments[0]["color"] == slack_body["color"]
        assert attachments[0]["blocks"][0] in slack_body["blocks"]
        assert data["text"][0] == slack_body["text"]

    def test_fire_metric_alert(self):
        self.run_fire_test()

    def test_resolve_metric_alert(self):
        self.run_fire_test("resolve")

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
