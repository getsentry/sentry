# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from sentry.api.serializers import serialize
from sentry.api.serializers.models.alert_rule import DetailedAlertRuleSerializer
from sentry.incidents.logic import create_alert_rule, create_alert_rule_trigger
from sentry.incidents.models import AlertRuleThresholdType
from sentry.snuba.models import QueryAggregations
from sentry.testutils import TestCase


class BaseAlertRuleSerializerTest(object):
    def assert_alert_rule_serialized(self, alert_rule, result):
        assert result["id"] == six.text_type(alert_rule.id)
        assert result["organizationId"] == six.text_type(alert_rule.organization_id)
        assert result["name"] == alert_rule.name
        assert result["thresholdType"] == 0
        assert result["dataset"] == alert_rule.dataset
        assert result["query"] == alert_rule.query
        assert result["aggregation"] == alert_rule.aggregation
        assert result["timeWindow"] == alert_rule.time_window
        assert result["resolution"] == alert_rule.resolution
        assert result["alertThreshold"] == 0
        assert result["resolveThreshold"] == 0
        assert result["thresholdPeriod"] == alert_rule.threshold_period
        assert result["includeAllProjects"] == alert_rule.include_all_projects
        assert result["dateModified"] == alert_rule.date_modified
        assert result["dateAdded"] == alert_rule.date_added


class AlertRuleSerializerTest(BaseAlertRuleSerializerTest, TestCase):
    def test_simple(self):
        alert_rule = create_alert_rule(
            self.organization,
            [self.project],
            "hello",
            "level:error",
            QueryAggregations.TOTAL,
            10,
            1,
        )
        result = serialize(alert_rule)
        self.assert_alert_rule_serialized(alert_rule, result)

    def test_triggers(self):
        alert_rule = self.create_alert_rule()
        other_alert_rule = self.create_alert_rule()
        trigger = create_alert_rule_trigger(alert_rule, "test", AlertRuleThresholdType.ABOVE, 1000)
        result = serialize([alert_rule, other_alert_rule])
        assert result[0]["triggers"] == [serialize(trigger)]
        assert result[1]["triggers"] == []


class DetailedAlertRuleSerializerTest(BaseAlertRuleSerializerTest, TestCase):
    def test_simple(self):
        projects = [self.project, self.create_project()]
        alert_rule = self.create_alert_rule(projects=projects)
        result = serialize(alert_rule, serializer=DetailedAlertRuleSerializer())
        self.assert_alert_rule_serialized(alert_rule, result)
        assert sorted(result["projects"]) == sorted([p.slug for p in projects])
        assert result["excludedProjects"] == []

    def test_excluded_projects(self):
        projects = [self.project]
        excluded = [self.create_project()]
        alert_rule = self.create_alert_rule(
            projects=[], include_all_projects=True, excluded_projects=excluded
        )
        result = serialize(alert_rule, serializer=DetailedAlertRuleSerializer())
        self.assert_alert_rule_serialized(alert_rule, result)
        assert result["projects"] == [p.slug for p in projects]
        assert result["excludedProjects"] == [p.slug for p in excluded]

        alert_rule = self.create_alert_rule(projects=projects, include_all_projects=False)
        result = serialize(alert_rule, serializer=DetailedAlertRuleSerializer())
        self.assert_alert_rule_serialized(alert_rule, result)
        assert result["projects"] == [p.slug for p in projects]
        assert result["excludedProjects"] == []

    def test_triggers(self):
        alert_rule = self.create_alert_rule()
        other_alert_rule = self.create_alert_rule()
        trigger = create_alert_rule_trigger(alert_rule, "test", AlertRuleThresholdType.ABOVE, 1000)
        result = serialize([alert_rule, other_alert_rule], serializer=DetailedAlertRuleSerializer())
        assert result[0]["triggers"] == [serialize(trigger)]
        assert result[1]["triggers"] == []
