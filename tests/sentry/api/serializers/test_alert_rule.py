# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from sentry.api.serializers import serialize
from sentry.incidents.logic import create_alert_rule
from sentry.incidents.models import AlertRuleAggregations, AlertRuleThresholdType
from sentry.testutils import TestCase


class IncidentSerializerTest(TestCase):
    def test_simple(self):
        alert_rule = create_alert_rule(
            self.project,
            "hello",
            AlertRuleThresholdType.ABOVE,
            "level:error",
            [AlertRuleAggregations.TOTAL],
            10,
            1000,
            400,
            1,
        )
        result = serialize(alert_rule)

        assert result["id"] == six.text_type(alert_rule.id)
        assert result["projectId"] == six.text_type(alert_rule.project_id)
        assert result["name"] == alert_rule.name
        assert result["thresholdType"] == alert_rule.threshold_type
        assert result["dataset"] == alert_rule.dataset
        assert result["query"] == alert_rule.query
        assert result["aggregations"] == alert_rule.aggregations
        assert result["timeWindow"] == alert_rule.time_window
        assert result["resolution"] == alert_rule.resolution
        assert result["alertThreshold"] == alert_rule.alert_threshold
        assert result["resolveThreshold"] == alert_rule.resolve_threshold
        assert result["thresholdPeriod"] == alert_rule.threshold_period
        assert result["dateModified"] == alert_rule.date_modified
        assert result["dateAdded"] == alert_rule.date_added
