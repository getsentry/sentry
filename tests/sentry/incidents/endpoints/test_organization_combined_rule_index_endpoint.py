from datetime import UTC, datetime

import requests

from sentry.constants import ObjectStatus
from sentry.incidents.models.alert_rule import AlertRuleThresholdType
from sentry.incidents.models.incident import IncidentTrigger, TriggerStatus
from sentry.models.rule import Rule, RuleSource
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.monitors.models import MonitorStatus
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.types.actor import Actor
from sentry.uptime.models import ProjectUptimeSubscriptionMode, UptimeStatus
from sentry.utils import json
from tests.sentry.incidents.endpoints.serializers.test_alert_rule import BaseAlertRuleSerializerTest


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
        self.project_ids = [str(self.project.id), str(self.project2.id)]
        self.alert_rule = self.create_alert_rule(
            name="alert rule",
            organization=self.org,
            projects=[self.project],
            date_added=before_now(minutes=6),
            owner=Actor.from_id(user_id=None, team_id=self.team.id),
        )
        self.other_alert_rule = self.create_alert_rule(
            name="other alert rule",
            organization=self.org,
            projects=[self.project2],
            date_added=before_now(minutes=5),
            owner=Actor.from_id(user_id=None, team_id=self.team.id),
        )
        self.issue_rule = self.create_issue_alert_rule(
            data={
                "project": self.project,
                "name": "Issue Rule Test",
                "conditions": [],
                "actions": [],
                "actionMatch": "all",
                "date_added": before_now(minutes=4),
            }
        )
        self.yet_another_alert_rule = self.create_alert_rule(
            name="yet another alert rule",
            organization=self.org,
            projects=[self.project],
            date_added=before_now(minutes=3),
            owner=Actor.from_id(user_id=None, team_id=self.team2.id),
        )
        self.combined_rules_url = f"/api/0/organizations/{self.org.slug}/combined-rules/"

    def test_simple(self):
        self.setup_project_and_rules()
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "10", "project": self.project_ids}
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

    def test_snoozed_rules(self):
        """
        Test that we properly serialize snoozed rules with and without an owner
        """
        self.setup_project_and_rules()
        issue_rule2 = self.create_issue_alert_rule(
            data={
                "project": self.project2,
                "name": "Issue Rule Test",
                "conditions": [],
                "actions": [],
                "actionMatch": "all",
                "date_added": before_now(minutes=4),
            }
        )
        self.snooze_rule(user_id=self.user.id, rule=self.issue_rule)
        self.snooze_rule(user_id=self.user.id, rule=issue_rule2, owner_id=self.user.id)
        self.snooze_rule(user_id=self.user.id, alert_rule=self.alert_rule)
        self.snooze_rule(
            user_id=self.user.id, alert_rule=self.yet_another_alert_rule, owner_id=self.user.id
        )

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "10", "project": self.project_ids}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        result = json.loads(response.content)
        assert len(result) == 5
        self.assert_alert_rule_serialized(self.yet_another_alert_rule, result[0], skip_dates=True)
        assert result[0]["snooze"]

        assert result[1]["id"] == str(issue_rule2.id)
        assert result[1]["type"] == "rule"
        assert result[1]["snooze"]

        assert result[2]["id"] == str(self.issue_rule.id)
        assert result[2]["type"] == "rule"
        assert result[2]["snooze"]

        self.assert_alert_rule_serialized(self.other_alert_rule, result[3], skip_dates=True)
        assert not result[3].get("snooze")

        self.assert_alert_rule_serialized(self.alert_rule, result[4], skip_dates=True)
        assert result[4]["snooze"]

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
            request_data = {
                "per_page": "1",
                "project": str(self.project.id),
                "sort": "name",
                "asc": "1",
            }
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
                "project": str(self.project.id),
                "sort": "name",
                "asc": "1",
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
            date_added=before_now(minutes=6),
            owner=Actor.from_id(user_id=None, team_id=self.team.id),
        )
        alert_rule1 = self.create_alert_rule(
            name="!1?zz",
            organization=self.org,
            projects=[self.project],
            date_added=before_now(minutes=6),
            owner=Actor.from_id(user_id=None, team_id=self.team.id),
        )

        # Test Limit as 1, no cursor:
        url = f"/api/0/organizations/{self.org.slug}/combined-rules/"
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {
                "per_page": "1",
                "project": str(self.project.id),
                "sort": "name",
                "asc": "1",
            }
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
                "project": str(self.project.id),
                "sort": "name",
                "asc": "1",
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
            request_data = {"cursor": next_cursor, "per_page": "1", "project": str(self.project.id)}
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
            date_added=date_added,
        )
        self.two_alert_rule = self.create_alert_rule(
            organization=self.org,
            projects=[self.project2],
            date_added=date_added,
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
            date_added=date_added,
        )
        self.two_alert_rule = self.create_alert_rule(
            organization=self.org,
            projects=[self.project],
            date_added=date_added,
        )
        self.three_alert_rule = self.create_alert_rule(
            organization=self.org, projects=[self.project2]
        )
        proj_uptime_monitor = self.create_project_uptime_subscription(project=self.project)
        proj2_uptime_monitor = self.create_project_uptime_subscription(project=self.project2)

        proj_cron_monitor = self.create_monitor(project=self.project)
        proj2_cron_monitor = self.create_monitor(project=self.project2)

        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
                "organizations:insights-crons",
            ]
        ):
            request_data = {"project": [self.project.id]}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200

        result = json.loads(response.content)

        assert [r["id"] for r in result] == [
            f"{proj_cron_monitor.guid}",
            f"{proj_uptime_monitor.id}",
            f"{self.one_alert_rule.id}",
            f"{self.two_alert_rule.id}",
            f"{self.yet_another_alert_rule.id}",
            f"{self.issue_rule.id}",
            f"{self.alert_rule.id}",
        ]

        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
                "organizations:insights-crons",
            ]
        ):
            request_data = {"project": [self.project2.id]}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200

        result = json.loads(response.content)
        assert [r["id"] for r in result] == [
            f"{proj2_cron_monitor.guid}",
            f"{proj2_uptime_monitor.id}",
            f"{self.three_alert_rule.id}",
            f"{self.one_alert_rule.id}",
            f"{self.other_alert_rule.id}",
        ]

        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        self.issue_rule = self.create_issue_alert_rule(
            data={
                "project": other_project,
                "name": "Issue Rule Test",
                "conditions": [],
                "actions": [],
                "actionMatch": "all",
                "date_added": before_now(minutes=4),
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
            date_added=before_now(minutes=3),
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

        self.issue_rule2 = self.create_issue_alert_rule(
            data={
                "project": self.project,
                "name": "Issue Rule Test",
                "conditions": [],
                "actions": [],
                "actionMatch": "all",
                "date_added": before_now(minutes=4),
                "owner": f"team:{self.team.id}",
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

        team_uptime_monitor = self.create_project_uptime_subscription(
            owner=self.team, name="Uptime owned"
        )
        unowned_uptime_monitor = self.create_project_uptime_subscription(
            name="Uptime unowned",
        )

        team_cron_monitor = self.create_monitor(
            owner_user_id=None,
            owner_team_id=self.team.id,
            name="Cron owned",
        )
        unowned_cron_monitor = self.create_monitor(
            name="Cron unowned",
            owner_user_id=None,
        )

        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
                "organizations:insights-crons",
            ]
        ):
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
        assert [r["id"] for r in result] == [
            f"{team_cron_monitor.guid}",
            f"{team_uptime_monitor.id}",
            f"{self.issue_rule2.id}",
            f"{self.alert_rule.id}",
        ]

        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
                "organizations:insights-crons",
            ]
        ):
            request_data = {
                "per_page": "10",
                "project": [self.project.id],
                "team": ["unassigned"],
            }
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        result = json.loads(response.content)
        assert [r["id"] for r in result] == [
            f"{unowned_cron_monitor.guid}",
            f"{unowned_uptime_monitor.id}",
            f"{self.an_unassigned_alert_rule.id}",
            f"{self.issue_rule.id}",
        ]

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
            date_added=before_now(minutes=6),
            owner=Actor.from_id(user_id=None, team_id=another_org_team.id),
        )

        self.create_issue_alert_rule(
            data={
                "project": another_project,
                "name": "Issue Rule Test",
                "conditions": [],
                "actions": [],
                "actionMatch": "all",
                "date_added": before_now(minutes=4),
                "owner": f"team:{another_org_team.id}",
            }
        )

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {
                "per_page": "10",
                "project": [str(another_project.id)],
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
                "project": [str(another_project.id)],
                "team": [another_org_team.id],
            }
            response = self.client.get(
                path=another_org_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        assert len(response.data) == 2  # We are not on this team, but we are a superuser.

    def test_team_filter_no_cross_org_access(self):
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
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["owner"] == f"team:{self.team.id}"

    def test_team_filter_no_access(self):
        self.setup_project_and_rules()

        # disable Open Membership
        self.org.flags.allow_joinleave = False
        self.org.save()

        user2 = self.create_user("bulldog@example.com")
        team2 = self.create_team(organization=self.org, name="Barking Voices")
        project2 = self.create_project(organization=self.org, teams=[team2], name="Bones")
        self.create_member(user=user2, organization=self.org, role="member", teams=[team2])
        self.login_as(user2)

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {
                "per_page": "10",
                "project": [project2.id],
                "team": [team2.id, self.team.id],
            }
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 403
        assert (
            response.data["detail"] == "Error: You do not have permission to access Mariachi Band"
        )

    def test_name_filter(self):
        self.setup_project_and_rules()
        uptime_monitor = self.create_project_uptime_subscription(name="Uptime")
        another_uptime_monitor = self.create_project_uptime_subscription(name="yet another Uptime")
        cron_monitor = self.create_monitor(name="Cron")
        another_cron_monitor = self.create_monitor(name="yet another Cron")

        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
                "organizations:insights-crons",
            ]
        ):
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
        assert [r["id"] for r in result] == [
            f"{another_cron_monitor.guid}",
            f"{another_uptime_monitor.id}",
            f"{self.yet_another_alert_rule.id}",
        ]

        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
            ]
        ):
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
        assert [r["id"] for r in result] == [f"{self.issue_rule.id}"]

        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
            ]
        ):
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

        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
            ]
        ):
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

        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
            ]
        ):
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

        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
            ]
        ):
            request_data = {
                "per_page": "10",
                "project": [self.project.id, self.project2.id],
                "name": "uptime",
            }
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        result = json.loads(response.content)
        assert [r["id"] for r in result] == [
            f"{another_uptime_monitor.id}",
            f"{uptime_monitor.id}",
        ]

        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
                "organizations:insights-crons",
            ]
        ):
            request_data = {
                "per_page": "10",
                "project": [self.project.id, self.project2.id],
                "name": "cron",
            }
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        result = json.loads(response.content)
        assert [r["id"] for r in result] == [
            f"{another_cron_monitor.guid}",
            f"{cron_monitor.guid}",
        ]

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
        uptime_monitor = self.create_project_uptime_subscription()
        failed_uptime_monitor = self.create_project_uptime_subscription(
            uptime_status=UptimeStatus.FAILED,
        )
        ok_cron_monitor = self.create_monitor(
            name="OK Monitor",
        )
        ok_cron_monitor_env = self.create_monitor_environment(
            monitor=ok_cron_monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.OK,
        )
        self.create_monitor_incident(
            monitor=ok_cron_monitor,
            monitor_environment=ok_cron_monitor_env,
            starting_timestamp=before_now(minutes=10),
        )
        failed_cron_monitor = self.create_monitor(
            name="Failing Monitor",
        )
        failed_cron_monitor_env = self.create_monitor_environment(
            monitor=failed_cron_monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.ERROR,
        )
        self.create_monitor_incident(
            monitor=failed_cron_monitor,
            monitor_environment=failed_cron_monitor_env,
            starting_timestamp=before_now(minutes=2),
        )

        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
                "organizations:insights-crons",
            ]
        ):
            request_data = {
                "per_page": "12",
                "project": [self.project.id, self.project2.id],
                "sort": ["incident_status", "date_triggered"],
            }
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200, response.content
        result = json.loads(response.content)
        # Assert failed uptime monitor is first, critical rule is next, then warnings (sorted by triggered date),
        # then issue rules and finally uptime monitors in ok status.
        assert [r["id"] for r in result] == [
            f"{failed_uptime_monitor.id}",
            f"{failed_cron_monitor.guid}",
            f"{alert_rule_critical.id}",
            f"{another_alert_rule_warning.id}",
            f"{alert_rule_warning.id}",
            f"{self.alert_rule.id}",
            f"{self.other_alert_rule.id}",
            f"{self.yet_another_alert_rule.id}",
            f"{self.issue_rule.id}",
            f"{uptime_monitor.id}",
            f"{ok_cron_monitor.guid}",
        ]

        # Test paging with the status setup:
        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
                "organizations:insights-crons",
            ]
        ):
            request_data = {
                "per_page": "3",
                "project": [self.project.id, self.project2.id],
                "sort": ["incident_status", "date_triggered"],
            }
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200, response.content
        result = json.loads(response.content)
        assert [r["id"] for r in result] == [
            f"{failed_uptime_monitor.id}",
            f"{failed_cron_monitor.guid}",
            f"{alert_rule_critical.id}",
        ]

        links = requests.utils.parse_header_links(
            response.get("link", "").rstrip(">").replace(">,<", ",<")
        )
        next_cursor = links[1]["cursor"]
        # Get next page, we should be between the two status':
        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
                "organizations:insights-crons",
            ]
        ):
            request_data = {
                "cursor": next_cursor,
                "per_page": "3",
                "project": [self.project.id, self.project2.id],
                "sort": ["incident_status", "date_triggered"],
            }
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200, response.content
        result = json.loads(response.content)
        assert [r["id"] for r in result] == [
            f"{another_alert_rule_warning.id}",
            f"{alert_rule_warning.id}",
            f"{self.alert_rule.id}",
        ]

    def test_uptime_feature(self):
        self.setup_project_and_rules()
        uptime_monitor = self.create_project_uptime_subscription(name="Uptime Monitor")
        other_uptime_monitor = self.create_project_uptime_subscription(
            name="Other Uptime Monitor",
        )
        self.create_project_uptime_subscription(
            name="Onboarding Uptime monitor",
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ONBOARDING,
        )

        request_data = {"name": "Uptime", "project": [self.project.id]}
        response = self.client.get(
            path=self.combined_rules_url, data=request_data, content_type="application/json"
        )
        assert response.status_code == 200, response.content
        result = json.loads(response.content)
        assert [r["id"] for r in result] == [
            f"{other_uptime_monitor.id}",
            f"{uptime_monitor.id}",
        ]

    def test_uptime_feature_name_sort(self):
        self.setup_project_and_rules()
        self.create_project_uptime_subscription(name="Uptime Monitor")
        self.create_project_uptime_subscription(
            name="Other Uptime Monitor",
        )
        self.create_project_uptime_subscription(
            name="Onboarding Uptime monitor",
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ONBOARDING,
        )

        request_data = {"project": [self.project.id], "sort": "name"}
        response = self.client.get(
            path=self.combined_rules_url, data=request_data, content_type="application/json"
        )
        assert response.status_code == 200, response.content
        result = json.loads(response.content)
        assert [r["name"] for r in result] == [
            "yet another alert rule",
            "Uptime Monitor",
            "Other Uptime Monitor",
            "Issue Rule Test",
            "alert rule",
        ]

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
            date_added=before_now(minutes=1),
            owner=Actor.from_id(user_id=None, team_id=team.id),
        )
        self.create_issue_alert_rule(
            data={
                "project": self.project,
                "name": "Issue Rule Test",
                "conditions": [],
                "actions": [],
                "actionMatch": "all",
                "date_added": before_now(minutes=2),
                "owner": f"team:{team.id}",
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
        rule = Rule.objects.filter(project=self.project).get()
        resp = self.get_success_response(self.organization.slug, expand=["lastTriggered"])
        assert resp.data[0]["lastTriggered"] is None
        RuleFireHistory.objects.create(project=self.project, rule=rule, group=self.group)
        resp = self.get_success_response(self.organization.slug, expand=["lastTriggered"])
        assert resp.data[0]["lastTriggered"] == datetime.now(UTC)

    def test_project_deleted(self):
        from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
        from sentry.deletions.tasks.scheduled import run_deletion

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
