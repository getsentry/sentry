from sentry.api.serializers import serialize
from sentry.incidents.logic import create_alert_rule_trigger, create_alert_rule_trigger_action
from sentry.incidents.models import AlertRuleTriggerAction
from sentry.incidents.serializers import ACTION_TARGET_TYPE_TO_STRING
from sentry.testutils import TestCase


class AlertRuleTriggerActionSerializerTest(TestCase):
    def assert_action_serialized(self, action, result):
        assert result["id"] == str(action.id)
        assert result["alertRuleTriggerId"] == str(action.alert_rule_trigger_id)
        assert (
            result["type"]
            == AlertRuleTriggerAction.get_registered_type(
                AlertRuleTriggerAction.Type(action.type)
            ).slug
        )
        assert (
            result["targetType"]
            == ACTION_TARGET_TYPE_TO_STRING[AlertRuleTriggerAction.TargetType(action.target_type)]
        )
        assert result["targetIdentifier"] == action.target_identifier
        assert result["integrationId"] == action.integration_id
        assert result["dateCreated"] == action.date_added

    def test_simple(self):
        alert_rule = self.create_alert_rule()
        trigger = create_alert_rule_trigger(alert_rule, "hi", 1000)
        action = create_alert_rule_trigger_action(
            trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.SPECIFIC,
            "hello",
        )
        result = serialize(action)
        self.assert_action_serialized(action, result)
