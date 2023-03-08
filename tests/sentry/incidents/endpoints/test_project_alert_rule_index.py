from functools import cached_property
from unittest.mock import patch

import pytest
import pytz
import requests
import responses
from django.test.utils import override_settings
from freezegun import freeze_time

from sentry import audit_log
from sentry.api.serializers import serialize
from sentry.incidents.models import AlertRule, AlertRuleTrigger, AlertRuleTriggerAction
from sentry.models import AuditLogEntry, Integration
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.naming_layer.mri import SessionMRI
from sentry.testutils import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import exempt_from_silo_limits, region_silo_test
from sentry.utils import json
from tests.sentry.api.serializers.test_alert_rule import BaseAlertRuleSerializerTest

pytestmark = [pytest.mark.sentry_metrics]


@region_silo_test(stable=True)
class AlertRuleListEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-alert-rules"

    @cached_property
    def organization(self):
        return self.create_organization()

    @cached_property
    def project(self):
        return self.create_project(organization=self.organization)

    @cached_property
    def user(self):
        return self.create_user()

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


@region_silo_test(stable=True)
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
        with outbox_runner():
            with self.feature(["organizations:incidents", "organizations:performance-view"]):
                resp = self.get_success_response(
                    self.organization.slug,
                    self.project.slug,
                    status_code=201,
                    **self.valid_alert_rule,
                )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

        with exempt_from_silo_limits():
            audit_log_entry = AuditLogEntry.objects.filter(
                event=audit_log.get_event_id("ALERT_RULE_ADD"), target_object=alert_rule.id
            )
        assert len(audit_log_entry) == 1
        assert (
            resp.renderer_context["request"].META["REMOTE_ADDR"]
            == list(audit_log_entry)[0].ip_address
        )

    @override_settings(MAX_QUERY_SUBSCRIPTIONS_PER_ORG=1)
    def test_enforce_max_subscriptions(self):
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, self.project.slug, status_code=201, **self.valid_alert_rule
            )
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

        with self.feature("organizations:incidents"):
            resp = self.get_error_response(
                self.organization.slug, self.project.slug, **self.valid_alert_rule
            )
            assert resp.data[0] == "You may not exceed 1 metric alerts per organization"

    def test_no_feature(self):
        resp = self.get_response(self.organization.slug, self.project.slug)
        assert resp.status_code == 404

    def test_no_perms(self):
        member_user = self.create_user()
        self.create_member(
            user=member_user, organization=self.organization, role="member", teams=[self.team]
        )
        self.organization.update_option("sentry:alerts_member_write", False)
        self.login_as(member_user)
        resp = self.get_response(self.organization.slug, self.project.slug, **self.valid_alert_rule)
        assert resp.status_code == 403

    @patch(
        "sentry.integrations.slack.utils.channel.get_channel_id_with_timeout",
        return_value=("#", None, True),
    )
    @patch("sentry.tasks.integrations.slack.find_channel_id_for_alert_rule.apply_async")
    @patch("sentry.integrations.slack.utils.rule_status.uuid4")
    def test_kicks_off_slack_async_job(
        self, mock_uuid4, mock_find_channel_id_for_alert_rule, mock_get_channel_id
    ):
        mock_uuid4.return_value = self.get_mock_uuid()
        with exempt_from_silo_limits():
            self.integration = Integration.objects.create(
                provider="slack",
                name="Team A",
                external_id="TXXXXXXX1",
                metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
            )
            self.integration.add_organization(self.organization, self.user)
        valid_alert_rule = {
            **self.valid_alert_rule,
            "triggers": [
                {
                    "label": "critical",
                    "alertThreshold": 200,
                    "actions": [
                        {
                            "type": "slack",
                            "targetIdentifier": "my-channel",
                            "targetType": "specific",
                            "integration": self.integration.id,
                        }
                    ],
                },
            ],
        }
        with self.feature(["organizations:incidents"]):
            resp = self.get_success_response(
                self.organization.slug, self.project.slug, status_code=202, **valid_alert_rule
            )
        resp.data["uuid"] = "abc123"
        assert not AlertRule.objects.filter(name="JustAValidTestRule").exists()
        kwargs = {
            "organization_id": self.organization.id,
            "uuid": "abc123",
            "data": valid_alert_rule,
            "user_id": self.user.id,
        }
        mock_find_channel_id_for_alert_rule.assert_called_once_with(kwargs=kwargs)

    def test_no_owner(self):
        rule_data = {
            **self.valid_alert_rule,
            "thresholdType": 1,
            "triggers": [{"label": "critical", "alertThreshold": 75}],
        }

        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, self.project.slug, status_code=201, **rule_data
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

    @patch(
        "sentry.integrations.slack.utils.channel.get_channel_id_with_timeout",
        side_effect=[("#", 10, False), ("#", 10, False), ("#", 20, False)],
    )
    @patch("sentry.integrations.slack.utils.rule_status.uuid4")
    def test_async_lookup_outside_transaction(self, mock_uuid4, mock_get_channel_id):
        mock_uuid4.return_value = self.get_mock_uuid()

        with exempt_from_silo_limits():
            self.integration = Integration.objects.create(
                provider="slack",
                name="Team A",
                external_id="TXXXXXXX1",
                metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
            )
            self.integration.add_organization(self.organization, self.user)
        name = "MySpecialAsyncTestRule"
        test_params = {
            **self.valid_alert_rule,
            "name": name,
            "thresholdType": 1,
            "triggers": [
                {
                    "label": "critical",
                    "alertThreshold": 75,
                    "actions": [
                        {
                            "type": "slack",
                            "targetIdentifier": "my-channel",
                            "targetType": "specific",
                            "integrationId": self.integration.id,
                        },
                    ],
                },
            ],
        }

        with self.feature("organizations:incidents"), self.tasks():
            resp = self.get_response(self.organization.slug, self.project.slug, **test_params)
        assert resp.data["uuid"] == "abc123"
        assert mock_get_channel_id.call_count == 1
        # Using get deliberately as there should only be one. Test should fail otherwise.
        alert_rule = AlertRule.objects.get(name=name)
        trigger = AlertRuleTrigger.objects.get(alert_rule_id=alert_rule.id)
        action = AlertRuleTriggerAction.objects.get(alert_rule_trigger=trigger)
        assert action.target_identifier == "10"
        assert action.target_display == "my-channel"

        # Now two actions with slack:
        name = "MySpecialAsyncTestRuleTakeTwo"
        test_params["name"] = name
        test_params["triggers"] = [
            {
                "label": "critical",
                "alertThreshold": 75,
                "actions": [
                    {
                        "type": "slack",
                        "targetIdentifier": "my-channel",
                        "targetType": "specific",
                        "integrationId": self.integration.id,
                    },
                    {
                        "type": "slack",
                        "targetIdentifier": "another-channel",
                        "targetType": "specific",
                        "integrationId": self.integration.id,
                    },
                ],
            },
        ]
        with self.feature("organizations:incidents"), self.tasks():
            resp = self.get_response(self.organization.slug, self.project.slug, **test_params)
        assert resp.data["uuid"] == "abc123"
        assert (
            mock_get_channel_id.call_count == 3
        )  # just made 2 calls, plus the call from the single action test
        # Using get deliberately as there should only be one. Test should fail otherwise.
        alert_rule = AlertRule.objects.get(name=name)

        trigger = AlertRuleTrigger.objects.get(alert_rule_id=alert_rule.id)
        actions = AlertRuleTriggerAction.objects.filter(alert_rule_trigger=trigger).order_by("id")
        assert actions[0].target_identifier == "10"
        assert actions[0].target_display == "my-channel"
        assert actions[1].target_identifier == "20"
        assert actions[1].target_display == "another-channel"

        # Now an invalid action (we want to early out with a good validationerror and not schedule the task):
        name = "MyInvalidActionRule"
        test_params["name"] = name
        test_params["triggers"] = [
            {
                "label": "critical",
                "alertThreshold": 75,
                "actions": [
                    {
                        "type": "element",
                        "targetIdentifier": "my-channel",
                        "targetType": "arbitrary",
                        "integrationId": self.integration.id,
                    },
                ],
            },
        ]
        with self.feature("organizations:incidents"), self.tasks():
            resp = self.get_response(self.organization.slug, self.project.slug, **test_params)
        assert resp.status_code == 400
        # Did not increment from the last assertion because we early out on the validation error
        assert mock_get_channel_id.call_count == 3

    def test_no_config_sentry_app(self):
        sentry_app = self.create_sentry_app(is_alertable=True)
        self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization, user=self.user
        )
        alert_rule = {
            **self.valid_alert_rule,
            "triggers": [
                {
                    "actions": [
                        {
                            "type": "sentry_app",
                            "targetType": "sentry_app",
                            "targetIdentifier": sentry_app.id,
                            "sentryAppId": sentry_app.id,
                        }
                    ],
                    "alertThreshold": 300,
                    "label": "critical",
                }
            ],
        }
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            self.get_success_response(
                self.organization.slug, self.project.slug, status_code=201, **alert_rule
            )

    @responses.activate
    def test_success_response_from_sentry_app(self):
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=202,
        )

        sentry_app = self.create_sentry_app(
            name="foo",
            organization=self.organization,
            schema={
                "elements": [
                    self.create_alert_rule_action_schema(),
                ]
            },
        )
        install = self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization, user=self.user
        )

        sentry_app_settings = [
            {"name": "title", "value": "test title"},
            {"name": "description", "value": "test description"},
        ]

        alert_rule = {
            **self.valid_alert_rule,
            "triggers": [
                {
                    "actions": [
                        {
                            "type": "sentry_app",
                            "targetType": "sentry_app",
                            "targetIdentifier": sentry_app.id,
                            "hasSchemaFormConfig": True,
                            "sentryAppId": sentry_app.id,
                            "sentryAppInstallationUuid": install.uuid,
                            "settings": sentry_app_settings,
                        }
                    ],
                    "alertThreshold": 300,
                    "label": "critical",
                }
            ],
        }

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            self.get_success_response(
                self.organization.slug, self.project.slug, status_code=201, **alert_rule
            )

    @responses.activate
    def test_error_response_from_sentry_app(self):
        error_message = "Everything is broken!"
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=500,
            json={"message": error_message},
        )

        sentry_app = self.create_sentry_app(
            name="foo",
            organization=self.organization,
            schema={
                "elements": [
                    self.create_alert_rule_action_schema(),
                ]
            },
        )
        install = self.create_sentry_app_installation(
            slug="foo", organization=self.organization, user=self.user
        )

        sentry_app_settings = [
            {"name": "title", "value": "test title"},
            {"name": "description", "value": "test description"},
        ]

        alert_rule = {
            **self.valid_alert_rule,
            "triggers": [
                {
                    "actions": [
                        {
                            "type": "sentry_app",
                            "targetType": "sentry_app",
                            "targetIdentifier": sentry_app.id,
                            "hasSchemaFormConfig": True,
                            "sentryAppId": sentry_app.id,
                            "sentryAppInstallationUuid": install.uuid,
                            "settings": sentry_app_settings,
                        }
                    ],
                    "alertThreshold": 300,
                    "label": "critical",
                }
            ],
        }

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp = self.get_response(self.organization.slug, self.project.slug, **alert_rule)

        assert resp.status_code == 400
        assert error_message in resp.data["sentry_app"]


