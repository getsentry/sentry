# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers import action_target_type_to_string
from sentry.incidents.logic import create_alert_rule_trigger, create_alert_rule_trigger_action
from sentry.incidents.models import AlertRuleTriggerAction
from sentry.testutils import TestCase


class AlertRuleTriggerActionSerializerTest(TestCase):
    def assert_action_serialized(self, action, result):
        assert result["id"] == six.text_type(action.id)
        assert result["alertRuleTriggerId"] == six.text_type(action.alert_rule_trigger_id)
        assert (
            result["type"]
            == AlertRuleTriggerAction.get_registered_type(
                AlertRuleTriggerAction.Type(action.type)
            ).slug
        )
        assert (
            result["targetType"]
            == action_target_type_to_string[AlertRuleTriggerAction.TargetType(action.target_type)]
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
