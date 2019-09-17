# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from sentry.api.serializers import serialize
from sentry.api.serializers.models.alert_rule import DetailedAlertRuleSerializer
from sentry.incidents.logic import create_alert_rule
from sentry.incidents.models import AlertRuleThresholdType
from sentry.snuba.models import QueryAggregations
from sentry.testutils import TestCase


class BaseAlertRuleSerializerTest(object):
    def assert_alert_rule_serialized(self, alert_rule, result):
        assert result["id"] == six.text_type(alert_rule.id)
        assert result["organizationId"] == six.text_type(alert_rule.organization_id)
        assert result["projectId"] == six.text_type(
            alert_rule.query_subscriptions.first().project_id
        )
        assert result["name"] == alert_rule.name
        assert result["thresholdType"] == alert_rule.threshold_type
        assert result["dataset"] == alert_rule.dataset
        assert result["query"] == alert_rule.query
        assert result["aggregation"] == alert_rule.aggregation
        assert result["timeWindow"] == alert_rule.time_window
        assert result["resolution"] == alert_rule.resolution
        assert result["alertThreshold"] == alert_rule.alert_threshold
        assert result["resolveThreshold"] == alert_rule.resolve_threshold
        assert result["thresholdPeriod"] == alert_rule.threshold_period
        assert result["dateModified"] == alert_rule.date_modified
        assert result["dateAdded"] == alert_rule.date_added


class AlertRuleSerializerTest(BaseAlertRuleSerializerTest, TestCase):
    def test_simple(self):
        alert_rule = create_alert_rule(
            self.organization,
            [self.project],
            "hello",
            AlertRuleThresholdType.ABOVE,
            "level:error",
            QueryAggregations.TOTAL,
            10,
            1000,
            400,
            1,
        )
        result = serialize(alert_rule)
        self.assert_alert_rule_serialized(alert_rule, result)


class DetailedAlertRuleSerializerTest(BaseAlertRuleSerializerTest, TestCase):
    def test_simple(self):
        projects = [self.project, self.create_project()]
        alert_rule = create_alert_rule(
            self.organization,
            projects,
            "hello",
            AlertRuleThresholdType.ABOVE,
            "level:error",
            QueryAggregations.TOTAL,
            10,
            1000,
            400,
            1,
        )
        result = serialize(alert_rule, serializer=DetailedAlertRuleSerializer())
        self.assert_alert_rule_serialized(alert_rule, result)
        assert result["projects"] == [p.slug for p in projects]
