from datetime import datetime, timezone

import requests

from sentry.constants import ObjectStatus
from sentry.incidents.models import AlertRuleThresholdType, IncidentTrigger, TriggerStatus
from sentry.models.rule import Rule, RuleSource
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.silo import region_silo_test
from sentry.utils import json
from tests.sentry.api.serializers.test_alert_rule import BaseAlertRuleSerializerTest


@region_silo_test
class OrganizationCombinedRuleIndexEndpointTest(BaseAlertRuleSerializerTest, APITestCase):
    endpoint = "sentry-api-0-organization-combined-rules"

    def test_no_cron_monitor_rules(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.create_alert_rule()
        Rule.objects.create(
            project=self.project,
            label="Generic rule",
        )
        cron_rule = Rule.objects.create(
            project=self.project,
            label="Cron Rule",
            source=RuleSource.CRON_MONITOR,
        )

        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(self.organization.slug)

        # 3 because there is a default rule created
        assert len(resp.data) == 3
        assert cron_rule.id not in (r["id"] for r in resp.data), resp.data

    def test_no_perf_alerts(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.create_alert_rule()
        perf_alert_rule = self.create_alert_rule(query="p95", dataset=Dataset.Transactions)
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(self.organization.slug)
            assert perf_alert_rule.id not in [x["id"] for x in list(resp.data)]

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp = self.get_success_response(self.organization.slug)
            assert perf_alert_rule.id in [int(x["id"]) for x in list(resp.data)]

    def setup_project_and_rules(self):
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.team2 = self.create_team(organization=self.org, name="Folk Band", members=[self.user])
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.login_as(self.user)
        self.project2 = self.create_project(
            organization=self.org, teams=[self.team], name="Elephant"
        )
        self.projects = [self.project, self.project2]
        self.project_ids = [self.project.id, self.project2.id]
        self.alert_rule = self.create_alert_rule(
            name="alert rule",
            organization=self.org,
            projects=[self.project],
            date_added=before_now(minutes=6).replace(tzinfo=timezone.utc),
            owner=self.team.actor.get_actor_tuple(),
        )
        self.other_alert_rule = self.create_alert_rule(
            name="other alert rule",
            organization=self.org,
            projects=[self.project2],
            date_added=before_now(minutes=5).replace(tzinfo=timezone.utc),
            owner=self.team.actor.get_actor_tuple(),
        )
        self.issue_rule = self.create_issue_alert_rule(
            data={
                "project": self.project,
                "name": "Issue Rule Test",
                "conditions": [],
                "actions": [],
                "actionMatch": "all",
                "date_added": before_now(minutes=4).replace(tzinfo=timezone.utc),
            }
        )
        self.yet_another_alert_rule = self.create_alert_rule(
            name="yet another alert rule",
            organization=self.org,
            projects=[self.project],
            date_added=before_now(minutes=3).replace(tzinfo=timezone.utc),
            owner=self.team2.actor.get_actor_tuple(),
        )
        self.combined_rules_url = f"/api/0/organizations/{self.org.slug}/combined-rules/"

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
        assert result[1]["id"] == str(self.issue_rule.id)
        assert result[1]["type"] == "rule"
        self.assert_alert_rule_serialized(self.other_alert_rule, result[2], skip_dates=True)
        self.assert_alert_rule_serialized(self.alert_rule, result[3], skip_dates=True)

    def test_limit_as_1_with_paging_sort_name(self):
        self.setup_project_and_rules()
        # Test Limit as 1, no cursor:
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "1", "project": self.project.id, "sort": "name", "asc": 1}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200, response.content
        result = json.loads(response.content)
        assert len(result) == 1
        self.assert_alert_rule_serialized(self.alert_rule, result[0], skip_dates=True)
        links = requests.utils.parse_header_links(
            response.get("link", "").rstrip(">").replace(">,<", ",<")
        )
        next_cursor = links[1]["cursor"]
        # Test Limit as 1, next page of previous request:
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {
                "cursor": next_cursor,
                "per_page": "1",
                "project": self.project.id,
                "sort": "name",
                "asc": 1,
            }
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200, response.content
        result = json.loads(response.content)
        assert len(result) == 1
        assert result[0]["id"] == str(self.issue_rule.id)
        assert result[0]["type"] == "rule"

    def test_limit_as_1_with_paging_sort_name_urlencode(self):
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.login_as(self.user)
        alert_rule = self.create_alert_rule(
            name="!1?",
            organization=self.org,
            projects=[self.project],
            date_added=before_now(minutes=6).replace(tzinfo=timezone.utc),
            owner=self.team.actor.get_actor_tuple(),
        )
        alert_rule1 = self.create_alert_rule(
            name="!1?zz",
            organization=self.org,
            projects=[self.project],
            date_added=before_now(minutes=6).replace(tzinfo=timezone.utc),
            owner=self.team.actor.get_actor_tuple(),
        )

        # Test Limit as 1, no cursor:
        url = f"/api/0/organizations/{self.org.slug}/combined-rules/"
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "1", "project": self.project.id, "sort": "name", "asc": 1}
            response = self.client.get(
                path=url,
                data=request_data,
                content_type="application/json",
            )
        assert response.status_code == 200, response.content
        result = json.loads(response.content)
        assert len(result) == 1
        self.assert_alert_rule_serialized(alert_rule, result[0], skip_dates=True)
        links = requests.utils.parse_header_links(
            response.get("link", "").rstrip(">").replace(">,<", ",<")
        )
        next_cursor = links[1]["cursor"]

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {
                "cursor": next_cursor,
                "per_page": "1",
                "project": self.project.id,
                "sort": "name",
                "asc": 1,
            }
            response = self.client.get(path=url, data=request_data, content_type="application/json")
        assert response.status_code == 200
        result = json.loads(response.content)
        assert len(result) == 1
        assert result[0]["id"] == str(alert_rule1.id)

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
            response.get("link", "").rstrip(">").replace(">,<", ",<")
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
        assert result[0]["id"] == str(self.issue_rule.id)
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
        assert result[1]["id"] == str(self.issue_rule.id)
        assert result[1]["type"] == "rule"

        links = requests.utils.parse_header_links(
            response.get("link", "").rstrip(">").replace(">,<", ",<")
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
            response.get("link", "").rstrip(">").replace(">,<", ",<")
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
            date_added=date_added.replace(tzinfo=timezone.utc),
        )
        self.two_alert_rule = self.create_alert_rule(
            organization=self.org,
            projects=[self.project2],
            date_added=date_added.replace(tzinfo=timezone.utc),
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
            response.get("link", "").rstrip(">").replace(">,<", ",<")
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
            date_added=date_added.replace(tzinfo=timezone.utc),
        )
        self.two_alert_rule = self.create_alert_rule(
            organization=self.org,
            projects=[self.project],
            date_added=date_added.replace(tzinfo=timezone.utc),
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

        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        self.issue_rule = self.create_issue_alert_rule(
            data={
                "project": other_project,
                "name": "Issue Rule Test",
                "conditions": [],
                "actions": [],
                "actionMatch": "all",
                "date_added": before_now(minutes=4).replace(tzinfo=timezone.utc),
            }
        )

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            response = self.get_error_response(self.organization.slug, project=[other_project.id])
            assert response.data["detail"] == "You do not have permission to perform this action."

    def test_team_filter(self):
        self.setup_project_and_rules()
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "10", "project": [self.project.id]}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        result = json.loads(response.content)
        assert len(result) == 3

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {
                "per_page": "10",
                "project": [self.project.id],
                "team": [self.team.id],
            }
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        result = json.loads(response.content)
        assert len(result) == 1

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {
                "per_page": "10",
                "project": [self.project.id],
                "team": [self.team.id, self.team2.id],
            }
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        result = json.loads(response.content)
        assert len(result) == 2

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {
                "per_page": "10",
                "project": [self.project.id, self.project2.id],
                "team": [self.team.id, self.team2.id],
            }
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        result = json.loads(response.content)
        assert len(result) == 3

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "10", "project": [self.project.id], "team": ["unassigned"]}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        result = json.loads(response.content)
        assert len(result) == 1

        self.an_unassigned_alert_rule = self.create_alert_rule(
            organization=self.org,
            projects=[self.project],
            date_added=before_now(minutes=3).replace(tzinfo=timezone.utc),
            owner=None,
        )
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "10", "project": [self.project.id], "team": ["unassigned"]}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        result = json.loads(response.content)
        assert len(result) == 2

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "10", "project": [self.project.id], "team": ["notvalid"]}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 400

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "10", "project": [self.project.id], "team": ["myteams"]}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        result = json.loads(response.content)
        assert len(result) == 2

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {
                "per_page": "10",
                "project": [self.project.id, self.project2.id],
                "team": ["myteams"],
            }
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        result = json.loads(response.content)
        assert len(result) == 3

        self.create_issue_alert_rule(
            data={
                "project": self.project,
                "name": "Issue Rule Test",
                "conditions": [],
                "actions": [],
                "actionMatch": "all",
                "date_added": before_now(minutes=4).replace(tzinfo=timezone.utc),
                "owner": self.team.actor,
            }
        )
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {
                "per_page": "10",
                "project": [self.project.id],
                "team": [self.team.id],
            }
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        result = json.loads(response.content)
        assert len(result) == 2

    def test_myteams_filter_superuser(self):
        superuser = self.create_user(is_superuser=True)
        another_org = self.create_organization(owner=superuser, name="Rowdy Tiger")
        another_org_rules_url = f"/api/0/organizations/{another_org.slug}/combined-rules/"
        another_org_team = self.create_team(organization=another_org, name="Meow Band", members=[])
        another_project = self.create_project(
            organization=another_org, teams=[another_org_team], name="Woof Choir"
        )
        self.login_as(superuser, superuser=True)
        self.create_alert_rule(
            name="alert rule",
            organization=another_org,
            projects=[another_project],
            date_added=before_now(minutes=6).replace(tzinfo=timezone.utc),
            owner=another_org_team.actor.get_actor_tuple(),
        )

        self.create_issue_alert_rule(
            data={
                "project": another_project,
                "name": "Issue Rule Test",
                "conditions": [],
                "actions": [],
                "actionMatch": "all",
                "date_added": before_now(minutes=4).replace(tzinfo=timezone.utc),
                "owner": another_org_team.actor,
            }
        )

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {
                "per_page": "10",
                "project": [another_project.id],
                "team": ["myteams"],
            }
            response = self.client.get(
                path=another_org_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        assert len(response.data) == 2

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {
                "per_page": "10",
                "project": [another_project.id],
                "team": [another_org_team.id],
            }
            response = self.client.get(
                path=another_org_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        assert len(response.data) == 2  # We are not on this team, but we are a superuser.

    def test_team_filter_no_access(self):
        self.setup_project_and_rules()
        another_org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        another_org_team = self.create_team(organization=another_org, name="Meow Band", members=[])
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {
                "per_page": "10",
                "project": [self.project.id],
                "team": [self.team.id, another_org_team.id],
            }
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 403

    def test_name_filter(self):
        self.setup_project_and_rules()
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {
                "per_page": "10",
                "project": [self.project.id],
                "name": "yet",
            }
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        result = json.loads(response.content)
        assert len(result) == 1
        assert result[0]["name"] == "yet another alert rule"

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {
                "per_page": "10",
                "project": [self.project.id],
                "name": "issue rule",
            }
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        result = json.loads(response.content)
        assert len(result) == 1
        assert result[0]["name"] == "Issue Rule Test"

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {
                "per_page": "10",
                "project": [self.project.id, self.project2.id],
                "name": "aLeRt RuLe",
            }
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        result = json.loads(response.content)
        assert len(result) == 3

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {
                "per_page": "10",
                "project": [self.project.id, self.project2.id],
                "name": "aLeRt this RuLe",
            }
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        result = json.loads(response.content)
        assert len(result) == 0

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {
                "per_page": "10",
                "project": [self.project.id, self.project2.id],
                "name": "RuLe",
            }
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        result = json.loads(response.content)
        assert len(result) == 4

    def test_status_and_date_triggered_sort_order(self):
        self.setup_project_and_rules()

        alert_rule_critical = self.create_alert_rule(
            organization=self.org,
            projects=[self.project],
            name="some rule [crit]",
            query="",
            aggregate="count()",
            time_window=1,
            threshold_type=AlertRuleThresholdType.ABOVE,
            resolve_threshold=10,
            threshold_period=1,
        )
        another_alert_rule_warning = self.create_alert_rule(
            organization=self.org,
            projects=[self.project],
            name="another warning rule",
            query="",
            aggregate="count()",
            time_window=1,
            threshold_type=AlertRuleThresholdType.ABOVE,
            resolve_threshold=10,
            threshold_period=1,
        )
        alert_rule_warning = self.create_alert_rule(
            organization=self.org,
            projects=[self.project],
            name="warning rule",
            query="",
            aggregate="count()",
            time_window=1,
            threshold_type=AlertRuleThresholdType.ABOVE,
            resolve_threshold=10,
            threshold_period=1,
        )
        trigger = self.create_alert_rule_trigger(alert_rule_critical, "hi", 100)
        trigger2 = self.create_alert_rule_trigger(alert_rule_critical, "bye", 50)

        trigger3 = self.create_alert_rule_trigger(alert_rule_warning, "meow", 200)

        self.create_incident(status=2, alert_rule=alert_rule_critical)
        warning_incident = self.create_incident(status=10, alert_rule=alert_rule_critical)
        self.create_incident(status=10, alert_rule=alert_rule_warning)
        self.create_incident(status=10, alert_rule=another_alert_rule_warning)
        crit_incident = self.create_incident(status=20, alert_rule=alert_rule_critical)
        IncidentTrigger.objects.create(
            incident=crit_incident, alert_rule_trigger=trigger, status=TriggerStatus.RESOLVED.value
        )
        IncidentTrigger.objects.create(
            incident=crit_incident, alert_rule_trigger=trigger2, status=TriggerStatus.ACTIVE.value
        )
        IncidentTrigger.objects.create(
            incident=warning_incident,
            alert_rule_trigger=trigger3,
            status=TriggerStatus.ACTIVE.value,
        )
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {
                "per_page": "10",
                "project": [self.project.id, self.project2.id],
                "sort": ["incident_status", "date_triggered"],
            }
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200, response.content
        result = json.loads(response.content)
        assert len(result) == 7
        # Assert critical rule is first, warnings are next (sorted by triggered date), and issue rules are last.
        assert [r["id"] for r in result] == [
            f"{alert_rule_critical.id}",
            f"{another_alert_rule_warning.id}",
            f"{alert_rule_warning.id}",
            f"{self.alert_rule.id}",
            f"{self.other_alert_rule.id}",
            f"{self.yet_another_alert_rule.id}",
            f"{self.issue_rule.id}",
        ]

        # Test paging with the status setup:
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {
                "per_page": "2",
                "project": [self.project.id, self.project2.id],
                "sort": ["incident_status", "date_triggered"],
            }
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200, response.content
        result = json.loads(response.content)
        assert len(result) == 2
        self.assert_alert_rule_serialized(alert_rule_critical, result[0], skip_dates=True)
        self.assert_alert_rule_serialized(another_alert_rule_warning, result[1], skip_dates=True)
        links = requests.utils.parse_header_links(
            response.get("link", "").rstrip(">").replace(">,<", ",<")
        )
        next_cursor = links[1]["cursor"]
        # Get next page, we should be between the two status':
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {
                "cursor": next_cursor,
                "per_page": "2",
                "project": [self.project.id, self.project2.id],
                "sort": ["incident_status", "date_triggered"],
            }
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200, response.content
        result = json.loads(response.content)
        assert len(result) == 2
        self.assert_alert_rule_serialized(alert_rule_warning, result[0], skip_dates=True)

    def test_expand_latest_incident(self):
        self.setup_project_and_rules()

        alert_rule_critical = self.create_alert_rule(
            organization=self.org,
            projects=[self.project],
            name="some rule [crit]",
            query="",
            aggregate="count()",
            time_window=1,
            threshold_type=AlertRuleThresholdType.ABOVE,
            resolve_threshold=10,
            threshold_period=1,
        )
        trigger = self.create_alert_rule_trigger(alert_rule_critical, "hi", 100)

        self.create_incident(status=2, alert_rule=alert_rule_critical)
        crit_incident = self.create_incident(status=20, alert_rule=alert_rule_critical)
        IncidentTrigger.objects.create(
            incident=crit_incident, alert_rule_trigger=trigger, status=TriggerStatus.RESOLVED.value
        )
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {
                "per_page": "10",
                "project": [self.project.id],
                "expand": "latestIncident",
            }
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200, response.content
        result = json.loads(response.content)
        assert len(result) == 4
        assert result[0]["latestIncident"]["id"] == str(crit_incident.id)

    def test_non_existing_owner(self):
        self.setup_project_and_rules()
        team = self.create_team(organization=self.organization, members=[self.user])
        alert_rule = self.create_alert_rule(
            name="the best rule",
            organization=self.org,
            projects=[self.project],
            date_added=before_now(minutes=1).replace(tzinfo=timezone.utc),
            owner=team.actor.get_actor_tuple(),
        )
        self.create_issue_alert_rule(
            data={
                "project": self.project,
                "name": "Issue Rule Test",
                "conditions": [],
                "actions": [],
                "actionMatch": "all",
                "date_added": before_now(minutes=2).replace(tzinfo=timezone.utc),
                "owner": team.actor,
            }
        )
        team.delete()
        # Pick up here. Deleting the team apparently deletes the alert rule as well now
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "10"}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        assert response.data[0]["id"] == str(alert_rule.id)
        assert response.data[0]["owner"] is None

    @freeze_time()
    def test_last_triggered(self):
        self.login_as(user=self.user)
        rule = Rule.objects.filter(project=self.project).first()
        resp = self.get_success_response(self.organization.slug, expand=["lastTriggered"])
        assert resp.data[0]["lastTriggered"] is None
        RuleFireHistory.objects.create(project=self.project, rule=rule, group=self.group)
        resp = self.get_success_response(self.organization.slug, expand=["lastTriggered"])
        assert resp.data[0]["lastTriggered"] == datetime.now().replace(tzinfo=timezone.utc)

    def test_project_deleted(self):
        from sentry.models.scheduledeletion import RegionScheduledDeletion
        from sentry.tasks.deletion.scheduled import run_deletion

        org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        team = self.create_team(organization=org, name="Mariachi Band", members=[self.user])
        delete_project = self.create_project(organization=org, teams=[team], name="Bengal")
        self.login_as(self.user)
        self.create_project_rule(project=delete_project)

        deletion = RegionScheduledDeletion.schedule(delete_project, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        self.get_success_response(org.slug)

    def test_active_and_disabled_rules(self):
        """Test that we return both active and disabled rules"""
        self.setup_project_and_rules()
        disabled_alert = self.create_project_rule(name="disabled rule")
        disabled_alert.status = ObjectStatus.DISABLED
        disabled_alert.save()
        request_data = {"per_page": "10"}
        response = self.client.get(
            path=self.combined_rules_url, data=request_data, content_type="application/json"
        )
        assert len(response.data) == 5
        for data in response.data:
            if data["name"] == disabled_alert.label:
                assert data["status"] == "disabled"

    def test_dataset_filter(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.create_alert_rule(dataset=Dataset.Metrics)
        transaction_rule = self.create_alert_rule(dataset=Dataset.Transactions)
        events_rule = self.create_alert_rule(dataset=Dataset.Events)
        self.login_as(self.user)

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            transactions_res = self.get_success_response(
                self.organization.slug, dataset=[Dataset.Transactions.value]
            )
            self.assert_alert_rule_serialized(
                transaction_rule, transactions_res.data[0], skip_dates=True
            )
            events_res = self.get_success_response(
                self.organization.slug, dataset=[Dataset.Events.value]
            )
            self.assert_alert_rule_serialized(events_rule, events_res.data[0], skip_dates=True)

        with self.feature("organizations:incidents"):
            # without performance-view, we should only see events rules
            res = self.get_success_response(self.organization.slug)
            self.assert_alert_rule_serialized(events_rule, res.data[0], skip_dates=True)
