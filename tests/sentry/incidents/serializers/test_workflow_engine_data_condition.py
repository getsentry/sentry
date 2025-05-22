from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.workflow_engine_data_condition import (
    WorkflowEngineDataConditionSerializer,
)
from sentry.incidents.endpoints.utils import translate_data_condition_type
from sentry.incidents.models.alert_rule import AlertRule, AlertRuleTrigger, AlertRuleTriggerAction
from sentry.workflow_engine.migration_helpers.alert_rule import (
    migrate_alert_rule,
    migrate_metric_action,
    migrate_metric_data_conditions,
    migrate_resolve_threshold_data_condition,
)
from tests.sentry.incidents.serializers.test_workflow_engine_base import (
    TestWorkflowEngineSerializer,
)


class TestDataConditionSerializer(TestWorkflowEngineSerializer):
    def setUp(self) -> None:
        super().setUp()
        self.add_warning_trigger()

    def create_rule_triggers_and_actions(
        self,
    ) -> tuple[
        AlertRule,
        AlertRuleTrigger,
        AlertRuleTrigger,
        AlertRuleTriggerAction,
        AlertRuleTriggerAction,
    ]:
        alert_rule = self.create_alert_rule()
        critical_trigger = self.create_alert_rule_trigger(
            alert_rule=alert_rule, alert_threshold=500, label="critical"
        )
        critical_action = self.create_alert_rule_trigger_action(alert_rule_trigger=critical_trigger)
        warning_trigger = self.create_alert_rule_trigger(
            alert_rule=alert_rule, alert_threshold=200, label="warning"
        )
        warning_action = self.create_alert_rule_trigger_action(alert_rule_trigger=warning_trigger)

        return (
            alert_rule,
            critical_trigger,
            warning_trigger,
            critical_action,
            warning_action,
        )

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
        self.critical_trigger_action_2 = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.critical_trigger
        )
        self.critical_action_2, _, _ = migrate_metric_action(self.critical_trigger_action_2)
        serialized_data_condition = serialize(
            self.critical_detector_trigger,
            self.user,
            WorkflowEngineDataConditionSerializer(),
        )
        expected_actions = self.expected_critical_action.copy()
        actions_2 = {
            "id": str(self.critical_trigger_action_2.id),
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
        expected_actions.append(actions_2)
        expected_trigger = self.expected_triggers[0].copy()
        expected_trigger["actions"] = expected_actions
        assert serialized_data_condition == expected_trigger

    def test_comparison_delta(self) -> None:
        comparison_delta_rule = self.create_alert_rule(comparison_delta=60)
        comparison_delta_trigger = self.create_alert_rule_trigger(
            alert_rule=comparison_delta_rule, label="critical"
        )
        comparison_delta_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=comparison_delta_trigger
        )
        _, _, _, detector, _, _, _, _ = migrate_alert_rule(comparison_delta_rule)
        comparison_detector_trigger, _, _ = migrate_metric_data_conditions(comparison_delta_trigger)
        migrate_resolve_threshold_data_condition(comparison_delta_rule)
        action, _, _ = migrate_metric_action(comparison_delta_trigger_action)

        serialized_data_condition = serialize(
            comparison_detector_trigger,
            self.user,
            WorkflowEngineDataConditionSerializer(),
        )
        expected_actions = self.expected_critical_action.copy()
        expected_actions[0]["id"] = str(comparison_delta_trigger_action.id)
        expected_actions[0]["alertRuleTriggerId"] = str(comparison_delta_trigger.id)

        expected_trigger = self.expected_triggers[0].copy()
        expected_trigger["actions"] = expected_actions
        expected_trigger["alertThreshold"] = translate_data_condition_type(
            detector.config.get("comparison_delta"),
            comparison_detector_trigger.type,
            comparison_detector_trigger.comparison,
        )
        expected_trigger["id"] = str(comparison_delta_trigger.id)
        expected_trigger["alertRuleId"] = str(comparison_delta_rule.id)
        assert serialized_data_condition == expected_trigger

    def test_multiple_rules(self) -> None:
        # create another comprehensive alert rule in the DB
        alert_rule, critical_trigger, warning_trigger, critical_action, warning_action = (
            self.create_rule_triggers_and_actions()
        )
        migrate_alert_rule(alert_rule)
        critical_detector_trigger, _, _ = migrate_metric_data_conditions(critical_trigger)
        warning_detector_trigger, _, _ = migrate_metric_data_conditions(warning_trigger)
        migrate_resolve_threshold_data_condition(alert_rule)
        migrate_metric_action(critical_action)
        migrate_metric_action(warning_action)

        serialized_critical_condition = serialize(
            critical_detector_trigger,
            self.user,
            WorkflowEngineDataConditionSerializer(),
        )

        assert serialized_critical_condition["id"] == str(critical_trigger.id)
        assert serialized_critical_condition["alertRuleId"] == str(alert_rule.id)
        assert len(serialized_critical_condition["actions"]) == 1
        assert serialized_critical_condition["actions"][0]["id"] == str(critical_action.id)

        serialized_warning_condition = serialize(
            warning_detector_trigger,
            self.user,
            WorkflowEngineDataConditionSerializer(),
        )

        assert serialized_warning_condition["id"] == str(warning_trigger.id)
        assert serialized_warning_condition["alertRuleId"] == str(alert_rule.id)
        assert len(serialized_warning_condition["actions"]) == 1
        assert serialized_warning_condition["actions"][0]["id"] == str(warning_action.id)
