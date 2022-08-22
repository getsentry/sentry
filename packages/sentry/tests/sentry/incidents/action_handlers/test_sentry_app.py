import responses
from freezegun import freeze_time

from sentry.incidents.action_handlers import SentryAppActionHandler
from sentry.incidents.models import AlertRuleTriggerAction, IncidentStatus
from sentry.testutils import TestCase
from sentry.utils import json

from . import FireTest


@freeze_time()
class SentryAppActionHandlerTest(FireTest, TestCase):
    def setUp(self):
        self.sentry_app = self.create_sentry_app(
            name="foo",
            organization=self.organization,
            is_alertable=True,
            verify_install=False,
        )
        self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.organization, user=self.user
        )

    @responses.activate
    def run_test(self, incident, method):
        from sentry.rules.actions.notify_event_service import build_incident_attachment

        action = self.create_alert_rule_trigger_action(
            target_identifier=self.sentry_app.id,
            type=AlertRuleTriggerAction.Type.SENTRY_APP,
            target_type=AlertRuleTriggerAction.TargetType.SENTRY_APP,
            sentry_app=self.sentry_app,
        )

        responses.add(
            method=responses.POST,
            url="https://example.com/webhook",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": "true"}),
        )

        handler = SentryAppActionHandler(action, incident, self.project)
        metric_value = 1000
        with self.tasks():
            getattr(handler, method)(metric_value, IncidentStatus(incident.status))
        data = responses.calls[0].request.body
        assert (
            json.dumps(
                build_incident_attachment(incident, IncidentStatus(incident.status), metric_value)
            )
            in data
        )

    def test_fire_metric_alert(self):
        self.run_fire_test()

    def test_resolve_metric_alert(self):
        self.run_fire_test("resolve")


@freeze_time()
class SentryAppAlertRuleUIComponentActionHandlerTest(FireTest, TestCase):
    def setUp(self):
        self.sentry_app = self.create_sentry_app(
            name="foo",
            organization=self.organization,
            is_alertable=True,
            verify_install=False,
            schema={
                "elements": [
                    self.create_alert_rule_action_schema(),
                ]
            },
        )
        self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.organization, user=self.user
        )

    @responses.activate
    def run_test(self, incident, method):
        from sentry.rules.actions.notify_event_service import build_incident_attachment

        trigger = self.create_alert_rule_trigger(self.alert_rule, "hi", 1000)
        action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger,
            target_identifier=self.sentry_app.id,
            type=AlertRuleTriggerAction.Type.SENTRY_APP,
            target_type=AlertRuleTriggerAction.TargetType.SENTRY_APP,
            sentry_app=self.sentry_app,
            sentry_app_config=[
                {"name": "channel", "value": "#santry"},
                {"name": "workspace_name", "value": "santrysantrysantry"},
                {"name": "tag", "value": "triage"},
                {"name": "assignee", "value": "Nisanthan Nanthakumar"},
                {"name": "teamId", "value": 1},
            ],
        )

        responses.add(
            method=responses.POST,
            url="https://example.com/webhook",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": "true"}),
        )

        handler = SentryAppActionHandler(action, incident, self.project)
        metric_value = 1000
        with self.tasks():
            getattr(handler, method)(metric_value, IncidentStatus(incident.status))
        data = responses.calls[0].request.body
        assert (
            json.dumps(
                build_incident_attachment(incident, IncidentStatus(incident.status), metric_value)
            )
            in data
        )
        # Check that the Alert Rule UI Component settings are returned
        assert json.loads(data)["data"]["metric_alert"]["alert_rule"]["triggers"][0]["actions"][0][
            "settings"
        ] == [
            {"name": "channel", "value": "#santry"},
            {"name": "workspace_name", "value": "santrysantrysantry"},
            {"name": "tag", "value": "triage"},
            {"name": "assignee", "value": "Nisanthan Nanthakumar"},
            {"name": "teamId", "value": 1},
        ]

    def test_fire_metric_alert(self):
        self.run_fire_test()

    def test_resolve_metric_alert(self):
        self.run_fire_test("resolve")
