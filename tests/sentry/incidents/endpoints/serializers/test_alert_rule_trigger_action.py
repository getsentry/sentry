from sentry.api.serializers import serialize
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.incidents.serializers import ACTION_TARGET_TYPE_TO_STRING
from sentry.testutils.cases import TestCase


class AlertRuleTriggerActionSerializerTest(TestCase):
    def assert_action_serialized(self, action, result):
        assert result["id"] == str(action.id)
        assert result["alertRuleTriggerId"] == str(action.alert_rule_trigger_id)
        assert (
            result["type"]
            == AlertRuleTriggerAction.get_registered_factory(
                AlertRuleTriggerAction.Type(action.type)
            ).slug
        )
        assert (
            result["targetType"]
            == ACTION_TARGET_TYPE_TO_STRING[AlertRuleTriggerAction.TargetType(action.target_type)]
        )
        assert (
            result["targetIdentifier"] == action.target_identifier
            if not action.target_identifier
            else str(action.target_identifier)
        )
        assert result["integrationId"] == action.integration_id
        assert result["dateCreated"] == action.date_added

    def test_simple(self) -> None:
        alert_rule = self.create_alert_rule()
        trigger = self.create_alert_rule_trigger(
            alert_rule=alert_rule, label="hi", alert_threshold=1000
        )
        action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger,
            type=AlertRuleTriggerAction.Type.EMAIL,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            target_identifier="hello",
        )
        result = serialize(action)
        self.assert_action_serialized(action, result)
        assert result["desc"] == "Send an email to [removed]"

    def test_discord(self) -> None:
        alert_rule = self.create_alert_rule()
        integration = self.create_provider_integration(
            provider="discord",
            name="Example Discord",
            external_id="guild_id",
            metadata={
                "guild_id": "guild_id",
                "name": "guild_name",
            },
        )
        trigger = self.create_alert_rule_trigger(
            alert_rule=alert_rule, label="hi", alert_threshold=1000
        )
        action = self.create_alert_rule_trigger_action(alert_rule_trigger=trigger)
        action.update(
            type=AlertRuleTriggerAction.Type.DISCORD.value,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC.value,
            target_identifier="channel-id",
            target_display="guild_id",
            integration_id=integration.id,
        )

        result = serialize(action)
        self.assert_action_serialized(action, result)
        assert str(action.target_display) in result["desc"]

    def test_pagerduty_priority(self) -> None:
        alert_rule = self.create_alert_rule()
        trigger = self.create_alert_rule_trigger(
            alert_rule=alert_rule, label="hi", alert_threshold=1000
        )
        priority = "critical"

        action = self.create_alert_rule_trigger_action(alert_rule_trigger=trigger)
        action.update(
            type=AlertRuleTriggerAction.Type.PAGERDUTY.value,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC.value,
            target_identifier="123",
            target_display="test",
            sentry_app_config={"priority": priority},
        )
        result = serialize(action)
        self.assert_action_serialized(action, result)
        assert result["priority"] == priority

    def test_pagerduty_no_priority(self) -> None:
        alert_rule = self.create_alert_rule()
        trigger = self.create_alert_rule_trigger(
            alert_rule=alert_rule, label="hi", alert_threshold=1000
        )
        action = self.create_alert_rule_trigger_action(alert_rule_trigger=trigger)
        action.update(
            type=AlertRuleTriggerAction.Type.PAGERDUTY.value,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC.value,
            target_identifier="123",
            target_display="test",
        )
        result = serialize(action)
        self.assert_action_serialized(action, result)
        assert result["priority"] is None
        assert "None" not in result["desc"]
        assert result["desc"] == "Send a PagerDuty notification to test"

    def test_opsgenie_priority(self) -> None:
        alert_rule = self.create_alert_rule()
        trigger = self.create_alert_rule_trigger(
            alert_rule=alert_rule, label="hi", alert_threshold=1000
        )
        priority = "P1"
        action = self.create_alert_rule_trigger_action(alert_rule_trigger=trigger)
        action.update(
            type=AlertRuleTriggerAction.Type.OPSGENIE.value,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC.value,
            target_identifier="123",
            target_display="test",
            sentry_app_config={"priority": priority},
        )
        result = serialize(action)
        self.assert_action_serialized(action, result)
        assert result["priority"] == priority
        assert result["desc"] == "Send a P1 level Opsgenie notification to test"
