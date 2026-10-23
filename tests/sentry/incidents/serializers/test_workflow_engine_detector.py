from collections import defaultdict
from typing import Any
from unittest.mock import patch

from django.core.cache import cache

from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.utils import OFFSET, get_fake_id_from_object_id
from sentry.incidents.endpoints.serializers.workflow_engine_detector import (
    WorkflowEngineDetectorSerializer,
)
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.workflow_engine.models import Action, AlertRuleDetector, DataConditionAlertRuleTrigger
from sentry.workflow_engine.models.action_alertruletriggeraction import ActionAlertRuleTriggerAction
from tests.sentry.incidents.serializers.test_workflow_engine_base import (
    TestWorkflowEngineSerializer,
)


class TestDetectorSerializer(TestWorkflowEngineSerializer):
    def setUp(self) -> None:
        super().setUp()

    def test_simple(self) -> None:
        self.add_warning_trigger()
        serialized_detector = serialize(
            self.detector, self.user, WorkflowEngineDetectorSerializer()
        )
        assert serialized_detector == self.expected

    @patch("sentry.sentry_apps.components.SentryAppComponentPreparer.run")
    def test_sentry_app(self, mock_sentry_app_components_preparer: Any) -> None:
        self.add_warning_trigger()
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
        self.sentry_app_action = self.create_action(
            type=Action.Type.SENTRY_APP,
            config={
                "target_identifier": str(sentry_app.id),
                "target_type": ActionTarget.SENTRY_APP,
                "target_display": sentry_app.name,
            },
            data={"settings": [{"name": "title", "label": None, "value": "An alert"}]},
        )
        self.create_data_condition_group_action(
            action=self.sentry_app_action, condition_group=self.critical_action_group
        )

        other_sentry_app = self.create_sentry_app(
            organization=self.organization,
            published=True,
            verify_install=False,
            name="Not Awesome App",
            schema={"elements": [self.create_alert_rule_action_schema()]},
        )
        self.create_sentry_app_installation(
            slug=other_sentry_app.slug, organization=self.organization, user=self.user
        )
        # Clear the rpc cache for sentryapps
        cache.clear()

        # add some other workflow engine objects to ensure that our filtering is working properly
        other_detector, other_workflow, _ = self.create_metric_detector()
        _, other_action_group = self.create_metric_trigger(other_detector, other_workflow)
        self.create_email_action(other_action_group)
        other_action = self.create_action(
            type=Action.Type.SENTRY_APP,
            config={
                "target_identifier": str(other_sentry_app.id),
                "target_type": ActionTarget.SENTRY_APP,
                "target_display": other_sentry_app.name,
            },
            data={"settings": [{"name": "title", "label": None, "value": "An alert"}]},
        )
        self.create_data_condition_group_action(
            action=other_action, condition_group=other_action_group
        )

        # add a sentry app action and update expected actions
        sentry_app_action_data = {
            "id": str(get_fake_id_from_object_id(self.sentry_app_action.id)),
            "alertRuleTriggerId": str(self.legacy_critical_trigger_id),
            "type": "sentry_app",
            "targetType": "sentry_app",
            "targetIdentifier": sentry_app.id,
            "inputChannelId": None,
            "integrationId": None,
            "sentryAppId": sentry_app.id,
            "dateCreated": self.sentry_app_action.date_added,
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

    def test_snooze_enabled_detector(self) -> None:
        serialized = serialize(self.detector, self.user, WorkflowEngineDetectorSerializer())
        assert "snooze" not in serialized

    def test_snooze_disabled_detector(self) -> None:
        self.detector.update(enabled=False)
        serialized = serialize(self.detector, self.user, WorkflowEngineDetectorSerializer())
        assert serialized["snooze"] is True

    def test_orphaned_trigger_without_detector(self) -> None:
        serializer = WorkflowEngineDetectorSerializer()
        result: defaultdict[Any, dict[str, Any]] = defaultdict(dict)
        detectors = {self.detector.id: self.detector}

        serialized_data_conditions: list[dict[str, Any]] = [
            {
                "alertRuleId": None,
                "actions": [],
                "alertThreshold": "100",
                "label": "critical",
            },
        ]
        serializer.add_triggers_and_actions(result, detectors, {}, serialized_data_conditions, {})
        assert self.detector not in result

    def test_new_models_only(self) -> None:
        # test that we can still serialize if objects do not have lookup table entries
        # this is required for firing actions
        ard = AlertRuleDetector.objects.filter(detector_id=self.detector.id)
        dcart = DataConditionAlertRuleTrigger.objects.filter(
            data_condition_id=self.critical_detector_trigger.id
        )
        aarta = ActionAlertRuleTriggerAction.objects.filter(action_id=self.critical_action.id)

        ard.delete()
        dcart.delete()
        aarta.delete()

        serialized_detector = serialize(
            self.detector, self.user, WorkflowEngineDetectorSerializer()
        )
        self.expected.update({"id": str(self.detector.id + OFFSET)})
        self.expected["triggers"][0].update(
            {
                "id": str(self.critical_detector_trigger.id + OFFSET),
                "alertRuleId": str(self.detector.id + OFFSET),
            }
        )
        self.expected["triggers"][0]["actions"][0].update(
            {
                "id": str(self.critical_action.id + OFFSET),
                "alertRuleTriggerId": str(self.critical_detector_trigger.id + OFFSET),
            }
        )
        assert serialized_detector == self.expected
