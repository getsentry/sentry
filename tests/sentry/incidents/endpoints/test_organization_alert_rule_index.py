from __future__ import absolute_import

import pytz
import requests
import six

from exam import fixture
from freezegun import freeze_time

from sentry.utils import json
from sentry.api.serializers import serialize
from sentry.incidents.models import AlertRule, AlertRuleThresholdType
from sentry.snuba.models import QueryDatasets
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils import APITestCase
from tests.sentry.api.serializers.test_alert_rule import BaseAlertRuleSerializerTest


class AlertRuleListEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-alert-rules"

    @fixture
    def organization(self):
        return self.create_organization()

    @fixture
    def project(self):
        return self.create_project(organization=self.organization)

    @fixture
    def user(self):
        return self.create_user()

    def test_simple(self):
        self.create_team(organization=self.organization, members=[self.user])
        alert_rule = self.create_alert_rule()

        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(self.organization.slug)

        assert resp.data == serialize([alert_rule])

    def test_no_feature(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug)
        assert resp.status_code == 404


@freeze_time()
class AlertRuleCreateEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-alert-rules"
    method = "post"

    @fixture
    def organization(self):
        return self.create_organization()

    @fixture
    def project(self):
        return self.create_project(organization=self.organization)

    @fixture
    def user(self):
        return self.create_user()

    def test_simple(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        valid_alert_rule = {
            "aggregate": "count()",
            "query": "",
            "timeWindow": "300",
            "resolveThreshold": 100,
            "thresholdType": 0,
            "triggers": [
                {
                    "label": "critical",
                    "alertThreshold": 200,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id}
                    ],
                },
                {
                    "label": "warning",
                    "alertThreshold": 150,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id},
                        {"type": "email", "targetType": "user", "targetIdentifier": self.user.id},
                    ],
                },
            ],
            "projects": [self.project.slug],
            "name": "JustAValidTestRule",
        }
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug, status_code=201, **valid_alert_rule
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

    def test_no_label(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        rule_one_trigger_no_label = {
            "aggregate": "count()",
            "query": "",
            "timeWindow": "300",
            "projects": [self.project.slug],
            "name": "OneTriggerOnlyCritical",
            "resolveThreshold": 100,
            "thresholdType": 1,
            "triggers": [
                {
                    "alertThreshold": 200,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id}
                    ],
                }
            ],
        }

        with self.feature("organizations:incidents"):
            self.get_valid_response(
                self.organization.slug, status_code=400, **rule_one_trigger_no_label
            )

    def test_only_critical_trigger(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        rule_one_trigger_only_critical = {
            "aggregate": "count()",
            "query": "",
            "timeWindow": "300",
            "projects": [self.project.slug],
            "name": "OneTriggerOnlyCritical",
            "resolveThreshold": 200,
            "thresholdType": 1,
            "triggers": [
                {
                    "label": "critical",
                    "alertThreshold": 100,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id}
                    ],
                }
            ],
        }
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug, status_code=201, **rule_one_trigger_only_critical
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

    def test_no_triggers(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)

        rule_no_triggers = {
            "aggregate": "count()",
            "query": "",
            "timeWindow": "300",
            "thresholdType": AlertRuleThresholdType.ABOVE.value,
            "projects": [self.project.slug],
            "name": "JustATestRuleWithNoTriggers",
        }

        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug, status_code=400, **rule_no_triggers
            )
            assert resp.data == {"triggers": [u"This field is required."]}

    def test_no_critical_trigger(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)

        rule_one_trigger_only_warning = {
            "aggregate": "count()",
            "query": "",
            "timeWindow": "300",
            "projects": [self.project.slug],
            "name": "JustATestRule",
            "resolveThreshold": 100,
            "thresholdType": 1,
            "triggers": [
                {
                    "label": "warning",
                    "alertThreshold": 200,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id}
                    ],
                }
            ],
        }

        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug, status_code=400, **rule_one_trigger_only_warning
            )
            assert resp.data == {"nonFieldErrors": [u'Trigger 1 must be labeled "critical"']}

    def test_critical_trigger_no_action(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)

        rule_one_trigger_only_critical_no_action = {
            "aggregate": "count()",
            "query": "",
            "timeWindow": "300",
            "projects": [self.project.slug],
            "name": "JustATestRule",
            "resolveThreshold": 100,
            "thresholdType": 1,
            "triggers": [{"label": "critical", "alertThreshold": 75}],
        }

        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug, status_code=201, **rule_one_trigger_only_critical_no_action
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

    def test_invalid_projects(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug,
                status_code=400,
                projects=[
                    self.project.slug,
                    self.create_project(organization=self.create_organization()).slug,
                ],
                name="an alert",
                thresholdType=1,
                query="hi",
                aggregate="count()",
                timeWindow=10,
                alertThreshold=1000,
                resolveThreshold=100,
                triggers=[
                    {
                        "label": "critical",
                        "alertThreshold": 200,
                        "actions": [
                            {
                                "type": "email",
                                "targetType": "team",
                                "targetIdentifier": self.team.id,
                            }
                        ],
                    }
                ],
            )
            assert resp.data == {"projects": [u"Invalid project"]}

    def test_no_feature(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug)
        assert resp.status_code == 404

    def test_no_perms(self):
        self.create_member(
            user=self.user, organization=self.organization, role="member", teams=[self.team]
        )
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug)
        assert resp.status_code == 403


