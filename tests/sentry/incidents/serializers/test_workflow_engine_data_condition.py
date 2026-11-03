from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.utils import get_fake_id_from_object_id
from sentry.incidents.endpoints.serializers.workflow_engine_data_condition import (
    WorkflowEngineDataConditionSerializer,
    get_resolve_thresholds,
)
from sentry.incidents.endpoints.utils import translate_data_condition_type
from sentry.incidents.models.alert_rule import AlertRuleDetectionType, AlertRuleThresholdType
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import (
    Action,
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
    Detector,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.incidents.serializers.test_workflow_engine_base import (
    TestWorkflowEngineSerializer,
)


class TestDataConditionSerializer(TestWorkflowEngineSerializer):
    def setUp(self) -> None:
        super().setUp()
        self.add_warning_trigger()

    def test_simple(self) -> None:
        serialized_data_condition = serialize(
            self.critical_detector_trigger,
            self.user,
            WorkflowEngineDataConditionSerializer(),
        )
        assert serialized_data_condition == self.expected_triggers[0]

    def test_warning_trigger(self) -> None:
        serialized_data_condition = serialize(
            self.warning_detector_trigger,
            self.user,
            WorkflowEngineDataConditionSerializer(),
        )
        assert serialized_data_condition == self.expected_triggers[1]

    def test_multiple_actions(self) -> None:
        self.critical_action_2 = self.create_email_action(self.critical_action_group)
        serialized_data_condition = serialize(
            self.critical_detector_trigger,
            self.user,
            WorkflowEngineDataConditionSerializer(),
        )
        expected_actions = self.expected_critical_action.copy()
        actions_2 = {
            "id": str(get_fake_id_from_object_id(self.critical_action_2.id)),
            "alertRuleTriggerId": str(self.legacy_critical_trigger_id),
            "type": "email",
            "targetType": "user",
            "targetIdentifier": str(self.user.id),
            "inputChannelId": None,
            "integrationId": None,
            "sentryAppId": None,
            "dateCreated": self.critical_action_2.date_added,
            "desc": f"Send a notification to {self.user.email}",
            "priority": self.critical_action.data.get("priority"),
        }
        expected_actions.append(actions_2)
        expected_trigger = self.expected_triggers[0].copy()
        expected_trigger["actions"] = expected_actions
        assert serialized_data_condition == expected_trigger

    def test_targetless_webhook_action(self) -> None:
        webhook_action = self.create_action(
            type=Action.Type.WEBHOOK,
            config={
                "target_identifier": "webhooks",
                "target_display": None,
                "target_type": None,
            },
        )
        action_filter = DataConditionGroupAction.objects.get(
            action=self.critical_action
        ).condition_group
        self.create_data_condition_group_action(
            action=webhook_action,
            condition_group=action_filter,
        )

        serialized_data_condition = serialize(
            self.critical_detector_trigger,
            self.user,
            WorkflowEngineDataConditionSerializer(),
        )

        serialized_webhook_action = next(
            action
            for action in serialized_data_condition["actions"]
            if action["type"] == Action.Type.WEBHOOK
        )
        assert serialized_webhook_action["targetType"] is None

    def test_action_filter_without_priority_condition(self) -> None:
        """
        A natively-created connected alert (workflow) seeds its action filter with no conditions
        (see automationBuilderContext.tsx) if they don't include an Issue Priority WHEN clause.
        Priority-less action filter should fire for any priority. Previously these actions were dropped,
        producing an empty `triggers[].actions` in the metric_alert webhook payload
        """
        sentry_app = self.create_sentry_app(
            organization=self.organization,
            published=True,
            verify_install=False,
            name="Super Awesome App",
            schema={"elements": [self.create_alert_rule_action_schema()]},
        )
        self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization, user=self.user
        )
        settings = [{"name": "title", "value": "An alert"}]
        sentry_app_action = self.create_action(
            type=Action.Type.SENTRY_APP,
            config={
                "target_type": ActionTarget.SENTRY_APP,
                "target_identifier": str(sentry_app.id),
                "target_display": None,
            },
            data={"settings": settings},
        )

        # Connect a native workflow to the existing detector whose action filter has no
        # priority (or any) condition, mirroring how the new Monitors UI creates connected alerts.
        workflow = self.create_workflow(organization=self.organization)
        self.create_detector_workflow(detector=self.detector, workflow=workflow)
        action_filter = self.create_data_condition_group(
            organization=self.organization, logic_type=DataConditionGroup.Type.ALL
        )
        self.create_workflow_data_condition_group(workflow=workflow, condition_group=action_filter)
        self.create_data_condition_group_action(
            action=sentry_app_action, condition_group=action_filter
        )

        serialized_data_condition = serialize(
            self.critical_detector_trigger,
            self.user,
            WorkflowEngineDataConditionSerializer(),
        )

        serialized_sentry_app_actions = [
            action
            for action in serialized_data_condition["actions"]
            if action["sentryAppId"] == sentry_app.id
        ]
        assert len(serialized_sentry_app_actions) == 1
        serialized_sentry_app_action = serialized_sentry_app_actions[0]
        assert serialized_sentry_app_action["type"] == "sentry_app"
        assert serialized_sentry_app_action["targetType"] == "sentry_app"
        assert serialized_sentry_app_action["settings"] == settings

    def test_comparison_delta(self) -> None:
        detector, workflow, _ = self.create_metric_detector(
            comparison_delta=3600, detection_type=AlertRuleDetectionType.PERCENT
        )
        trigger, action_group = self.create_metric_trigger(detector, workflow)
        action = self.create_email_action(action_group)
        self.create_data_condition(
            condition_group=detector.workflow_condition_group,
            type=Condition.LESS_OR_EQUAL,
            comparison=100,
            condition_result=DetectorPriorityLevel.OK,
        )
        serialized = serialize(trigger, self.user, WorkflowEngineDataConditionSerializer())
        trigger_id = get_fake_id_from_object_id(trigger.id)
        expected_action = {
            **self.expected_critical_action[0],
            "id": str(get_fake_id_from_object_id(action.id)),
            "alertRuleTriggerId": str(trigger_id),
            "dateCreated": action.date_added,
        }
        threshold = translate_data_condition_type(
            detector.config["comparison_delta"], trigger.type, trigger.comparison
        )
        expected_trigger = {
            **self.expected_triggers[0],
            "id": str(trigger_id),
            "alertRuleId": str(get_fake_id_from_object_id(detector.id)),
            "alertThreshold": threshold,
            "resolveThreshold": threshold,
            "dateCreated": trigger.date_added,
            "actions": [expected_action],
        }
        assert serialized == expected_trigger

    def test_comparison_delta_with_gte_lte_conditions(self) -> None:
        for condition_type, expected_threshold_type in (
            (Condition.GREATER_OR_EQUAL, AlertRuleThresholdType.ABOVE),
            (Condition.LESS_OR_EQUAL, AlertRuleThresholdType.BELOW),
        ):
            detector, workflow, _ = self.create_metric_detector(
                comparison_delta=3600, detection_type=AlertRuleDetectionType.PERCENT
            )
            trigger, _ = self.create_metric_trigger(detector, workflow)
            trigger.update(type=condition_type)
            serialized = serialize(trigger, self.user, WorkflowEngineDataConditionSerializer())
            assert serialized["thresholdType"] == expected_threshold_type.value

    def create_dynamic_detector(self) -> tuple[Detector, DataCondition, Action]:
        detector, workflow, _ = self.create_metric_detector(
            detection_type=AlertRuleDetectionType.DYNAMIC
        )
        trigger, action_group = self.create_metric_trigger(detector, workflow, threshold=0)
        trigger.update(
            type=Condition.ANOMALY_DETECTION,
            comparison={
                "sensitivity": "high",
                "seasonality": "auto",
                "threshold_type": AlertRuleThresholdType.ABOVE_AND_BELOW.value,
            },
        )
        action = self.create_email_action(action_group)
        return detector, trigger, action

    def test_anomaly_detection(self) -> None:
        detector, detector_trigger, action = self.create_dynamic_detector()

        serialized_data_condition = serialize(
            detector_trigger,
            self.user,
            WorkflowEngineDataConditionSerializer(),
        )
        assert (
            serialized_data_condition["thresholdType"]
            == AlertRuleThresholdType.ABOVE_AND_BELOW.value
        )
        assert serialized_data_condition["alertThreshold"] == 0
        assert serialized_data_condition["resolveThreshold"] is None

    def test_anomaly_detection_with_workflow_actions(self) -> None:
        detector, detector_trigger, action = self.create_dynamic_detector()

        workflow_dcg = WorkflowDataConditionGroup.objects.filter(
            workflow__detectorworkflow__detector=detector,
        ).first()
        assert workflow_dcg is not None
        self.create_data_condition(
            type=Condition.ANOMALY_DETECTION,
            comparison={"sensitivity": "high", "seasonality": "auto", "threshold_type": 2},
            condition_result=True,
            condition_group=workflow_dcg.condition_group,
        )

        serialized = serialize(
            detector_trigger,
            self.user,
            WorkflowEngineDataConditionSerializer(),
        )
        assert serialized["thresholdType"] == AlertRuleThresholdType.ABOVE_AND_BELOW.value
        assert serialized["alertThreshold"] == 0
        assert serialized["resolveThreshold"] is None
        # The non-numeric ANOMALY_DETECTION condition is skipped during matching without dropping
        # the DCG's action (which still matches via the priority condition) or duplicating it.
        action_ids = [action["id"] for action in serialized["actions"]]
        assert action_ids == [str(get_fake_id_from_object_id(action.id))]

    def test_multiple_rules(self) -> None:
        detector, workflow, _ = self.create_metric_detector()
        critical, critical_group = self.create_metric_trigger(detector, workflow, threshold=500)
        warning, warning_group = self.create_metric_trigger(
            detector, workflow, threshold=200, priority=DetectorPriorityLevel.MEDIUM
        )
        critical_action = self.create_email_action(critical_group)
        warning_action = self.create_email_action(warning_group)
        self.create_data_condition(
            condition_group=detector.workflow_condition_group,
            type=Condition.LESS_OR_EQUAL,
            comparison=200,
            condition_result=DetectorPriorityLevel.OK,
        )
        critical_payload = serialize(critical, self.user, WorkflowEngineDataConditionSerializer())
        warning_payload = serialize(warning, self.user, WorkflowEngineDataConditionSerializer())
        assert critical_payload["id"] == str(get_fake_id_from_object_id(critical.id))
        assert warning_payload["id"] == str(get_fake_id_from_object_id(warning.id))
        assert (
            critical_payload["alertRuleId"]
            == warning_payload["alertRuleId"]
            == str(get_fake_id_from_object_id(detector.id))
        )
        assert [action["id"] for action in critical_payload["actions"]] == [
            str(get_fake_id_from_object_id(critical_action.id))
        ]
        assert [action["id"] for action in warning_payload["actions"]] == [
            str(get_fake_id_from_object_id(warning_action.id))
        ]

    def test_missing_detector(self) -> None:
        self.detector.delete()

        serialized = serialize(
            self.critical_detector_trigger,
            self.user,
            WorkflowEngineDataConditionSerializer(),
        )
        assert serialized["alertThreshold"] == float(self.critical_detector_trigger.comparison)
        assert serialized["resolveThreshold"] is not None
        assert serialized["alertRuleId"] is None

    def test_missing_resolve_condition(self) -> None:
        # Delete the resolve condition created during setUp
        DataCondition.objects.filter(
            condition_group=self.critical_detector_trigger.condition_group,
            condition_result=DetectorPriorityLevel.OK,
        ).delete()

        serialized = serialize(
            self.critical_detector_trigger,
            self.user,
            WorkflowEngineDataConditionSerializer(),
        )
        assert serialized["resolveThreshold"] is None