@region_silo_test(stable=True)
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
            projects=self.projects, date_added=before_now(minutes=6).replace(tzinfo=pytz.UTC)
        )
        self.other_alert_rule = self.create_alert_rule(
            projects=self.projects, date_added=before_now(minutes=5).replace(tzinfo=pytz.UTC)
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
            projects=self.projects, date_added=before_now(minutes=3).replace(tzinfo=pytz.UTC)
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

        links = requests.utils.parse_header_links(
            response.get("link").rstrip(">").replace(">,<", ",<")
        )
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

        links = requests.utils.parse_header_links(
            response.get("link").rstrip(">").replace(">,<", ",<")
        )
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

        links = requests.utils.parse_header_links(
            response.get("link").rstrip(">").replace(">,<", ",<")
        )
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
            projects=self.projects, date_added=date_added.replace(tzinfo=pytz.UTC)
        )
        self.two_alert_rule = self.create_alert_rule(
            projects=self.projects, date_added=date_added.replace(tzinfo=pytz.UTC)
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

        links = requests.utils.parse_header_links(
            response.get("link").rstrip(">").replace(">,<", ",<")
        )
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


@region_silo_test(stable=True)
@freeze_time()
class AlertRuleCreateEndpointTestCrashRateAlert(APITestCase):
    endpoint = "sentry-api-0-project-alert-rules"
    method = "post"

    def setUp(self):
        super().setUp()
        self.valid_alert_rule = {
            "aggregate": "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
            "query": "",
            "timeWindow": "60",
            "resolveThreshold": 90,
            "thresholdType": 1,
            "triggers": [
                {
                    "label": "critical",
                    "alertThreshold": 70,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id}
                    ],
                },
                {
                    "label": "warning",
                    "alertThreshold": 80,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id},
                        {"type": "email", "targetType": "user", "targetIdentifier": self.user.id},
                    ],
                },
            ],
            "projects": [self.project.slug],
            "owner": self.user.id,
            "name": "JustAValidTestRule",
            "dataset": "sessions",
            "eventTypes": [],
        }
        # Login
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)

    @cached_property
    def organization(self):
        return self.create_organization()

    @cached_property
    def project(self):
        return self.create_project(organization=self.organization)

    @cached_property
    def user(self):
        return self.create_user()

    def test_simple_crash_rate_alerts_for_sessions(self):
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp = self.get_success_response(
                self.organization.slug, self.project.slug, status_code=201, **self.valid_alert_rule
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

    def test_simple_crash_rate_alerts_for_users(self):
        self.valid_alert_rule.update(
            {
                "aggregate": "percentage(users_crashed, users) AS _crash_rate_alert_aggregate",
            }
        )
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp = self.get_success_response(
                self.organization.slug, self.project.slug, status_code=201, **self.valid_alert_rule
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

    def test_simple_crash_rate_alerts_for_sessions_drops_event_types(self):
        self.valid_alert_rule["eventTypes"] = ["error"]
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp = self.get_success_response(
                self.organization.slug, self.project.slug, status_code=201, **self.valid_alert_rule
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

    def test_simple_crash_rate_alerts_for_sessions_with_invalid_time_window(self):
        self.valid_alert_rule["timeWindow"] = "90"
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp = self.get_error_response(
                self.organization.slug, self.project.slug, status_code=400, **self.valid_alert_rule
            )
        assert (
            resp.data["nonFieldErrors"][0]
            == "Invalid Time Window: Allowed time windows for crash rate alerts are: "
            "30min, 1h, 2h, 4h, 12h and 24h"
        )

    def test_simple_crash_rate_alerts_for_non_supported_aggregate(self):
        self.valid_alert_rule.update({"aggregate": "count(sessions)"})
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp = self.get_error_response(
                self.organization.slug, self.project.slug, status_code=400, **self.valid_alert_rule
            )
        assert (
            resp.data["nonFieldErrors"][0]
            == "Only crash free percentage queries are supported for crash rate alerts"
        )

    @patch(
        "sentry.integrations.slack.utils.channel.get_channel_id_with_timeout",
        return_value=("#", None, True),
    )
    @patch("sentry.tasks.integrations.slack.find_channel_id_for_alert_rule.apply_async")
    @patch("sentry.integrations.slack.utils.rule_status.uuid4")
    def test_crash_rate_alerts_kicks_off_slack_async_job(
        self, mock_uuid4, mock_find_channel_id_for_alert_rule, mock_get_channel_id
    ):
        mock_uuid4.return_value = self.get_mock_uuid()
        with exempt_from_silo_limits():
            self.integration = Integration.objects.create(
                provider="slack",
                name="Team A",
                external_id="TXXXXXXX1",
                metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
            )
            self.integration.add_organization(self.organization, self.user)
        self.valid_alert_rule["triggers"] = [
            {
                "label": "critical",
                "alertThreshold": 50,
                "actions": [
                    {
                        "type": "slack",
                        "targetIdentifier": "my-channel",
                        "targetType": "specific",
                        "integration": self.integration.id,
                    }
                ],
            },
        ]
        with self.feature(["organizations:incidents"]):
            resp = self.get_success_response(
                self.organization.slug, self.project.slug, status_code=202, **self.valid_alert_rule
            )
        resp.data["uuid"] = "abc123"
        assert not AlertRule.objects.filter(name="JustAValidTestRule").exists()
        kwargs = {
            "organization_id": self.organization.id,
            "uuid": "abc123",
            "data": self.valid_alert_rule,
            "user_id": self.user.id,
        }
        mock_find_channel_id_for_alert_rule.assert_called_once_with(kwargs=kwargs)


@region_silo_test(stable=True)
@freeze_time()
class MetricsCrashRateAlertCreationTest(AlertRuleCreateEndpointTestCrashRateAlert):
    endpoint = "sentry-api-0-project-alert-rules"
    method = "post"

    def setUp(self):
        super().setUp()
        self.valid_alert_rule["dataset"] = Dataset.Metrics.value
        for tag in [
            SessionMRI.SESSION.value,
            SessionMRI.USER.value,
            "session.status",
            "init",
            "crashed",
        ]:
            indexer.record(
                use_case_id=UseCaseKey.RELEASE_HEALTH, org_id=self.organization.id, string=tag
            )