class OrganizationCombinedRuleIndexEndpointTest(BaseAlertRuleSerializerTest, APITestCase):
    endpoint = "sentry-api-0-organization-combined-rules"

    def test_no_perf_alerts(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.create_alert_rule()
        perf_alert_rule = self.create_alert_rule(query="p95", dataset=QueryDatasets.TRANSACTIONS)
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(self.organization.slug)
            assert perf_alert_rule.id not in [x["id"] for x in list(resp.data)]

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp = self.get_valid_response(self.organization.slug)
            assert perf_alert_rule.id in [int(x["id"]) for x in list(resp.data)]

    def setup_project_and_rules(self):
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.login_as(self.user)
        self.project2 = self.create_project(organization=self.org)
        self.projects = [self.project, self.project2]
        self.project_ids = [self.project.id, self.project2.id]
        self.alert_rule = self.create_alert_rule(
            organization=self.org,
            projects=[self.project],
            date_added=before_now(minutes=6).replace(tzinfo=pytz.UTC),
        )
        self.other_alert_rule = self.create_alert_rule(
            organization=self.org,
            projects=[self.project2],
            date_added=before_now(minutes=5).replace(tzinfo=pytz.UTC),
        )
        self.issue_rule = self.create_issue_alert_rule(
            data={
                "project": self.project,
                "name": "Issue Rule Test",
                "conditions": [],
                "actions": [],
                "actionMatch": "all",
                "date_added": before_now(minutes=4).replace(tzinfo=pytz.UTC),
            }
        )
        self.yet_another_alert_rule = self.create_alert_rule(
            organization=self.org,
            projects=[self.project],
            date_added=before_now(minutes=3).replace(tzinfo=pytz.UTC),
        )
        self.combined_rules_url = "/api/0/organizations/{0}/combined-rules/".format(self.org.slug)

    def test_invalid_limit(self):
        self.setup_project_and_rules()
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "notaninteger"}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 400

    def test_limit_higher_than_results_no_cursor(self):
        self.setup_project_and_rules()
        # Test limit above result count (which is 4), no cursor.
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "5", "project": self.project_ids}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        result = json.loads(response.content)
        assert len(result) == 4
        self.assert_alert_rule_serialized(self.yet_another_alert_rule, result[0], skip_dates=True)
        assert result[1]["id"] == six.text_type(self.issue_rule.id)
        assert result[1]["type"] == "rule"
        self.assert_alert_rule_serialized(self.other_alert_rule, result[2], skip_dates=True)
        self.assert_alert_rule_serialized(self.alert_rule, result[3], skip_dates=True)

    def test_limit_as_1_with_paging(self):
        self.setup_project_and_rules()

        # Test Limit as 1, no cursor:
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "1", "project": self.project_ids}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200

        result = json.loads(response.content)
        assert len(result) == 1
        self.assert_alert_rule_serialized(self.yet_another_alert_rule, result[0], skip_dates=True)

        links = requests.utils.parse_header_links(
            response.get("link").rstrip(">").replace(">,<", ",<")
        )
        next_cursor = links[1]["cursor"]

        # Test Limit as 1, next page of previous request:
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"cursor": next_cursor, "per_page": "1", "project": self.project.id}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        result = json.loads(response.content)
        assert len(result) == 1
        assert result[0]["id"] == six.text_type(self.issue_rule.id)
        assert result[0]["type"] == "rule"

    def test_limit_as_2_with_paging(self):
        self.setup_project_and_rules()

        # Test Limit as 2, no cursor:
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "2", "project": self.project_ids}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200

        result = json.loads(response.content)
        assert len(result) == 2
        self.assert_alert_rule_serialized(self.yet_another_alert_rule, result[0], skip_dates=True)
        assert result[1]["id"] == six.text_type(self.issue_rule.id)
        assert result[1]["type"] == "rule"

        links = requests.utils.parse_header_links(
            response.get("link").rstrip(">").replace(">,<", ",<")
        )
        next_cursor = links[1]["cursor"]
        # Test Limit 2, next page of previous request:
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"cursor": next_cursor, "per_page": "2", "project": self.project_ids}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200

        result = json.loads(response.content)
        assert len(result) == 2
        self.assert_alert_rule_serialized(self.other_alert_rule, result[0], skip_dates=True)
        self.assert_alert_rule_serialized(self.alert_rule, result[1], skip_dates=True)

        links = requests.utils.parse_header_links(
            response.get("link").rstrip(">").replace(">,<", ",<")
        )
        next_cursor = links[1]["cursor"]

        # Test Limit 2, next page of previous request - should get no results since there are only 4 total:
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"cursor": next_cursor, "per_page": "2", "project": self.project_ids}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200

        result = json.loads(response.content)
        assert len(result) == 0

    def test_offset_pagination(self):
        self.setup_project_and_rules()

        date_added = before_now(minutes=1)
        self.one_alert_rule = self.create_alert_rule(
            organization=self.org,
            projects=[self.project, self.project2],
            date_added=date_added.replace(tzinfo=pytz.UTC),
        )
        self.two_alert_rule = self.create_alert_rule(
            organization=self.org,
            projects=[self.project2],
            date_added=date_added.replace(tzinfo=pytz.UTC),
        )
        self.three_alert_rule = self.create_alert_rule(
            organization=self.org, projects=[self.project]
        )

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "2", "project": self.project_ids}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200

        result = json.loads(response.content)
        assert len(result) == 2
        self.assert_alert_rule_serialized(self.three_alert_rule, result[0], skip_dates=True)
        self.assert_alert_rule_serialized(self.one_alert_rule, result[1], skip_dates=True)

        links = requests.utils.parse_header_links(
            response.get("link").rstrip(">").replace(">,<", ",<")
        )
        next_cursor = links[1]["cursor"]
        assert next_cursor.split(":")[1] == "1"  # Assert offset is properly calculated.

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"cursor": next_cursor, "per_page": "2", "project": self.project_ids}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200

        result = json.loads(response.content)
        assert len(result) == 2

        self.assert_alert_rule_serialized(self.two_alert_rule, result[0], skip_dates=True)
        self.assert_alert_rule_serialized(self.yet_another_alert_rule, result[1], skip_dates=True)

    def test_filter_by_project(self):
        self.setup_project_and_rules()

        date_added = before_now(minutes=1)
        self.one_alert_rule = self.create_alert_rule(
            organization=self.org,
            projects=[self.project, self.project2],
            date_added=date_added.replace(tzinfo=pytz.UTC),
        )
        self.two_alert_rule = self.create_alert_rule(
            organization=self.org,
            projects=[self.project],
            date_added=date_added.replace(tzinfo=pytz.UTC),
        )
        self.three_alert_rule = self.create_alert_rule(
            organization=self.org, projects=[self.project2]
        )

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "2", "project": [self.project.id]}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200

        result = json.loads(response.content)
        assert len(result) == 2
        self.assert_alert_rule_serialized(self.one_alert_rule, result[0], skip_dates=True)
        self.assert_alert_rule_serialized(self.two_alert_rule, result[1], skip_dates=True)

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "2", "project": [self.project2.id]}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200

        result = json.loads(response.content)
        assert len(result) == 2
        self.assert_alert_rule_serialized(self.three_alert_rule, result[0], skip_dates=True)
        self.assert_alert_rule_serialized(self.one_alert_rule, result[1], skip_dates=True)
