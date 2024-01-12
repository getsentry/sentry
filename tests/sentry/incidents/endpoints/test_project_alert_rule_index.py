from copy import deepcopy
from datetime import timezone

import requests

from sentry import audit_log
from sentry.api.serializers import serialize
from sentry.incidents.models import AlertRule
from sentry.models.auditlogentry import AuditLogEntry
from sentry.silo import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.utils import json
from tests.sentry.api.serializers.test_alert_rule import BaseAlertRuleSerializerTest

pytestmark = [requires_snuba]


@region_silo_test
class AlertRuleListEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-alert-rules"

    def test_empty(self):
        self.create_team(organization=self.organization, members=[self.user])

    def test_simple(self):
        self.create_team(organization=self.organization, members=[self.user])
        alert_rule = self.create_alert_rule()

        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(self.organization.slug, self.project.slug)

        assert resp.data == serialize([alert_rule])

    def test_no_perf_alerts(self):
        self.create_team(organization=self.organization, members=[self.user])
        alert_rule = self.create_alert_rule()
        perf_alert_rule = self.create_alert_rule(query="p95", dataset=Dataset.Transactions)
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(self.organization.slug, self.project.slug)
            assert resp.data == serialize([alert_rule])

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp = self.get_success_response(self.organization.slug, self.project.slug)
            assert resp.data == serialize([perf_alert_rule, alert_rule])

    def test_no_feature(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug, self.project.slug)
        assert resp.status_code == 404


@region_silo_test
@freeze_time()
class AlertRuleCreateEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-alert-rules"
    method = "post"

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.user = self.create_user()
        self.valid_alert_rule = {
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
            "owner": self.user.id,
            "name": "JustAValidTestRule",
        }
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)

    def test_simple(self):
        with outbox_runner(), self.feature(
            ["organizations:incidents", "organizations:performance-view"]
        ):
            resp = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                status_code=201,
                **self.valid_alert_rule,
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

        with assume_test_silo_mode(SiloMode.CONTROL):
            audit_log_entry = AuditLogEntry.objects.filter(
                event=audit_log.get_event_id("ALERT_RULE_ADD"), target_object=alert_rule.id
            )
        assert len(audit_log_entry) == 1
        assert (
            resp.renderer_context["request"].META["REMOTE_ADDR"]
            == list(audit_log_entry)[0].ip_address
        )

    def test_status_filter(self):
        with outbox_runner(), self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
                "organizations:metric-alert-ignore-archived",
            ]
        ):
            data = deepcopy(self.valid_alert_rule)
            data["query"] = "is:unresolved"
            resp = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                status_code=201,
                **data,
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)
        assert alert_rule.snuba_query.query == "is:unresolved"

    def test_project_not_in_request(self):
        """Test that if you don't provide the project data in the request, we grab it from the URL"""
        data = deepcopy(self.valid_alert_rule)
        del data["projects"]
        with outbox_runner(), self.feature(
            ["organizations:incidents", "organizations:performance-view"]
        ):
            resp = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                status_code=201,
                **data,
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

        with assume_test_silo_mode(SiloMode.CONTROL):
            audit_log_entry = AuditLogEntry.objects.filter(
                event=audit_log.get_event_id("ALERT_RULE_ADD"), target_object=alert_rule.id
            )
        assert len(audit_log_entry) == 1
        assert (
            resp.renderer_context["request"].META["REMOTE_ADDR"]
            == list(audit_log_entry)[0].ip_address
        )


