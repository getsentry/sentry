# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six
import json
import requests

from sentry import features
from sentry.features import OrganizationFeature

from sentry.api.serializers import serialize
from sentry.api.serializers.models.alert_rule import (
    DetailedAlertRuleSerializer,
    CombinedRuleSerializer,
)
from sentry.models import Rule
# from sentry.api.serializers import RuleSerializer
from sentry.incidents.logic import create_alert_rule, create_alert_rule_trigger
from sentry.incidents.models import AlertRuleThresholdType
from sentry.snuba.models import QueryAggregations
from sentry.testutils import TestCase, APITestCase

class BaseAlertRuleSerializerTest(object):
    def assert_alert_rule_serialized(self, alert_rule, result, skip_dates=False):
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
        if not skip_dates:
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


class CombinedRuleSerializerTest(BaseAlertRuleSerializerTest, APITestCase, TestCase):
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
        rule.save()
        return rule

    def test_combined_serializer(self):
        projects = [self.project, self.create_project()]
        alert_rule = self.create_alert_rule(projects=projects)
        issue_rule = self.create_issue_alert_rule(data={
            "project": self.project,
            "name": "Issue Rule Test",
            "conditions": [],
            "actions": [],
            "actionMatch": "all"
        })
        other_alert_rule = self.create_alert_rule()

        result = serialize(
            [alert_rule, issue_rule, other_alert_rule], serializer=CombinedRuleSerializer()
        )

        self.assert_alert_rule_serialized(alert_rule, result[0])
        assert result[1]["id"] == six.text_type(issue_rule.id)
        self.assert_alert_rule_serialized(other_alert_rule, result[2])

    def test_combined_api(self):
        # Call with invalid limit gives error
        # Call wtih over limit gets capped
        # Call with page size = 1 or 2 and valid cursor's get correct results
        # user = self.create_user("foo@example.com", is_superuser=True, is_staff = True)

        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.login_as(self.user)

        projects = [self.project, self.create_project()]
        alert_rule = self.create_alert_rule(projects=projects)
        other_alert_rule = self.create_alert_rule(projects=projects)
        issue_rule = self.create_issue_alert_rule(data={
            "project": self.project,
            "name": "Issue Rule Test",
            "conditions": [],
            "actions": [],
            "actionMatch": "all"
        })
        yet_another_alert_rule = self.create_alert_rule(projects=projects)

        url = "/api/0/projects/{0}/{1}/combined-rules/".format(self.org.slug, self.project.slug)

        print("URL is:",url)

        request_data = {
            "cursor": "0:0:0",
            "limit": "3"
        }

        print("request_data:",request_data)

        # Test no limit, no cursor.
        with self.feature("organizations:incidents"):
            response = self.client.get(
                path=url,
                data=request_data,
                content_type="application/json",
            )
        print("response:",response)
        print("response.content:",response.content)

        assert response.status_code == 200
        result = json.loads(response.content)
        # assert len(result) == 3
        import pdb; pdb.set_trace()
        self.assert_alert_rule_serialized(yet_another_alert_rule, result[0], skip_dates=True)
        assert result[1]["id"] == six.text_type(rule.id)
        assert result[1]["type"] == "rule"
        self.assert_alert_rule_serialized(alert_rule, result[2], skip_dates=True)

        # Test Limit as 1, no cursor:
        request_data = {
            "cursor": "0:0:0",
            "limit": "1"
        }
        with self.feature("organizations:incidents"):
            response = self.client.get(
                path=url,
                data=request_data,
                content_type="application/json",
            )

        assert response.status_code == 200
        result = json.loads(response.content)
        assert len(result) == 1
        import pdb; pdb.set_trace()
        self.assert_alert_rule_serialized(alert_rule, result[0])

        links = requests.utils.parse_header_links(response.get('link').rstrip('>').replace('>,<', ',<'))
        # Test Limit 1, next page of previous request:
        request_data = {
            "cursor": links[1]['cursor'],
            "limit": "1"
        }
        with self.feature("organizations:incidents"):
            response = self.client.get(
                path=url,
                data=request_data,
                content_type="application/json",
            )

        assert response.status_code == 200
        result = json.loads(response.content)
        assert len(response.content) == 1
        assert result[1]["id"] == six.text_type(rule.id)
        assert result[1]["type"] == "rule"
