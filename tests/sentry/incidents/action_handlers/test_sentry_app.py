from unittest.mock import patch

import responses

from sentry.analytics.events.alert_sent import AlertSentEvent
from sentry.api.serializers import serialize
from sentry.incidents.action_handlers import SentryAppActionHandler
from sentry.incidents.endpoints.serializers.incident import IncidentSerializer
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.incidents.models.incident import IncidentStatus
from sentry.incidents.typings.metric_detector import AlertContext, MetricIssueContext
from sentry.integrations.types import EventLifecycleOutcome
from sentry.sentry_apps.metrics import SentryAppWebhookHaltReason
from sentry.testutils.asserts import (
    assert_count_of_metric,
    assert_halt_metric,
    assert_success_metric,
)
from sentry.testutils.helpers.analytics import assert_last_analytics_event
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils import json

from . import FireTest


@freeze_time()
class SentryAppActionHandlerTest(FireTest):
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

        self.action = self.create_alert_rule_trigger_action(
            target_identifier=self.sentry_app.id,
            type=AlertRuleTriggerAction.Type.SENTRY_APP,
            target_type=AlertRuleTriggerAction.TargetType.SENTRY_APP,
            sentry_app=self.sentry_app,
        )

        self.handler = SentryAppActionHandler()

    @responses.activate
    def run_test(self, incident, method):
        from sentry.rules.actions.notify_event_service import build_incident_attachment

        responses.add(
            method=responses.POST,
            url="https://example.com/webhook",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": "true"}),
        )

        metric_value = 1000
        with self.tasks():
            getattr(self.handler, method)(
                action=self.action,
                incident=incident,
                project=self.project,
                metric_value=metric_value,
                new_status=IncidentStatus(incident.status),
            )
        data = responses.calls[0].request.body
        assert (
            json.dumps(
                build_incident_attachment(
                    alert_context=AlertContext.from_alert_rule_incident(incident.alert_rule),
                    metric_issue_context=MetricIssueContext.from_legacy_models(
                        incident,
                        IncidentStatus(incident.status),
                        metric_value,
                    ),
                    incident_serialized_response=serialize(
                        incident, serializer=IncidentSerializer()
                    ),
                    organization=self.organization,
                )
            )
            in data
        )

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_rule_snoozed(self, mock_record):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CLOSED.value)
        self.snooze_rule(alert_rule=alert_rule)

        responses.add(
            method=responses.POST,
            url="https://example.com/webhook",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": "true"}),
        )

        metric_value = 1000
        with self.tasks():
            self.handler.fire(
                action=self.action,
                incident=incident,
                project=self.project,
                metric_value=metric_value,
                new_status=IncidentStatus(incident.status),
            )

        assert len(responses.calls) == 0

        # SLO asserts
        # PREPARE_WEBHOOK (never got to this point)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=0
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=0
        )

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_rule_bad_response(self, mock_record):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CLOSED.value)

        responses.add(
            method=responses.POST,
            url="https://example.com/webhook",
            status=400,
            content_type="application/json",
            body=json.dumps({"ok": "true"}),
        )

        metric_value = 1000
        with self.tasks():
            self.handler.fire(
                self.action, incident, self.project, metric_value, IncidentStatus(incident.status)
            )

        assert len(responses.calls) == 1

        # SLO asserts
        assert_halt_metric(
            mock_record=mock_record,
            error_msg=f"send_and_save_webhook_request.{SentryAppWebhookHaltReason.GOT_CLIENT_ERROR}_{400}",
        )

        # PREPARE_WEBHOOK (success) -> SEND_WEBHOOK (halt)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=1
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_fire_metric_alert(self, mock_record):
        self.run_fire_test()

        # SLO asserts
        assert_success_metric(mock_record)

        # PREPARE_WEBHOOK (success) -> SEND_WEBHOOK (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=2
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_resolve_metric_alert(self, mock_record):
        self.run_fire_test("resolve")
        # SLO asserts
        assert_success_metric(mock_record)

        # PREPARE_WEBHOOK (success) -> SEND_WEBHOOK (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=2
        )


@freeze_time()
class SentryAppAlertRuleUIComponentActionHandlerTest(FireTest):
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
        self.handler = SentryAppActionHandler()

    @responses.activate
    def run_test(self, incident, method):
        from sentry.rules.actions.notify_event_service import build_incident_attachment

        trigger = self.create_alert_rule_trigger(self.alert_rule, "hi", 1000)
        self.action = self.create_alert_rule_trigger_action(
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

        metric_value = 1000
        with self.tasks():
            getattr(self.handler, method)(
                action=self.action,
                incident=incident,
                project=self.project,
                new_status=IncidentStatus(incident.status),
                metric_value=metric_value,
            )
        data = responses.calls[0].request.body
        assert (
            json.dumps(
                build_incident_attachment(
                    AlertContext.from_alert_rule_incident(self.alert_rule),
                    MetricIssueContext.from_legacy_models(
                        incident, IncidentStatus(incident.status), metric_value
                    ),
                    serialize(incident, serializer=IncidentSerializer()),
                    self.organization,
                )
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

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_fire_metric_alert(self, mock_record):
        self.run_fire_test()

        # SLO asserts
        assert_success_metric(mock_record)

        # PREPARE_WEBHOOK (success) -> SEND_WEBHOOK (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=2
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_resolve_metric_alert(self, mock_record):
        self.run_fire_test("resolve")

        # SLO asserts
        assert_success_metric(mock_record)

        # PREPARE_WEBHOOK (success) -> SEND_WEBHOOK (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=2
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.analytics.record")
    def test_alert_sent_recorded(self, mock_record, mock_record_event):
        self.run_fire_test()
        assert_last_analytics_event(
            mock_record,
            AlertSentEvent(
                organization_id=self.organization.id,
                project_id=self.project.id,
                provider="sentry_app",
                alert_id=self.alert_rule.id,
                alert_type="metric_alert",
                external_id=str(self.action.sentry_app_id),
                notification_uuid="",
            ),
        )

        # SLO asserts
        assert_success_metric(mock_record_event)

        # PREPARE_WEBHOOK (success) -> SEND_WEBHOOK (success)
        assert_count_of_metric(
            mock_record=mock_record_event, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record_event, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=2
        )