@region_silo_test
class ProjectCombinedRuleIndexEndpointTest(BaseAlertRuleSerializerTest, APITestCase):
    endpoint = "sentry-api-0-project-combined-rules"

    def test_no_perf_alerts(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.create_alert_rule()
        perf_alert_rule = self.create_alert_rule(query="p95", dataset=Dataset.Transactions)
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(self.organization.slug, self.project.slug)
            assert perf_alert_rule.id not in [x["id"] for x in list(resp.data)]

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp = self.get_success_response(self.organization.slug, self.project.slug)
            assert perf_alert_rule.id in [int(x["id"]) for x in list(resp.data)]

    def setup_project_and_rules(self):
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.login_as(self.user)
        self.projects = [self.project, self.create_project()]
        self.alert_rule = self.create_alert_rule(
            projects=self.projects, date_added=before_now(minutes=6).replace(tzinfo=timezone.utc)
        )
        self.other_alert_rule = self.create_alert_rule(
            projects=self.projects, date_added=before_now(minutes=5).replace(tzinfo=timezone.utc)
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
            projects=self.projects, date_added=before_now(minutes=3).replace(tzinfo=timezone.utc)
        )
        self.combined_rules_url = (
            f"/api/0/projects/{self.org.slug}/{self.project.slug}/combined-rules/"
        )

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
            request_data = {"per_page": "5"}
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

    def test_limit_as_1_with_paging(self):
        self.setup_project_and_rules()

        # Test Limit as 1, no cursor:
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "1"}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200

        result = json.loads(response.content)
        assert len(result) == 1
        self.assert_alert_rule_serialized(self.yet_another_alert_rule, result[0], skip_dates=True)

        links = requests.utils.parse_header_links(response["link"].rstrip(">").replace(">,<", ",<"))
        next_cursor = links[1]["cursor"]

        # Test Limit as 1, next page of previous request:
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"cursor": next_cursor, "per_page": "1"}
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
            request_data = {"per_page": "2"}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200

        result = json.loads(response.content)
        assert len(result) == 2
        self.assert_alert_rule_serialized(self.yet_another_alert_rule, result[0], skip_dates=True)
        assert result[1]["id"] == str(self.issue_rule.id)
        assert result[1]["type"] == "rule"

        links = requests.utils.parse_header_links(response["link"].rstrip(">").replace(">,<", ",<"))
        next_cursor = links[1]["cursor"]
        # Test Limit 2, next page of previous request:
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"cursor": next_cursor, "per_page": "2"}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200

        result = json.loads(response.content)
        assert len(result) == 2
        self.assert_alert_rule_serialized(self.other_alert_rule, result[0], skip_dates=True)
        self.assert_alert_rule_serialized(self.alert_rule, result[1], skip_dates=True)

        links = requests.utils.parse_header_links(response["link"].rstrip(">").replace(">,<", ",<"))
        next_cursor = links[1]["cursor"]

        # Test Limit 2, next page of previous request - should get no results since there are only 4 total:
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"cursor": next_cursor, "per_page": "2"}
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
            projects=self.projects, date_added=date_added.replace(tzinfo=timezone.utc)
        )
        self.two_alert_rule = self.create_alert_rule(
            projects=self.projects, date_added=date_added.replace(tzinfo=timezone.utc)
        )
        self.three_alert_rule = self.create_alert_rule(projects=self.projects)

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"per_page": "2"}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200

        result = json.loads(response.content)
        assert len(result) == 2
        self.assert_alert_rule_serialized(self.three_alert_rule, result[0], skip_dates=True)
        self.assert_alert_rule_serialized(self.one_alert_rule, result[1], skip_dates=True)

        links = requests.utils.parse_header_links(response["link"].rstrip(">").replace(">,<", ",<"))
        next_cursor = links[1]["cursor"]
        assert next_cursor.split(":")[1] == "1"  # Assert offset is properly calculated.

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            request_data = {"cursor": next_cursor, "per_page": "2"}
            response = self.client.get(
                path=self.combined_rules_url, data=request_data, content_type="application/json"
            )
        assert response.status_code == 200

        result = json.loads(response.content)
        assert len(result) == 2

        self.assert_alert_rule_serialized(self.two_alert_rule, result[0], skip_dates=True)
        self.assert_alert_rule_serialized(self.yet_another_alert_rule, result[1], skip_dates=True)
