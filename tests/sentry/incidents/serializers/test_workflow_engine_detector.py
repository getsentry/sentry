from datetime import timedelta
from typing import Any
from unittest.mock import patch

from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.workflow_engine_detector import (
    WorkflowEngineDetectorSerializer,
)
from sentry.incidents.models.alert_rule import (
    AlertRuleStatus,
    AlertRuleThresholdType,
    AlertRuleTriggerAction,
)
from sentry.incidents.models.incident import IncidentTrigger, TriggerStatus
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.migration_helpers.alert_rule import (
    migrate_alert_rule,
    migrate_metric_action,
    migrate_metric_data_conditions,
    migrate_resolve_threshold_data_condition,
)
from sentry.workflow_engine.models import ActionGroupStatus


@freeze_time("2024-12-11 03:21:34")
class TestDetectorSerializer(TestCase):
    def setUp(self) -> None:
        self.alert_rule = self.create_alert_rule()
        self.critical_trigger = self.create_alert_rule_trigger(
            alert_rule=self.alert_rule, label="critical"
        )
        self.critical_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.critical_trigger
        )
        self.warning_trigger = self.create_alert_rule_trigger(
            alert_rule=self.alert_rule, label="warning"
        )
        self.warning_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.warning_trigger
        )
        _, _, _, self.detector, _, _, _, _ = migrate_alert_rule(self.alert_rule)
        self.critical_detector_trigger, _ = migrate_metric_data_conditions(self.critical_trigger)
        self.warning_detector_trigger, _ = migrate_metric_data_conditions(self.warning_trigger)

        self.critical_action, _, _ = migrate_metric_action(self.critical_trigger_action)
        self.warning_action, _, _ = migrate_metric_action(self.warning_trigger_action)
        self.resolve_trigger_data_condition = migrate_resolve_threshold_data_condition(
            self.alert_rule
        )
        self.expected_critical_action = [
            {
                "id": str(self.critical_trigger_action.id),
                "alertRuleTriggerId": str(self.critical_trigger.id),
                "type": "email",
                "targetType": "user",
                "targetIdentifier": str(self.user.id),
                "inputChannelId": None,
                "integrationId": None,
                "sentryAppId": None,
                "dateCreated": self.critical_trigger_action.date_added,
                "desc": f"Send a notification to {self.user.email}",
                "priority": self.critical_action.data.get("priority"),
            }
        ]
        self.expected_warning_action = [
            {
                "id": str(self.warning_trigger_action.id),
                "alertRuleTriggerId": str(self.warning_trigger.id),
                "type": "email",
                "targetType": "user",
                "targetIdentifier": str(self.user.id),
                "inputChannelId": None,
                "integrationId": None,
                "sentryAppId": None,
                "dateCreated": self.warning_trigger_action.date_added,
                "desc": f"Send a notification to {self.user.email}",
                "priority": self.warning_action.data.get("priority"),
            }
        ]
        self.expected_triggers = [
            {
                "id": str(self.critical_trigger.id),
                "alertRuleId": str(self.alert_rule.id),
                "label": "critical",
                "thresholdType": AlertRuleThresholdType.ABOVE.value,
                "alertThreshold": self.critical_detector_trigger.comparison,
                "resolveThreshold": AlertRuleThresholdType.BELOW,
                "dateCreated": self.critical_trigger.date_added,
                "actions": self.expected_critical_action,
            },
            {
                "id": str(self.warning_trigger.id),
                "alertRuleId": str(self.alert_rule.id),
                "label": "warning",
                "thresholdType": AlertRuleThresholdType.ABOVE.value,
                "alertThreshold": self.critical_detector_trigger.comparison,
                "resolveThreshold": AlertRuleThresholdType.BELOW,
                "dateCreated": self.critical_trigger.date_added,
                "actions": self.expected_warning_action,
            },
        ]

        self.expected = {
            "id": str(self.alert_rule.id),
            "name": self.detector.name,
            "organizationId": self.detector.project.organization_id,
            "status": AlertRuleStatus.PENDING.value,
            "query": self.alert_rule.snuba_query.query,
            "aggregate": self.alert_rule.snuba_query.aggregate,
            "timeWindow": self.alert_rule.snuba_query.time_window,
            "resolution": self.alert_rule.snuba_query.resolution,
            "thresholdPeriod": self.detector.config.get("thresholdPeriod"),
            "triggers": self.expected_triggers,
            "projects": [self.project.slug],
            "owner": self.detector.owner_user_id,
            "dateModified": self.detector.date_updated,
            "dateCreated": self.detector.date_added,
            "createdBy": {},
            "description": self.detector.description or "",
            "detectionType": self.detector.type,
        }

    def test_simple(self) -> None:
        serialized_detector = serialize(
            self.detector, self.user, WorkflowEngineDetectorSerializer()
        )
        assert serialized_detector == self.expected

    def test_latest_incident(self) -> None:
        now = timezone.now()
        incident = self.create_incident(alert_rule=self.alert_rule, date_started=now)
        IncidentTrigger.objects.create(
            incident=incident,
            alert_rule_trigger=self.critical_trigger,
            status=TriggerStatus.ACTIVE.value,
        )

        past_incident = self.create_incident(
            alert_rule=self.alert_rule, date_started=now - timedelta(days=1)
        )
        IncidentTrigger.objects.create(
            incident=past_incident,
            alert_rule_trigger=self.critical_trigger,
            status=TriggerStatus.ACTIVE.value,
        )

        self.group.priority = PriorityLevel.HIGH
        self.group.save()
        ActionGroupStatus.objects.create(action=self.critical_action, group=self.group)
        GroupOpenPeriod.objects.create(
            group=self.group, project=self.detector.project, date_started=incident.date_started
        )
        GroupOpenPeriod.objects.create(
            group=self.group, project=self.detector.project, date_started=past_incident.date_started
        )

        serialized_detector = serialize(
            self.detector,
            self.user,
            WorkflowEngineDetectorSerializer(expand=["latestIncident"]),
        )
        assert serialized_detector["latestIncident"] is not None
        assert serialized_detector["latestIncident"]["dateStarted"] == incident.date_started

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
