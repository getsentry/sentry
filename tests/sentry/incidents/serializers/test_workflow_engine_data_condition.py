from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.workflow_engine_data_condition import (
    WorkflowEngineDataConditionSerializer,
)
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
        migrate_alert_rule(self.alert_rule)
        self.detector_trigger, _ = migrate_metric_data_conditions(self.critical_trigger)
        self.resolve_conditon = migrate_resolve_threshold_data_conditions(self.alert_rule)
        self.action, _, _ = migrate_metric_action(self.critical_trigger_action)

        self.expected_trigger = {
            "id": str(self.critical_trigger.id),
            "alertRuleId": str(self.alert_rule.id),
            # "thresholdType": AlertRuleThresholdType.ABOVE.value if self.resolve_detector_trigger_data_condition.type == Condition.LESS_OR_EQUAL else AlertRuleThresholdType.BELOW.value,
            "resolveThreshold": AlertRuleThresholdType.BELOW,
            "dateCreated": self.critical_trigger.date_added,
        }
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
            "priority": self.action.data.get("priority"),
        }

    def test_simple(self) -> None:
        serialized_data_condition = serialize(
            self.detector_trigger,
            self.user,
            WorkflowEngineDataConditionSerializer(),
        )
        assert serialized_data_condition == self.expected_trigger
        serialized_action = serialized_data_condition["actions"][0]
        assert serialized_action == self.expected_actions
