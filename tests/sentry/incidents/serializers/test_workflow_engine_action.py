
from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.workflow_engine_data_condition import (
    WorkflowEngineDataConditionSerializer,
)
from sentry.incidents.endpoints.utils import translate_data_condition_type
from sentry.incidents.models.alert_rule import AlertRuleThresholdType
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.workflow_engine.migration_helpers.alert_rule import (
    migrate_alert_rule,
    migrate_metric_action,
    migrate_metric_data_conditions,
    migrate_resolve_threshold_data_conditions,
)


@freeze_time("2018-12-11 03:21:34")
class TestDataConditionSerializer(TestCase):
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
        self.resolve_trigger_data_condition, _ = migrate_resolve_threshold_data_conditions(
            self.alert_rule
        )

        self.expected_actions = {
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
        self.expected_trigger = {
            "id": str(self.critical_trigger.id),
            "alertRuleId": str(self.alert_rule.id),
            "label": "critical",
            "thresholdType": AlertRuleThresholdType.ABOVE.value,
            "alertThreshold": self.critical_detector_trigger.comparison,
            "resolveThreshold": AlertRuleThresholdType.BELOW,
            "dateCreated": self.critical_trigger.date_added,
            # "actions": self.expected_actions, # use this after action serializer pr is merged
            "actions": [],
        }

    def test_simple(self) -> None:
        serialized_data_condition = serialize(
            self.critical_detector_trigger,
            self.user,
            WorkflowEngineDataConditionSerializer(),
        )
        assert serialized_data_condition == self.expected_trigger

    def test_comparison_delta(self) -> None:
        comparison_delta_rule = self.create_alert_rule(comparison_delta=60)
        comparison_delta_trigger = self.create_alert_rule_trigger(
            alert_rule=comparison_delta_rule, label="critical"
        )
        comparison_delta_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=comparison_delta_trigger
        )
        _, _, _, detector, _, _, _, _ = migrate_alert_rule(comparison_delta_rule)
        comparison_detector_trigger, _ = migrate_metric_data_conditions(comparison_delta_trigger)
        resolve_trigger_data_condition, _ = migrate_resolve_threshold_data_conditions(
            comparison_delta_rule
        )
        action, _, _ = migrate_metric_action(comparison_delta_trigger_action)

        serialized_data_condition = serialize(
            comparison_detector_trigger,
            self.user,
            WorkflowEngineDataConditionSerializer(),
        )
        expected_actions = self.expected_actions.copy()
        expected_actions["id"] = str(comparison_delta_trigger_action.id)
        expected_actions["alertRuleTriggerId"] = str(comparison_delta_trigger.id)

        expected_trigger = self.expected_trigger.copy()
        # expected_trigger["actions"] = expected_actions  # use this after action serializer pr is merged
        expected_trigger["alertThreshold"] = translate_data_condition_type(
            detector.config.get("comparison_delta"),
            comparison_detector_trigger.type,
            comparison_detector_trigger.comparison,
        )
        expected_trigger["id"] = str(comparison_delta_trigger.id)
        expected_trigger["alertRuleId"] = str(comparison_delta_rule.id)
        assert serialized_data_condition == expected_trigger

    def test_warning_trigger(self) -> None:
        serialized_data_condition = serialize(
            self.warning_detector_trigger,
            self.user,
            WorkflowEngineDataConditionSerializer(),
        )
        expected_actions = self.expected_actions.copy()
        expected_actions["id"] = str(self.warning_trigger_action.id)
        expected_actions["alertRuleTriggerId"] = str(self.warning_trigger.id)

        expected_trigger = self.expected_trigger.copy()
        # expected_trigger["actions"] = expected_actions  # use this after action serializer pr is merged
        expected_trigger["alertThreshold"] = translate_data_condition_type(
            self.detector.config.get("comparison_delta"),
            self.resolve_trigger_data_condition.type,
            self.warning_detector_trigger.comparison,
        )
        expected_trigger["id"] = str(self.warning_trigger.id)
        expected_trigger["alertRuleId"] = str(self.alert_rule.id)
        expected_trigger["label"] = "warning"
        assert serialized_data_condition == expected_trigger
