# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from sentry.api.serializers import serialize
from sentry.api.serializers.models.alert_rule import (
    DetailedAlertRuleSerializer,
    CombinedRuleSerializer,
)
from sentry.models import Rule
from sentry.incidents.logic import create_alert_rule_trigger
from sentry.incidents.models import AlertRuleThresholdType, AlertRule
from sentry.testutils import TestCase, APITestCase


class BaseAlertRuleSerializerTest(object):
    def assert_alert_rule_serialized(self, alert_rule, result, skip_dates=False):
        alert_rule_projects = sorted(
            AlertRule.objects.filter(id=alert_rule.id).values_list(
                "snuba_query__subscriptions__project__slug", flat=True
            )
        )
        assert result["id"] == six.text_type(alert_rule.id)
        assert result["organizationId"] == six.text_type(alert_rule.organization_id)
        assert result["name"] == alert_rule.name
        assert result["dataset"] == alert_rule.snuba_query.dataset
        assert result["query"] == alert_rule.snuba_query.query
        assert result["aggregate"] == alert_rule.snuba_query.aggregate
        assert result["thresholdType"] == alert_rule.threshold_type
        assert result["resolveThreshold"] == alert_rule.resolve_threshold
        assert result["timeWindow"] == alert_rule.snuba_query.time_window / 60
        assert result["resolution"] == alert_rule.snuba_query.resolution / 60
        assert result["thresholdPeriod"] == alert_rule.threshold_period
        assert result["projects"] == alert_rule_projects
        assert result["includeAllProjects"] == alert_rule.include_all_projects
        if alert_rule.created_by:
            assert result["createdBy"] == {
                "id": alert_rule.created_by.id,
                "name": alert_rule.created_by.get_display_name(),
                "email": alert_rule.created_by.email,
            }
        else:
            assert result["createdBy"] is None
        if not skip_dates:
            assert result["dateModified"] == alert_rule.date_modified
            assert result["dateCreated"] == alert_rule.date_added
        if alert_rule.snuba_query.environment:
            assert result["environment"] == alert_rule.snuba_query.environment.name
        else:
            assert result["environment"] is None

    def create_issue_alert_rule(self, data):
        """data format
        {
            "project": project
            "environment": environment
            "name": "My rule name",
            "conditions": [],
            "actions": [],
            "actionMatch": "all"
        }
        """
        rule = Rule()
        rule.project = data["project"]
        if "environment" in data:
            environment = data["environment"]
            rule.environment_id = int(environment) if environment else environment
        if data.get("name"):
            rule.label = data["name"]
        if data.get("actionMatch"):
            rule.data["action_match"] = data["actionMatch"]
        if data.get("actions") is not None:
            rule.data["actions"] = data["actions"]
        if data.get("conditions") is not None:
            rule.data["conditions"] = data["conditions"]
        if data.get("frequency"):
            rule.data["frequency"] = data["frequency"]
        if data.get("date_added"):
            rule.date_added = data["date_added"]

        rule.save()
        return rule


class AlertRuleSerializerTest(BaseAlertRuleSerializerTest, TestCase):
    def test_simple(self):
        alert_rule = self.create_alert_rule()
        result = serialize(alert_rule)
        self.assert_alert_rule_serialized(alert_rule, result)

    def test_threshold_type_resolve_threshold(self):
        alert_rule = self.create_alert_rule(
            threshold_type=AlertRuleThresholdType.BELOW, resolve_threshold=500
        )
        result = serialize(alert_rule)
        self.assert_alert_rule_serialized(alert_rule, result)

    def test_triggers(self):
        alert_rule = self.create_alert_rule()
        other_alert_rule = self.create_alert_rule()
        trigger = create_alert_rule_trigger(alert_rule, "test", 1000)
        result = serialize([alert_rule, other_alert_rule])
        assert result[0]["triggers"] == [serialize(trigger)]
        assert result[1]["triggers"] == []

    def test_environment(self):
        alert_rule = self.create_alert_rule(environment=self.environment)
        result = serialize(alert_rule)
        self.assert_alert_rule_serialized(alert_rule, result)

    def test_created_by(self):
        user = self.create_user("foo@example.com")
        alert_rule = self.create_alert_rule(environment=self.environment, user=user)
        result = serialize(alert_rule)
        self.assert_alert_rule_serialized(alert_rule, result)
        assert alert_rule.created_by == user


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
        trigger = create_alert_rule_trigger(alert_rule, "test", 1000)
        result = serialize([alert_rule, other_alert_rule], serializer=DetailedAlertRuleSerializer())
        assert result[0]["triggers"] == [serialize(trigger)]
        assert result[1]["triggers"] == []


class CombinedRuleSerializerTest(BaseAlertRuleSerializerTest, APITestCase, TestCase):
    def test_combined_serializer(self):
        projects = [self.project, self.create_project()]
        alert_rule = self.create_alert_rule(projects=projects)
        issue_rule = self.create_issue_alert_rule(
            data={
                "project": self.project,
                "name": "Issue Rule Test",
                "conditions": [],
                "actions": [],
                "actionMatch": "all",
            }
        )
        other_alert_rule = self.create_alert_rule()

        result = serialize(
            [alert_rule, issue_rule, other_alert_rule], serializer=CombinedRuleSerializer()
        )

        self.assert_alert_rule_serialized(alert_rule, result[0])
        assert result[1]["id"] == six.text_type(issue_rule.id)
        self.assert_alert_rule_serialized(other_alert_rule, result[2])
