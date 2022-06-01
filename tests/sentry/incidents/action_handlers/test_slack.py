from urllib.parse import parse_qs

import responses
from freezegun import freeze_time

from sentry.incidents.action_handlers import SlackActionHandler
from sentry.incidents.models import AlertRuleTriggerAction, IncidentStatus
from sentry.models import Integration
from sentry.testutils import TestCase
from sentry.utils import json

from . import FireTest


@freeze_time()
class SlackActionHandlerTest(FireTest, TestCase):
    @responses.activate
    def run_test(self, incident, method, chart_url=None):
        from sentry.integrations.slack.message_builder.incidents import SlackIncidentsMessageBuilder

        token = "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        integration = Integration.objects.create(
            external_id="1",
            provider="slack",
            metadata={"access_token": token, "installation_type": "born_as_bot"},
        )
        integration.add_organization(self.organization, self.user)
        channel_id = "some_id"
        channel_name = "#hello"
        responses.add(
            method=responses.GET,
            url="https://slack.com/api/conversations.list",
            status=200,
            content_type="application/json",
            body=json.dumps(
                {"ok": "true", "channels": [{"name": channel_name[1:], "id": channel_id}]}
            ),
        )

        action = self.create_alert_rule_trigger_action(
            target_identifier=channel_name,
            type=AlertRuleTriggerAction.Type.SLACK,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            integration=integration,
        )
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            status=200,
            content_type="application/json",
            body='{"ok": true}',
        )
        handler = SlackActionHandler(action, incident, self.project)
        metric_value = 1000
        with self.tasks():
            getattr(handler, method)(metric_value, IncidentStatus(incident.status))
        data = parse_qs(responses.calls[1].request.body)
        assert data["channel"] == [channel_id]
        assert data["token"] == [token]
        slack_body = SlackIncidentsMessageBuilder(
            incident, IncidentStatus(incident.status), metric_value, chart_url
        ).build()
        attachments = json.loads(data["attachments"][0])
        assert attachments[0]["color"] == slack_body["color"]
        assert attachments[0]["blocks"] == slack_body["blocks"]
        assert data["text"][0] == slack_body["text"]

    def test_fire_metric_alert(self):
        self.run_fire_test()

    def test_resolve_metric_alert(self):
        self.run_fire_test("resolve")

    def test_fire_metric_alert_with_chart(self):
        self.run_fire_test(chart_url="chart-url")


@freeze_time()
class SlackWorkspaceActionHandlerTest(FireTest, TestCase):
    @responses.activate
    def run_test(self, incident, method):
        from sentry.integrations.slack.message_builder.incidents import SlackIncidentsMessageBuilder

        token = "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        integration = Integration.objects.create(
            external_id="1",
            provider="slack",
            metadata={"access_token": token, "installation_type": "born_as_bot"},
        )
        integration.add_organization(self.organization, self.user)
        channel_id = "some_id"
        channel_name = "#hello"
        responses.add(
            method=responses.GET,
            url="https://slack.com/api/conversations.list",
            status=200,
            content_type="application/json",
            body=json.dumps(
                {"ok": "true", "channels": [{"name": channel_name[1:], "id": channel_id}]}
            ),
        )

        action = self.create_alert_rule_trigger_action(
            target_identifier=channel_name,
            type=AlertRuleTriggerAction.Type.SLACK,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            integration=integration,
        )
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            status=200,
            content_type="application/json",
            body='{"ok": true}',
        )
        handler = SlackActionHandler(action, incident, self.project)
        metric_value = 1000
        with self.tasks():
            getattr(handler, method)(metric_value, IncidentStatus(incident.status))
        data = parse_qs(responses.calls[1].request.body)
        assert data["channel"] == [channel_id]
        assert data["token"] == [token]
        slack_body = SlackIncidentsMessageBuilder(
            incident, IncidentStatus(incident.status), metric_value
        ).build()
        attachments = json.loads(data["attachments"][0])
        assert attachments[0]["color"] == slack_body["color"]
        assert attachments[0]["blocks"] == slack_body["blocks"]
        assert data["text"][0] == slack_body["text"]

    def test_fire_metric_alert(self):
        self.run_fire_test()

    def test_fire_metric_alert_with_missing_integration(self):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CLOSED.value)
        integration = Integration.objects.create(
            external_id="1",
            provider="slack",
            metadata={
                "access_token": "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        action = AlertRuleTriggerAction.objects.create(
            alert_rule_trigger=self.create_alert_rule_trigger(),
            type=AlertRuleTriggerAction.Type.SLACK.value,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC.value,
            target_identifier="some_id",
            target_display="#hello",
            integration=integration,
            sentry_app=None,
        )
        integration.delete()
        handler = SlackActionHandler(action, incident, self.project)
        metric_value = 1000
        with self.tasks():
            handler.fire(metric_value, IncidentStatus(incident.status))

    def test_resolve_metric_alert(self):
        self.run_fire_test("resolve")
