from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.alert_rule_trigger import AlertRuleTriggerSerializer
from sentry.incidents.endpoints.serializers.workflow_engine_data_condition import (
    WorkflowEngineDataConditionSerializer,
)
from sentry.incidents.grouptype import MetricAlertFire
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.workflow_engine.migration_helpers.alert_rule import get_threshold_type
from sentry.workflow_engine.models import Action, ActionAlertRuleTriggerAction, AlertRuleDetector


@freeze_time("2018-12-11 03:21:34")
class TestDataConditionSerializer(TestCase):
    def setUp(self) -> None:
        self.alert_rule = self.create_alert_rule()
        self.trigger = self.create_alert_rule_trigger(alert_rule=self.alert_rule)

        self.data_condition_group = self.create_data_condition_group()
        self.data_condition = self.create_data_condition(condition_group=self.data_condition_group)
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
        self.trigger_action = self.create_alert_rule_trigger_action(alert_rule_trigger=self.trigger)
        ActionAlertRuleTriggerAction.objects.create(
            action_id=self.action.id,
            alert_rule_trigger_action_id=self.trigger_action.id,
        )

    def test_simple(self) -> None:
        serialized_data_condition = serialize(
            self.data_condition, self.user, WorkflowEngineDataConditionSerializer()
        )
        assert serialized_data_condition["id"] == str(self.trigger.id)
        assert serialized_data_condition["alertRuleId"] == str(self.alert_rule.id)
        assert serialized_data_condition["thresholdType"] == get_threshold_type(
            self.data_condition.type
        )
        # assert serialized_data_condition["resolveThreshold"] == self.alert_rule.resolve_threshold
        assert serialized_data_condition["dateCreated"] == self.trigger.date_added
        # assert serialized_data_condition["actions"] == {}

        # assert serialized_action["targetType"] == "user"
        # assert serialized_action["targetIdentifier"] == str(self.user.id)

        serialized_alert_rule_trigger = serialize(
            self.trigger, self.user, AlertRuleTriggerSerializer()
        )
        assert serialized_data_condition == serialized_alert_rule_trigger
