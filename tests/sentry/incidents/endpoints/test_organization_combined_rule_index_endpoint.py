from datetime import UTC, datetime

import requests
import responses

from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import (
    AlertRuleThresholdType,
)
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.rule import RuleSource
from sentry.monitors.models import MonitorStatus
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.actor import Actor
from sentry.types.group import PriorityLevel
from sentry.uptime.types import UptimeMonitorMode
from sentry.workflow_engine.migration_helpers.alert_rule import (
    migrate_alert_rule,
    migrate_metric_action,
    migrate_metric_data_conditions,
)
from sentry.workflow_engine.migration_helpers.issue_alert_migration import IssueAlertMigrator
from sentry.workflow_engine.models import (
    AlertRuleDetector,
    AlertRuleWorkflow,
    Detector,
    DetectorState,
    DetectorWorkflow,
    IncidentGroupOpenPeriod,
    Workflow,
    WorkflowActionGroupStatus,
    WorkflowFireHistory,
)
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.incidents.endpoints.serializers.test_alert_rule import BaseAlertRuleSerializerTest


class OrganizationCombinedRuleIndexEndpointTest(BaseAlertRuleSerializerTest, APITestCase):
    endpoint = "sentry-api-0-organization-combined-rules"

    def setUp(self) -> None:
        super().setUp()

        self.team = self.create_team(
            organization=self.organization,
            name="Mariachi Band",
            members=[self.user],
        )
        self.team2 = self.create_team(
            organization=self.organization,
            name="Folk Band",
            members=[self.user],
        )
        self.project = self.create_project(
            organization=self.organization,
            teams=[self.team],
            name="Bengal",
        )
        self.project2 = self.create_project(
            organization=self.organization,
            teams=[self.team],
            name="Elephant",
        )

        self.projects = [self.project, self.project2]
        self.project_ids = [str(self.project.id), str(self.project2.id)]

        self.login_as(self.user)
        self.combined_rules_url = f"/api/0/organizations/{self.organization.slug}/combined-rules/"

    def create_alert_rule(self, *args, **kwargs):
        alert_rule = super().create_alert_rule(*args, **kwargs)
        _, _, workflow, detector, *_ = migrate_alert_rule(alert_rule)
        # migrate_alert_rule auto-stamps now() on the workflow-engine rows, but the
        # combined-rules endpoint sorts by date_added. Mirror the legacy AlertRule's
        # date_added so order-sensitive tests still pass.
        Detector.objects.filter(id=detector.id).update(date_added=alert_rule.date_added)
        Workflow.objects.filter(id=workflow.id).update(date_added=alert_rule.date_added)
        return alert_rule

    def create_issue_alert_rule(self, data):
        rule = super().create_issue_alert_rule(data)
        workflow = IssueAlertMigrator(rule).run()
        Workflow.objects.filter(id=workflow.id).update(date_added=rule.date_added)
        return rule

    def assert_alert_rule_serialized(
        self, alert_rule, result, skip_dates=False, resolve_threshold=None
    ):
        # The workflow engine serializer only populates trigger-derived fields
        # (thresholdType, resolveThreshold, etc.) when a trigger exists. Tests in
        # this class create rules without triggers, so just check identity.
        assert result["id"] == str(alert_rule.id)
        assert result["name"] == alert_rule.name

    def setup_rules(self) -> None:
        self.alert_rule = self.create_alert_rule(
            name="alert rule",
            organization=self.organization,
            projects=[self.project],
            date_added=before_now(minutes=6),
            owner=Actor.from_id(user_id=None, team_id=self.team.id),
        )
        self.alert_rule_2 = self.create_alert_rule(
            name="other alert rule",
            organization=self.organization,
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
        self.alert_rule_team2 = self.create_alert_rule(
            name="yet another alert rule",
            organization=self.organization,
            projects=[self.project],
            date_added=before_now(minutes=3),
            owner=Actor.from_id(user_id=None, team_id=self.team2.id),
        )

    def test_no_cron_monitor_rules(self) -> None:
        """
        Tests that the shadow cron monitor rules are NOT returned as part of
        the list of alert rules.
        """
        self.create_alert_rule()
        cron_rule = self.create_project_rule(
            name="Cron Rule",
            source=RuleSource.CRON_MONITOR,
        )

        with self.feature("organizations:incidents"):
            resp = self.get_success_response(self.organization.slug)

        assert len(resp.data) == 1
        assert cron_rule.id not in (r["id"] for r in resp.data), resp.data

    def test_no_perf_alerts(self) -> None:
        self.create_alert_rule()
        perf_alert_rule = self.create_alert_rule(query="p95", dataset=Dataset.Transactions)
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(self.organization.slug)
            assert perf_alert_rule.id not in [x["id"] for x in list(resp.data)]

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp = self.get_success_response(self.organization.slug)
            assert perf_alert_rule.id in [int(x["id"]) for x in list(resp.data)]

    def test_simple(self) -> None:
        self.setup_rules()
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "10", "project": self.project_ids}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        result = response.data
        assert len(result) == 4
        self.assert_alert_rule_serialized(self.alert_rule_team2, result[0], skip_dates=True)
        assert result[1]["id"] == str(self.issue_rule.id)
        assert result[1]["type"] == "rule"
        self.assert_alert_rule_serialized(self.alert_rule_2, result[2], skip_dates=True)
        self.assert_alert_rule_serialized(self.alert_rule, result[3], skip_dates=True)

    def test_snoozed_rules(self) -> None:
        """
        Test that we properly serialize snoozed rules with and without an owner
        """
        self.setup_rules()
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
        # workflow_engine derives snooze from Workflow.enabled / Detector.enabled
        # rather than the legacy RuleSnooze table, so disable the underlying
        # workflow_engine rows to mark each rule as snoozed.
        snoozed_workflow_rule_ids = [self.issue_rule.id, issue_rule2.id]
        snoozed_alert_rule_ids = [self.alert_rule.id, self.alert_rule_team2.id]
        Workflow.objects.filter(
            id__in=AlertRuleWorkflow.objects.filter(
                rule_id__in=snoozed_workflow_rule_ids
            ).values_list("workflow_id", flat=True)
        ).update(enabled=False)
        Detector.objects.filter(
            id__in=AlertRuleDetector.objects.filter(
                alert_rule_id__in=snoozed_alert_rule_ids
            ).values_list("detector_id", flat=True)
        ).update(enabled=False)

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "10", "project": self.project_ids}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        result = response.data
        assert len(result) == 5
        self.assert_alert_rule_serialized(self.alert_rule_team2, result[0], skip_dates=True)
        assert result[0]["snooze"]

        assert result[1]["id"] == str(issue_rule2.id)
        assert result[1]["type"] == "rule"
        assert result[1]["snooze"]

        assert result[2]["id"] == str(self.issue_rule.id)
        assert result[2]["type"] == "rule"
        assert result[2]["snooze"]

        self.assert_alert_rule_serialized(self.alert_rule_2, result[3], skip_dates=True)
        assert not result[3].get("snooze")

        self.assert_alert_rule_serialized(self.alert_rule, result[4], skip_dates=True)
        assert result[4]["snooze"]

    def test_invalid_limit(self) -> None:
        self.setup_rules()
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "notaninteger"}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 400

    def test_limit_as_1_with_paging_sort_name(self) -> None:
        self.setup_rules()
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
        result = response.data
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
        result = response.data
        assert len(result) == 1
        assert result[0]["id"] == str(self.issue_rule.id)
        assert result[0]["type"] == "rule"

    def test_limit_as_1_with_paging_sort_name_urlencode(self) -> None:
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
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
        result = response.data
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
        result = response.data
        assert len(result) == 1
        assert result[0]["id"] == str(alert_rule1.id)

    def test_limit_as_1_with_paging(self) -> None:
        self.setup_rules()

        # Test Limit as 1, no cursor:
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "1", "project": self.project_ids}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200

        result = response.data
        assert len(result) == 1
        self.assert_alert_rule_serialized(self.alert_rule_team2, result[0], skip_dates=True)

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
        result = response.data
        assert len(result) == 1
        assert result[0]["id"] == str(self.issue_rule.id)
        assert result[0]["type"] == "rule"

    def test_limit_as_2_with_paging(self) -> None:
        self.setup_rules()

        # Test Limit as 2, no cursor:
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "2", "project": self.project_ids}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200

        result = response.data
        assert len(result) == 2
        self.assert_alert_rule_serialized(self.alert_rule_team2, result[0], skip_dates=True)
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

        result = response.data
        assert len(result) == 2
        self.assert_alert_rule_serialized(self.alert_rule_2, result[0], skip_dates=True)
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

        result = response.data
        assert len(result) == 0

    def test_offset_pagination(self) -> None:
        self.setup_rules()

        date_added = before_now(minutes=1)
        one_alert_rule = self.create_alert_rule(
            organization=self.organization,
            projects=[self.project],
            date_added=date_added,
        )
        two_alert_rule = self.create_alert_rule(
            organization=self.organization,
            projects=[self.project2],
            date_added=date_added,
        )
        three_alert_rule = self.create_alert_rule(
            organization=self.organization, projects=[self.project]
        )

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "2", "project": self.project_ids}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200

        result = response.data
        assert len(result) == 2
        self.assert_alert_rule_serialized(three_alert_rule, result[0], skip_dates=True)
        self.assert_alert_rule_serialized(one_alert_rule, result[1], skip_dates=True)

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

        result = response.data
        assert len(result) == 2

        self.assert_alert_rule_serialized(two_alert_rule, result[0], skip_dates=True)
        self.assert_alert_rule_serialized(self.alert_rule_team2, result[1], skip_dates=True)

    def test_filter_by_project(self) -> None:
        self.setup_rules()

        date_added = before_now(minutes=1)
        one_alert_rule = self.create_alert_rule(
            organization=self.organization,
            projects=[self.project],
            date_added=date_added,
        )
        two_alert_rule = self.create_alert_rule(
            organization=self.organization,
            projects=[self.project],
            date_added=date_added,
        )
        three_alert_rule = self.create_alert_rule(
            organization=self.organization, projects=[self.project2]
        )
        uptime_detector = self.create_uptime_detector(project=self.project)
        uptime_detector2 = self.create_uptime_detector(project=self.project2)

        proj_cron_monitor = self.create_monitor(project=self.project)
        proj2_cron_monitor = self.create_monitor(project=self.project2)

        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
            ]
        ):
            request_data = {"project": [self.project.id]}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200

        result = response.data

        assert [r["id"] for r in result] == [
            f"{proj_cron_monitor.guid}",
            f"{uptime_detector.id}",
            f"{one_alert_rule.id}",
            f"{two_alert_rule.id}",
            f"{self.alert_rule_team2.id}",
            f"{self.issue_rule.id}",
            f"{self.alert_rule.id}",
        ]

        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
            ]
        ):
            request_data = {"project": [self.project2.id]}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200

        result = response.data
        assert [r["id"] for r in result] == [
            f"{proj2_cron_monitor.guid}",
            f"{uptime_detector2.id}",
            f"{three_alert_rule.id}",
            f"{self.alert_rule_2.id}",
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

    def test_team_filter(self) -> None:
        self.setup_rules()
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "10", "project": [self.project.id]}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        result = response.data
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
        result = response.data
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
        result = response.data
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
        result = response.data
        assert len(result) == 3

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "10", "project": [self.project.id], "team": ["unassigned"]}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        result = response.data
        assert len(result) == 1

        an_unassigned_alert_rule = self.create_alert_rule(
            organization=self.organization,
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
        result = response.data
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
        result = response.data
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
        result = response.data
        assert len(result) == 3

        issue_rule2 = self.create_issue_alert_rule(
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
        result = response.data
        assert len(result) == 2

        team_uptime_detector = self.create_uptime_detector(owner=self.team, name="Uptime owned")
        unowned_uptime_detector = self.create_uptime_detector(name="Uptime unowned")

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
        result = response.data
        assert [r["id"] for r in result] == [
            f"{team_cron_monitor.guid}",
            f"{team_uptime_detector.id}",
            f"{issue_rule2.id}",
            f"{self.alert_rule.id}",
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
                "team": ["unassigned"],
            }
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        result = response.data
        assert [r["id"] for r in result] == [
            f"{unowned_cron_monitor.guid}",
            f"{unowned_uptime_detector.id}",
            f"{an_unassigned_alert_rule.id}",
            f"{self.issue_rule.id}",
        ]

    def test_myteams_filter_superuser(self) -> None:
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

    def test_team_filter_no_cross_org_access(self) -> None:
        self.setup_rules()
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

    def test_team_filter_no_access(self) -> None:
        self.setup_rules()

        # disable Open Membership
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        user2 = self.create_user("bulldog@example.com")
        team2 = self.create_team(organization=self.organization, name="Barking Voices")
        project2 = self.create_project(organization=self.organization, teams=[team2], name="Bones")
        self.create_member(user=user2, organization=self.organization, role="member", teams=[team2])
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

    def test_name_filter(self) -> None:
        self.setup_rules()
        uptime_detector = self.create_uptime_detector(name="Uptime")
        another_uptime_detector = self.create_uptime_detector(name="yet another Uptime")
        cron_monitor = self.create_monitor(name="Cron")
        another_cron_monitor = self.create_monitor(name="yet another Cron")

        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
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
        result = response.data
        assert [r["id"] for r in result] == [
            f"{another_cron_monitor.guid}",
            f"{another_uptime_detector.id}",
            f"{self.alert_rule_team2.id}",
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
        result = response.data
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
        result = response.data
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
        result = response.data
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
        result = response.data
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
        result = response.data
        assert [r["id"] for r in result] == [
            f"{another_uptime_detector.id}",
            f"{uptime_detector.id}",
        ]

        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
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
        result = response.data
        assert [r["id"] for r in result] == [
            f"{another_cron_monitor.guid}",
            f"{cron_monitor.guid}",
        ]

    def test_status_and_date_triggered_sort_order(self) -> None:
        self.setup_rules()

        alert_rule_critical = self.create_alert_rule(
            organization=self.organization,
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
            organization=self.organization,
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
            organization=self.organization,
            projects=[self.project],
            name="warning rule",
            query="",
            aggregate="count()",
            time_window=1,
            threshold_type=AlertRuleThresholdType.ABOVE,
            resolve_threshold=10,
            threshold_period=1,
        )
        self.create_incident(status=2, alert_rule=alert_rule_critical)
        self.create_incident(status=10, alert_rule=alert_rule_critical)
        warning_incident = self.create_incident(status=10, alert_rule=alert_rule_warning)
        another_warning_incident = self.create_incident(
            status=10, alert_rule=another_alert_rule_warning
        )
        crit_incident = self.create_incident(status=20, alert_rule=alert_rule_critical)

        # workflow_engine sorts by DetectorState.state and GroupOpenPeriod.date_started
        # rather than by Incident; mirror the incident state onto the detector + open period.
        for alert_rule, priority, incident in (
            (alert_rule_critical, DetectorPriorityLevel.HIGH, crit_incident),
            (alert_rule_warning, DetectorPriorityLevel.MEDIUM, warning_incident),
            (another_alert_rule_warning, DetectorPriorityLevel.MEDIUM, another_warning_incident),
        ):
            detector = AlertRuleDetector.objects.get(alert_rule_id=alert_rule.id).detector
            DetectorState.objects.filter(detector=detector).update(state=priority)
            group = self.create_group(type=MetricIssue.type_id, project=self.project)
            self.create_detector_group(detector=detector, group=group)
            GroupOpenPeriod.objects.filter(group=group).update(date_started=incident.date_started)

        uptime_detector = self.create_uptime_detector()
        failed_uptime_detector = self.create_uptime_detector(
            detector_state=DetectorPriorityLevel.HIGH,
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
        result = response.data
        # Failing cron first (Monitor tie-breaker beats Detector alphabetically),
        # then the two CRITICAL Detectors in queryset-concatenation order
        # (metric_detectors before uptime_rules), then warnings sorted by
        # triggered date, then issue/no-status items.
        assert [r["id"] for r in result] == [
            f"{failed_cron_monitor.guid}",
            f"{alert_rule_critical.id}",
            f"{failed_uptime_detector.id}",
            f"{another_alert_rule_warning.id}",
            f"{alert_rule_warning.id}",
            f"{self.alert_rule.id}",
            f"{self.alert_rule_2.id}",
            f"{self.alert_rule_team2.id}",
            f"{self.issue_rule.id}",
            f"{ok_cron_monitor.guid}",
            f"{uptime_detector.id}",
        ]

        # Test paging with the status setup:
        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
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
        result = response.data
        assert [r["id"] for r in result] == [
            f"{failed_cron_monitor.guid}",
            f"{alert_rule_critical.id}",
            f"{failed_uptime_detector.id}",
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
        result = response.data
        assert [r["id"] for r in result] == [
            f"{another_alert_rule_warning.id}",
            f"{alert_rule_warning.id}",
            f"{self.alert_rule.id}",
        ]

    def test_uptime_feature(self) -> None:
        self.setup_rules()
        uptime_detector = self.create_uptime_detector(name="Uptime Monitor")
        other_uptime_detector = self.create_uptime_detector(name="Other Uptime Monitor")
        self.create_uptime_detector(
            name="Onboarding Uptime monitor",
            mode=UptimeMonitorMode.AUTO_DETECTED_ONBOARDING,
        )

        request_data = {"name": "Uptime", "project": [self.project.id]}
        response = self.client.get(
            path=self.combined_rules_url, data=request_data, content_type="application/json"
        )
        assert response.status_code == 200, response.content
        result = response.data
        assert [r["id"] for r in result] == [
            f"{other_uptime_detector.id}",
            f"{uptime_detector.id}",
        ]

    def test_uptime_feature_name_sort(self) -> None:
        self.setup_rules()
        self.create_uptime_detector(name="Uptime Monitor")
        self.create_uptime_detector(
            name="Other Uptime Monitor",
        )
        self.create_uptime_detector(
            name="Onboarding Uptime monitor",
            mode=UptimeMonitorMode.AUTO_DETECTED_ONBOARDING,
        )

        request_data = {"project": [self.project.id], "sort": "name"}
        response = self.client.get(
            path=self.combined_rules_url, data=request_data, content_type="application/json"
        )
        assert response.status_code == 200, response.content
        result = response.data
        assert [r["name"] for r in result] == [
            "yet another alert rule",
            "Uptime Monitor",
            "Other Uptime Monitor",
            "Issue Rule Test",
            "alert rule",
        ]

    def test_expand_latest_incident(self) -> None:
        self.setup_rules()

        alert_rule_critical = self.create_alert_rule(
            organization=self.organization,
            projects=[self.project],
            name="some rule [crit]",
            query="",
            aggregate="count()",
            time_window=1,
            threshold_type=AlertRuleThresholdType.ABOVE,
            resolve_threshold=10,
            threshold_period=1,
        )
        trigger = self.create_alert_rule_trigger(alert_rule=alert_rule_critical, label="critical")
        trigger_action = self.create_alert_rule_trigger_action(alert_rule_trigger=trigger)
        migrate_metric_data_conditions(trigger)
        critical_action, _, _ = migrate_metric_action(trigger_action)

        detector = AlertRuleDetector.objects.get(alert_rule_id=alert_rule_critical.id).detector
        workflow = DetectorWorkflow.objects.get(detector=detector).workflow

        self.create_incident(status=2, alert_rule=alert_rule_critical)
        crit_incident = self.create_incident(status=20, alert_rule=alert_rule_critical)

        group = self.create_group(
            type=MetricIssue.type_id, project=self.project, priority=PriorityLevel.HIGH
        )
        self.create_detector_group(detector=detector, group=group)
        WorkflowActionGroupStatus.objects.create(
            action=critical_action, group=group, workflow=workflow
        )
        group_open_period = GroupOpenPeriod.objects.get(group=group)
        group_open_period.update(date_started=crit_incident.date_started)
        IncidentGroupOpenPeriod.objects.create(
            group_open_period=group_open_period,
            incident_id=crit_incident.id,
            incident_identifier=crit_incident.identifier,
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
        result = response.data
        assert len(result) == 4
        assert result[0]["latestIncident"]["id"] == str(crit_incident.id)

    def test_non_existing_owner(self) -> None:
        self.setup_rules()
        team = self.create_team(organization=self.organization, members=[self.user])
        alert_rule = self.create_alert_rule(
            name="the best rule",
            organization=self.organization,
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
        # Detector.owner_team_id is not an FK, so deleting the team leaves a
        # dangling reference. Clear it explicitly so the serializer treats the
        # rule as ownerless (matching the legacy AlertRule.team SET_NULL behavior).
        team_id = team.id
        team.delete()
        Detector.objects.filter(owner_team_id=team_id).update(owner_team_id=None)

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "10"}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200
        assert response.data[0]["id"] == str(alert_rule.id)
        assert response.data[0]["owner"] is None

    @freeze_time()
    def test_last_triggered(self) -> None:
        rule = self.create_issue_alert_rule(
            data={
                "project": self.project,
                "name": "Issue Rule Test",
                "conditions": [],
                "actions": [],
                "actionMatch": "all",
                "date_added": before_now(minutes=4),
            }
        )
        resp = self.get_success_response(self.organization.slug, expand=["lastTriggered"])
        assert resp.data[0]["lastTriggered"] is None
        workflow = Workflow.objects.get(alertruleworkflow__rule_id=rule.id)
        WorkflowFireHistory.objects.create(
            workflow=workflow, group=self.group, event_id="test-event-id"
        )
        resp = self.get_success_response(self.organization.slug, expand=["lastTriggered"])
        assert resp.data[0]["lastTriggered"] == datetime.now(UTC)

    def test_project_deleted(self) -> None:
        from sentry.deletions.models.scheduleddeletion import CellScheduledDeletion
        from sentry.deletions.tasks.scheduled import run_deletion

        org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        team = self.create_team(organization=org, name="Mariachi Band", members=[self.user])
        delete_project = self.create_project(organization=org, teams=[team], name="Bengal")
        self.create_project_rule(project=delete_project)

        deletion = CellScheduledDeletion.schedule(delete_project, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        self.get_success_response(org.slug)

    def test_dataset_filter(self) -> None:
        self.create_alert_rule(dataset=Dataset.Metrics)
        transaction_rule = self.create_alert_rule(dataset=Dataset.Transactions)
        events_rule = self.create_alert_rule(dataset=Dataset.Events)

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

    def test_alert_type_filter(self) -> None:
        # Setup one of each type of alert rule
        metric_rule = self.create_alert_rule()
        issue_rule = self.create_issue_alert_rule(
            data={
                "project": self.project,
                "name": "Issue Rule Test",
                "conditions": [],
                "actions": [],
                "actionMatch": "all",
                "date_added": before_now(minutes=4),
            }
        )
        uptime_rule = self.create_uptime_detector(project=self.project)
        cron_rule = self.create_monitor(project=self.project)

        features = [
            "organizations:incidents",
            "organizations:performance-view",
        ]

        # Everything comes back without the query parameter
        with self.feature(features):
            request_data = {"per_page": "10", "project": [self.project.id]}
            response = self.client.get(
                path=self.combined_rules_url,
                data=request_data,
                content_type="application/json",
            )
            assert response.status_code == 200, response.content
            assert {r["id"] for r in response.data} == {
                str(metric_rule.id),
                str(issue_rule.id),
                str(uptime_rule.id),
                str(cron_rule.guid),
            }

        test_cases: list[tuple[list[str], set[str]]] = [
            (["rule"], {str(issue_rule.id)}),
            (["alert_rule"], {str(metric_rule.id)}),
            (["monitor"], {str(cron_rule.guid)}),
            (["uptime"], {str(uptime_rule.id)}),
            (["rule", "alert_rule"], {str(issue_rule.id), str(metric_rule.id)}),
            (["uptime", "monitor"], {str(uptime_rule.id), str(cron_rule.guid)}),
        ]

        for alert_type, expected_ids in test_cases:
            with self.feature(features):
                request_data = {
                    "per_page": "10",
                    "project": [self.project.id],
                    "alertType": alert_type,
                }
                response = self.client.get(
                    path=self.combined_rules_url,
                    data=request_data,
                    content_type="application/json",
                )
                assert response.status_code == 200, response.content
                assert {r["id"] for r in response.data} == expected_ids

    def test_invalid_sort_key(self) -> None:
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            response = self.get_error_response(
                self.organization.slug, sort=["invalid_field"], status_code=400
            )
            assert "Invalid sort key" in response.data["detail"]


@with_feature(
    [
        "organizations:incidents",
        "organizations:performance-view",
        "organizations:workflow-engine-rule-serializers",
    ]
)
class OrganizationCombinedRuleIndexWorkflowEngineTest(BaseAlertRuleSerializerTest, APITestCase):
    """Tests for the workflow engine code path in the combined rules endpoint."""

    endpoint = "sentry-api-0-organization-combined-rules"

    def setUp(self) -> None:
        super().setUp()

        self.team = self.create_team(
            organization=self.organization,
            name="Mariachi Band",
            members=[self.user],
        )
        self.project = self.create_project(
            organization=self.organization,
            teams=[self.team],
            name="Bengal",
        )
        self.project2 = self.create_project(
            organization=self.organization,
            teams=[self.team],
            name="Elephant",
        )

        self.projects = [self.project, self.project2]
        self.project_ids = [str(self.project.id), str(self.project2.id)]

        self.login_as(self.user)
        self.combined_rules_url = f"/api/0/organizations/{self.organization.slug}/combined-rules/"

    def test_workflow_engine_endpoint_returns_successfully(self) -> None:
        response = self.get_success_response(self.organization.slug, project=[self.project.id])

        # Endpoint should return successfully (empty list is fine)
        assert response.status_code == 200
        assert isinstance(response.data, list)

    def test_workflow_engine_dual_written_rules(self) -> None:
        # Create alert rules which exist in legacy system
        alert_rule1 = self.create_alert_rule(name="Dual Written Rule 1", projects=[self.project])
        alert_rule2 = self.create_alert_rule(name="Dual Written Rule 2", projects=[self.project2])

        # Migrate them to workflow engine (dual-write)
        migrate_alert_rule(alert_rule1)
        migrate_alert_rule(alert_rule2)

        response = self.get_success_response(
            self.organization.slug, project=[self.project.id, self.project2.id]
        )

        assert response.status_code == 200
        assert len(response.data) == 2

        # Verify both rules appear and have correct type
        rule_names = {rule["name"] for rule in response.data}
        assert "Dual Written Rule 1" in rule_names
        assert "Dual Written Rule 2" in rule_names

        # All should be metric alerts (type = "alert_rule")
        for rule in response.data:
            assert rule["type"] == "alert_rule"

    def test_workflow_engine_filters_by_project_slug(self) -> None:
        alert_rule1 = self.create_alert_rule(name="Project Slug Rule 1", projects=[self.project])
        alert_rule2 = self.create_alert_rule(name="Project Slug Rule 2", projects=[self.project2])

        migrate_alert_rule(alert_rule1)
        migrate_alert_rule(alert_rule2)

        response = self.get_success_response(self.organization.slug, project=[self.project.slug])

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["name"] == "Project Slug Rule 1"

    def test_workflow_engine_filtering_by_team(self) -> None:
        # Create second team for testing
        team2 = self.create_team(organization=self.organization, name="Team 2")

        # Create rules with different team assignments using owner parameter
        alert_rule_team1 = self.create_alert_rule(
            name="Team 1 Rule",
            projects=[self.project],
            owner=Actor.from_id(user_id=None, team_id=self.team.id),
        )
        alert_rule_team2 = self.create_alert_rule(
            name="Team 2 Rule",
            projects=[self.project],
            owner=Actor.from_id(user_id=None, team_id=team2.id),
        )
        alert_rule_no_team = self.create_alert_rule(name="No Team Rule", projects=[self.project])

        migrate_alert_rule(alert_rule_team1)
        migrate_alert_rule(alert_rule_team2)
        migrate_alert_rule(alert_rule_no_team)

        # Filter by team 1
        response = self.get_success_response(
            self.organization.slug,
            project=[self.project.id],
            team=[self.team.id],
        )

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["name"] == "Team 1 Rule"

    def test_workflow_engine_filtering_by_name(self) -> None:
        alert_rule1 = self.create_alert_rule(name="Error Rate Alert", projects=[self.project])
        alert_rule2 = self.create_alert_rule(name="Latency Monitor", projects=[self.project])

        migrate_alert_rule(alert_rule1)
        migrate_alert_rule(alert_rule2)

        response = self.get_success_response(
            self.organization.slug,
            project=[self.project.id],
            name="Error",
        )

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["name"] == "Error Rate Alert"

    def test_workflow_engine_dataset_filtering(self) -> None:
        from sentry.snuba.dataset import Dataset

        # Create alert rules with different datasets
        error_rule = self.create_alert_rule(
            name="Error Rule",
            projects=[self.project],
            dataset=Dataset.Events,
        )
        transaction_rule = self.create_alert_rule(
            name="Transaction Rule",
            projects=[self.project],
            dataset=Dataset.Transactions,
        )

        migrate_alert_rule(error_rule)
        migrate_alert_rule(transaction_rule)

        # Test filtering to only Events dataset
        response = self.get_success_response(
            self.organization.slug,
            project=[self.project.id],
            dataset=[Dataset.Events.value],
        )

        assert response.status_code == 200
        # Should only return the error rule, not the transaction rule
        assert len(response.data) == 1
        assert response.data[0]["name"] == "Error Rule"

    @responses.activate
    def test_uninstalled_sentry_app(self) -> None:
        self.superuser = self.create_user("hb@localhost", is_superuser=True)
        self.login_as(user=self.superuser)
        self.create_team(organization=self.organization, members=[self.superuser])

        sentry_app = self.create_sentry_app(
            organization=self.organization,
            published=True,
            verify_install=False,
            name="Super Awesome App",
            schema={"elements": [self.create_alert_rule_action_schema()]},
        )
        installation = self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization, user=self.superuser
        )
        actions = [
            {
                "id": "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
                "sentryAppInstallationUuid": installation.uuid,
                "settings": [
                    {"name": "title", "value": "An alert"},
                    {"name": "points", "value": "3"},
                    {"name": "assignee", "value": "Hellboy"},
                ],
            }
        ]
        rule = self.create_project_rule(
            project=self.project,
            action_data=actions,
            include_legacy_rule_id=False,
            include_workflow_id=False,
        )

        responses.add(
            responses.GET,
            "https://example.com/sentry/members",
            json=[
                {"value": "bob", "label": "Bob"},
                {"value": "jess", "label": "Jess"},
            ],
            status=200,
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            installation.delete()

        response = self.get_success_response(
            self.organization.slug,
            project=[self.project.id],
        )
        assert response.status_code == 200

        assert len(response.data) == 1
        assert len(response.data[0]["actions"]) == 0

        with self.feature("organizations:incidents"):
            response = self.get_success_response(
                self.organization.slug,
                project=[self.project.id],
            )
            assert response.status_code == 200

            assert len(response.data) == 1
            assert len(response.data[0]["actions"]) == 0
            assert response.data[0]["id"] == str(rule.id)
