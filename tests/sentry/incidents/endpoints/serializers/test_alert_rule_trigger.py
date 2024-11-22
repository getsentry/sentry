from sentry.api.serializers import serialize
from sentry.incidents.logic import create_alert_rule_trigger
from sentry.incidents.models.alert_rule import AlertRuleDetectionType, AlertRuleThresholdType
from sentry.testutils.cases import TestCase

NOT_SET = object()


class BaseAlertRuleTriggerSerializerTest:
    def assert_alert_rule_trigger_serialized(self, trigger, result, alert_threshold=NOT_SET):
        assert result["id"] == str(trigger.id)
        assert result["alertRuleId"] == str(trigger.alert_rule_id)
        assert result["label"] == trigger.label
        assert result["thresholdType"] == trigger.alert_rule.threshold_type
        assert result["alertThreshold"] == (
            trigger.alert_threshold if alert_threshold is NOT_SET else alert_threshold
        )
        assert result["resolveThreshold"] == trigger.alert_rule.resolve_threshold
        assert result["dateCreated"] == trigger.date_added


class AlertRuleTriggerSerializerTest(BaseAlertRuleTriggerSerializerTest, TestCase):
    def test_simple(self):
        alert_rule = self.create_alert_rule(resolve_threshold=200)
        trigger = create_alert_rule_trigger(alert_rule, "hi", 1000)
        result = serialize(trigger)
        self.assert_alert_rule_trigger_serialized(trigger, result)

    def test_decimal(self):
        alert_rule = self.create_alert_rule(resolve_threshold=200.70)
        trigger = create_alert_rule_trigger(alert_rule, "hi", 1000.50)
        result = serialize(trigger)
        self.assert_alert_rule_trigger_serialized(trigger, result)

    def test_comparison_above(self):
        alert_rule = self.create_alert_rule(
            comparison_delta=60, detection_type=AlertRuleDetectionType.PERCENT
        )
        trigger = create_alert_rule_trigger(alert_rule, "hi", 180)
        result = serialize(trigger)
        self.assert_alert_rule_trigger_serialized(trigger, result, 80)

    def test_comparison_below(self):
        alert_rule = self.create_alert_rule(
            comparison_delta=60,
            threshold_type=AlertRuleThresholdType.BELOW,
            detection_type=AlertRuleDetectionType.PERCENT,
        )
        trigger = create_alert_rule_trigger(alert_rule, "hi", 80)
        result = serialize(trigger)
        self.assert_alert_rule_trigger_serialized(trigger, result, 20)
