from unittest.mock import patch

import pytest
import responses

from sentry.api.serializers import serialize
from sentry.incidents.logic import (
    AlertTarget,
    InvalidTriggerActionError,
    create_alert_rule_trigger,
    create_alert_rule_trigger_action,
)
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.incidents.serializers import ACTION_TARGET_TYPE_TO_STRING
from sentry.integrations.discord.client import DISCORD_BASE_URL
from sentry.integrations.discord.utils.channel import ChannelType
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
        responses.add(
            method=responses.GET,
            url=f"{DISCORD_BASE_URL}/channels/channel-id",
            json={"guild_id": "guild_id", "name": "guild_id", "type": ChannelType.GUILD_TEXT.value},
        )

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
        responses.add(
            method=responses.GET,
            url=f"{DISCORD_BASE_URL}/channels/None",
            json={
                "guild_id": "guild_id",
                "name": "guild_id",
                "type": ChannelType.GUILD_TEXT.value,
            },
        )

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
        trigger = create_alert_rule_trigger(alert_rule, "hi", 1000)
        with pytest.raises(InvalidTriggerActionError):
            create_alert_rule_trigger_action(
                trigger,
                AlertRuleTriggerAction.Type.DISCORD,
                AlertRuleTriggerAction.TargetType.SPECIFIC,
                target_identifier=None,
                integration_id=integration.id,
            )

    @patch(
        "sentry.incidents.logic.get_target_identifier_display_for_integration",
        return_value=AlertTarget("123", "test"),
    )
    def test_pagerduty_priority(self, mock_get):
        alert_rule = self.create_alert_rule()
        trigger = create_alert_rule_trigger(alert_rule, "hi", 1000)
        priority = "critical"

        # pagerduty
        action = create_alert_rule_trigger_action(
            trigger,
            AlertRuleTriggerAction.Type.PAGERDUTY,
            AlertRuleTriggerAction.TargetType.SPECIFIC,
            priority=priority,
            target_identifier="123",
        )
        result = serialize(action)
        self.assert_action_serialized(action, result)
        assert result["priority"] == priority
        assert result["desc"] == "Send a critical level PagerDuty notification to test"

    @responses.activate
    @patch(
        "sentry.incidents.logic.get_alert_rule_trigger_action_opsgenie_team",
        return_value=AlertTarget("123", "test"),
    )
    def test_opsgenie_priority(self, mock_get):
        alert_rule = self.create_alert_rule()
        trigger = create_alert_rule_trigger(alert_rule, "hi", 1000)
        priority = "critical"

        # opsgenie
        resp_data = {
            "result": "Integration [sentry] is valid",
            "took": 1,
            "requestId": "hello-world",
        }
        responses.add(
            responses.POST,
            url="https://api.opsgenie.com/v2/integrations/authenticate",
            json=resp_data,
        )
        priority = "P1"
        action = create_alert_rule_trigger_action(
            trigger,
            type=AlertRuleTriggerAction.Type.OPSGENIE,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            priority=priority,
            target_identifier="123",
        )
        result = serialize(action)
        self.assert_action_serialized(action, result)
        assert result["priority"] == priority
        assert result["desc"] == "Send a P1 level Opsgenie notification to test"
