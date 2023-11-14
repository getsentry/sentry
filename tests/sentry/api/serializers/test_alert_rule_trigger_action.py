import responses

from sentry.api.serializers import serialize
from sentry.incidents.logic import create_alert_rule_trigger, create_alert_rule_trigger_action
from sentry.incidents.models import AlertRuleTriggerAction
from sentry.incidents.serializers import ACTION_TARGET_TYPE_TO_STRING
from sentry.integrations.discord.utils.channel import ChannelType
from sentry.models.integrations.integration import Integration
from sentry.testutils.cases import TestCase


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
        assert result["desc"] == action.target_display

    @responses.activate
    def test_discord(self):
        base_url: str = "https://discord.com/api/v10"
        responses.add(
            method=responses.GET,
            url=f"{base_url}/channels/channel-id",
            json={"guild_id": "guild_id", "name": "guild_id", "type": ChannelType.GUILD_TEXT.value},
        )

        alert_rule = self.create_alert_rule()
        integration = Integration.objects.create(
            provider="discord",
            name="Example Discord",
            external_id="guild_id",
            metadata={
                "guild_id": "guild_id",
                "name": "guild_name",
            },
        )
        trigger = create_alert_rule_trigger(alert_rule, "hi", 1000)
        action = create_alert_rule_trigger_action(
            trigger,
            AlertRuleTriggerAction.Type.DISCORD,
            AlertRuleTriggerAction.TargetType.SPECIFIC,
            target_identifier="channel-id",
            integration_id=integration.id,
        )

        result = serialize(action)
        self.assert_action_serialized(action, result)
        assert str(action.target_display) in result["desc"]

    @responses.activate
    def test_discord_channel_id_none(self):
        base_url: str = "https://discord.com/api/v10"
        responses.add(
            method=responses.GET,
            url=f"{base_url}/channels/None",
            json={
                "guild_id": "guild_id",
                "name": "guild_id",
                "type": ChannelType.GUILD_TEXT.value,
            },
        )

        alert_rule = self.create_alert_rule()
        integration = Integration.objects.create(
            provider="discord",
            name="Example Discord",
            external_id="guild_id",
            metadata={
                "guild_id": "guild_id",
                "name": "guild_name",
            },
        )
        trigger = create_alert_rule_trigger(alert_rule, "hi", 1000)
        action = create_alert_rule_trigger_action(
            trigger,
            AlertRuleTriggerAction.Type.DISCORD,
            AlertRuleTriggerAction.TargetType.SPECIFIC,
            target_identifier=None,
            integration_id=integration.id,
        )

        result = serialize(action)
        self.assert_action_serialized(action, result)
        assert result["desc"] == "Send a Discord notification to "
