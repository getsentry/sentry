from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.alert_rule_trigger import AlertRuleTriggerSerializer
from sentry.incidents.endpoints.serializers.workflow_engine_data_condition import (
    WorkflowEngineDataConditionSerializer,
)
from sentry.incidents.grouptype import MetricAlertFire
from sentry.incidents.models.alert_rule import AlertRuleThresholdType
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time

# from sentry.workflow_engine.migration_helpers.alert_rule import get_threshold_type
from sentry.workflow_engine.models import Action, ActionAlertRuleTriggerAction, AlertRuleDetector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


@freeze_time("2018-12-11 03:21:34")
class TestDataConditionSerializer(TestCase):
    def setUp(self) -> None:
        self.alert_rule = self.create_alert_rule()
        self.warning_trigger = self.create_alert_rule_trigger(
            alert_rule=self.alert_rule, label="warning"
        )
        self.critical_trigger = self.create_alert_rule_trigger(
            alert_rule=self.alert_rule, label="critical"
        )

        self.data_condition_group = self.create_data_condition_group()

        self.warning_detector_trigger_data_condition = self.create_data_condition(
            condition_group=self.data_condition_group,
            condition_result=DetectorPriorityLevel.MEDIUM,
            comparison=self.warning_trigger.alert_threshold,
        )
        self.warning_action_filter_data_condition = self.create_data_condition(
            condition_group=self.data_condition_group,
            comparison=DetectorPriorityLevel.MEDIUM,
            type=Condition.ISSUE_PRIORITY_EQUALS,
            condition_result=True,
        )
        self.critical_detector_trigger_data_condition = self.create_data_condition(
            condition_group=self.data_condition_group,
            condition_result=DetectorPriorityLevel.HIGH,
            comparison=self.critical_trigger.alert_threshold,
        )
        self.critical_action_filter_data_condition = self.create_data_condition(
            condition_group=self.data_condition_group,
            comparison=DetectorPriorityLevel.HIGH,
            type=Condition.ISSUE_PRIORITY_EQUALS,
            condition_result=True,
        )
        # XXX: these resolve data conditions assume that self.alert_rule.resolve_threshold is None
        self.resolve_detector_trigger_data_condition = self.create_data_condition(
            condition_group=self.data_condition_group,
            comparison=self.critical_trigger.alert_threshold,
            condition_result=DetectorPriorityLevel.OK,
            type=(
                Condition.LESS_OR_EQUAL
                if self.alert_rule.threshold_type == AlertRuleThresholdType.ABOVE.value
                else Condition.GREATER_OR_EQUAL
            ),
        )
        self.resolve_action_filter_data_condition = self.create_data_condition(
            condition_group=self.data_condition_group,
            comparison=DetectorPriorityLevel.OK,
            condition_result=True,
            type=Condition.ISSUE_PRIORITY_EQUALS,
        )

        self.detector = self.create_detector(
            project_id=self.project.id,
            name="Test Detector",
            type=MetricAlertFire.slug,
            workflow_condition_group=self.data_condition_group,
        )

        self.action = self.create_action(
            type=Action.Type.EMAIL.value,
            target_type=ActionTarget.USER,
            target_identifier=self.user.id,
        )
        self.create_data_condition_group_action(
            condition_group=self.data_condition_group,
            action=self.action,
        )
        AlertRuleDetector.objects.create(alert_rule=self.alert_rule, detector=self.detector)

        self.warning_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.warning_trigger
        )
        ActionAlertRuleTriggerAction.objects.create(
            action_id=self.action.id,
            alert_rule_trigger_action_id=self.warning_trigger_action.id,
        )
        self.critical_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.critical_trigger
        )
        ActionAlertRuleTriggerAction.objects.create(
            action_id=self.action.id,
            alert_rule_trigger_action_id=self.critical_trigger_action.id,
        )

    def test_simple(self) -> None:
        serialized_data_condition = serialize(
            self.warning_detector_trigger_data_condition,
            self.user,
            WorkflowEngineDataConditionSerializer(),
        )
        assert serialized_data_condition["id"] == str(self.warning_trigger.id)
        assert serialized_data_condition["alertRuleId"] == str(self.alert_rule.id)
        assert (
            serialized_data_condition["thresholdType"] == AlertRuleThresholdType.ABOVE.value
            if self.resolve_detector_trigger_data_condition.type == Condition.LESS_OR_EQUAL
            else AlertRuleThresholdType.BELOW.value
        )
        assert (
            serialized_data_condition["resolveThreshold"] is None
            if self.alert_rule.resolve_threshold is None
            else self.warning_trigger.alert_threshold
        )
        assert serialized_data_condition["dateCreated"] == self.warning_trigger.date_added

        serialized_alert_rule_trigger = serialize(
            self.warning_trigger, self.user, AlertRuleTriggerSerializer()
        )
        assert serialized_data_condition == serialized_alert_rule_trigger