class GetResolveThresholdsTest(TestCase):
    def test_empty_input(self) -> None:
        assert get_resolve_thresholds([]) == {}

    def test_single_group_with_resolve_condition(self) -> None:
        dcg = self.create_data_condition_group(organization=self.organization)
        self.create_data_condition(
            condition_group=dcg,
            condition_result=DetectorPriorityLevel.OK,
            comparison=5.0,
            type="gte",
        )

        assert get_resolve_thresholds([dcg]) == {dcg.id: 5.0}

    def test_single_group_without_resolve_condition(self) -> None:
        dcg = self.create_data_condition_group(organization=self.organization)
        self.create_data_condition(
            condition_group=dcg,
            condition_result=DetectorPriorityLevel.HIGH,
            comparison=100.0,
            type="gte",
        )

        assert get_resolve_thresholds([dcg]) == {}

    def test_multiple_groups_mixed(self) -> None:
        dcg1 = self.create_data_condition_group(organization=self.organization)
        dcg2 = self.create_data_condition_group(organization=self.organization)
        dcg3 = self.create_data_condition_group(organization=self.organization)

        self.create_data_condition(
            condition_group=dcg1,
            condition_result=DetectorPriorityLevel.OK,
            comparison=10.0,
            type="gte",
        )
        self.create_data_condition(
            condition_group=dcg2,
            condition_result=DetectorPriorityLevel.HIGH,
            comparison=200.0,
            type="gte",
        )
        self.create_data_condition(
            condition_group=dcg3,
            condition_result=DetectorPriorityLevel.OK,
            comparison=25.0,
            type="gte",
        )

        assert get_resolve_thresholds([dcg1, dcg2, dcg3]) == {
            dcg1.id: 10.0,
            dcg3.id: 25.0,
        }
