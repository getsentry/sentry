# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from sentry.api.serializers import serialize
from sentry.api.serializers.models.alert_rule_trigger import DetailedAlertRuleTriggerSerializer
from sentry.incidents.logic import create_alert_rule_trigger
from sentry.incidents.models import AlertRuleThresholdType
from sentry.testutils import TestCase


class BaseAlertRuleTriggerSerializerTest(object):
    def assert_alert_rule_trigger_serialized(self, trigger, result):
        assert result["id"] == six.text_type(trigger.id)
        assert result["alertRuleId"] == six.text_type(trigger.alert_rule_id)
        assert result["label"] == trigger.label
        assert result["thresholdType"] == trigger.threshold_type
        assert result["alertThreshold"] == trigger.alert_threshold
        assert result["resolveThreshold"] == trigger.resolve_threshold
        assert result["dateCreated"] == trigger.date_added


class AlertRuleTriggerSerializerTest(BaseAlertRuleTriggerSerializerTest, TestCase):
    def test_simple(self):
        alert_rule = self.create_alert_rule()
        trigger = create_alert_rule_trigger(
            alert_rule, "hi", AlertRuleThresholdType.ABOVE, 1000, 200
        )
        result = serialize(trigger)
        self.assert_alert_rule_trigger_serialized(trigger, result)

    def test_decimal(self):
        alert_rule = self.create_alert_rule()
        trigger = create_alert_rule_trigger(
            alert_rule, "hi", AlertRuleThresholdType.ABOVE, 1000.50, 200.70
        )
        result = serialize(trigger)
        self.assert_alert_rule_trigger_serialized(trigger, result)


class DetailedAlertRuleTriggerSerializerTest(BaseAlertRuleTriggerSerializerTest, TestCase):
    def test_simple(self):
        alert_rule = self.create_alert_rule()
        trigger = create_alert_rule_trigger(
            alert_rule, "hi", AlertRuleThresholdType.ABOVE, 1000, 200
        )
        result = serialize(trigger, serializer=DetailedAlertRuleTriggerSerializer())
        self.assert_alert_rule_trigger_serialized(trigger, result)
        assert result["excludedProjects"] == []

    def test_excluded_projects(self):
        excluded = [self.create_project()]
        alert_rule = self.create_alert_rule(projects=excluded)
        trigger = create_alert_rule_trigger(
            alert_rule, "hi", AlertRuleThresholdType.ABOVE, 1000, 200, excluded_projects=excluded
        )
        result = serialize(trigger, serializer=DetailedAlertRuleTriggerSerializer())
        self.assert_alert_rule_trigger_serialized(trigger, result)
        assert result["excludedProjects"] == [p.slug for p in excluded]
