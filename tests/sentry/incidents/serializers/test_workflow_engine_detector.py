from datetime import timedelta
from typing import Any
from unittest.mock import patch

from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.workflow_engine_detector import (
    WorkflowEngineDetectorSerializer,
)
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.incidents.models.incident import IncidentTrigger, TriggerStatus
from sentry.workflow_engine.migration_helpers.alert_rule import migrate_metric_action
from tests.sentry.incidents.serializers.test_workflow_engine_base import (
    TestWorkflowEngineSerializer,
)


class TestDetectorSerializer(TestWorkflowEngineSerializer):
    def setUp(self) -> None:
        super().setUp()
        self.add_warning_trigger()

    def test_simple(self) -> None:
        serialized_detector = serialize(
            self.detector, self.user, WorkflowEngineDetectorSerializer()
        )
        assert serialized_detector == self.expected

    def test_latest_incident(self) -> None:
        self.add_incident_data()
        past_incident = self.create_incident(
            alert_rule=self.alert_rule, date_started=self.now - timedelta(days=1)
        )
        IncidentTrigger.objects.create(
            incident=past_incident,
            alert_rule_trigger=self.critical_trigger,
            status=TriggerStatus.ACTIVE.value,
        )

        serialized_detector = serialize(
            self.detector,
            self.user,
            WorkflowEngineDetectorSerializer(expand=["latestIncident"]),
        )
        assert serialized_detector["latestIncident"] is not None
        assert serialized_detector["latestIncident"]["dateStarted"] == self.incident.date_started

    @patch("sentry.sentry_apps.components.SentryAppComponentPreparer.run")
    def test_sentry_app(self, mock_sentry_app_components_preparer: Any) -> None:
        sentry_app = self.create_sentry_app(
            organization=self.organization,
            published=True,
            verify_install=False,
            name="Super Awesome App",
            schema={"elements": [self.create_alert_rule_action_schema()]},
        )
        install = self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization, user=self.user
        )
        self.sentry_app_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.critical_trigger,
            type=AlertRuleTriggerAction.Type.SENTRY_APP,
            target_identifier=sentry_app.id,
            target_type=AlertRuleTriggerAction.TargetType.SENTRY_APP,
            sentry_app=sentry_app,
            sentry_app_config=[
                {"name": "title", "value": "An alert"},
            ],
        )
        self.sentry_app_action, _, _ = migrate_metric_action(self.sentry_app_trigger_action)

        # add a sentry app action and update expected actions
        sentry_app_action_data = {
            "id": str(self.sentry_app_trigger_action.id),
            "alertRuleTriggerId": str(self.critical_trigger.id),
            "type": "sentry_app",
            "targetType": "sentry_app",
            "targetIdentifier": sentry_app.id,
            "inputChannelId": None,
            "integrationId": None,
            "sentryAppId": sentry_app.id,
            "dateCreated": self.sentry_app_trigger_action.date_added,
            "desc": f"Send a notification via {sentry_app.name}",
            "priority": self.critical_action.data.get("priority"),
            "settings": [{"name": "title", "label": None, "value": "An alert"}],
            "sentryAppInstallationUuid": install.uuid,
            "formFields": {
                "type": "alert-rule-settings",
                "uri": "/sentry/alert-rule",
                "required_fields": [
                    {"type": "text", "name": "title", "label": "Title"},
                    {"type": "text", "name": "summary", "label": "Summary"},
                ],
                "optional_fields": [
                    {
                        "type": "select",
                        "name": "points",
                        "label": "Points",
                        "options": [["1", "1"], ["2", "2"], ["3", "3"], ["5", "5"], ["8", "8"]],
                    },
                    {
                        "type": "select",
                        "name": "assignee",
                        "label": "Assignee",
                        "uri": "/sentry/members",
                    },
                ],
            },
        }
        sentry_app_expected = self.expected.copy()
        expected_critical_action = self.expected_critical_action.copy()
        expected_critical_action.append(sentry_app_action_data)
        sentry_app_expected["triggers"][0]["actions"] = expected_critical_action

        serialized_detector = serialize(
            self.detector,
            self.user,
            WorkflowEngineDetectorSerializer(prepare_component_fields=True),
        )
        assert serialized_detector == sentry_app_expected
