from __future__ import annotations

from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import MagicMock, patch

import responses
from rest_framework import status
from slack_sdk.web.slack_response import SlackResponse

from sentry.analytics.events.rule_disable_opt_out import (
    RuleDisableOptOutEdit,
    RuleDisableOptOutExplicit,
)
from sentry.analytics.events.rule_reenable import RuleReenableEdit
from sentry.constants import ObjectStatus
from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.integrations.slack.utils.channel import strip_channel_name
from sentry.models.environment import Environment
from sentry.models.rule import NeglectedRule, Rule, RuleActivity, RuleActivityType
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.sentry_apps.services.app.model import RpcAlertRuleActionResult
from sentry.sentry_apps.utils.errors import SentryAppErrorType
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import install_slack
from sentry.testutils.helpers.analytics import assert_any_analytics_event
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.actor import Actor
from sentry.workflow_engine.models import AlertRuleWorkflow
from sentry.workflow_engine.models.data_condition import DataCondition
from sentry.workflow_engine.models.data_condition_group import DataConditionGroup
from sentry.workflow_engine.models.workflow import Workflow
from sentry.workflow_engine.models.workflow_data_condition_group import WorkflowDataConditionGroup


def assert_rule_from_payload(rule: Rule, payload: Mapping[str, Any]) -> None:
    """
    Helper function to assert every field on a Rule was modified correctly from the incoming payload
    """
    rule.refresh_from_db()
    assert rule.label == payload.get("name")

    owner_id = payload.get("owner")
    if owner_id:
        actor = Actor.from_identifier(owner_id)
        if actor.is_user:
            assert rule.owner_user_id == actor.id
            assert rule.owner_team_id is None
        if actor.is_team:
            assert rule.owner_team_id == actor.id
            assert rule.owner_user_id is None
    else:
        assert rule.owner_team_id is None
        assert rule.owner_user_id is None

    environment = payload.get("environment")
    if environment:
        assert (
            rule.environment_id
            == Environment.objects.get(projects=rule.project, name=environment).id
        )
    else:
        assert rule.environment_id is None
    assert rule.data["action_match"] == payload.get("actionMatch")
    assert rule.data["filter_match"] == payload.get("filterMatch")
    # For actions/conditions/filters, payload might only have a portion of the rule data so we use
    # any(a.items() <= b.items()) to check if the payload dict is a subset of the rule.data dict
    # E.g. payload["actions"] = [{"name": "Test1"}], rule.data["actions"] = [{"name": "Test1", "id": 1}]
    for payload_action in payload.get("actions", []):
        if payload_action.get("name"):
            del payload_action["name"]
        # The Slack payload will contain '#channel' or '@user', but we save 'channel' or 'user' on the Rule
        if (
            payload_action["id"]
            == "sentry.integrations.slack.notify_action.SlackNotifyServiceAction"
        ):
            payload_action["channel"] = strip_channel_name(payload_action["channel"])
        assert any(
            payload_action.items() <= rule_action.items() for rule_action in rule.data["actions"]
        )
    payload_conditions = payload.get("conditions", []) + payload.get("filters", [])
    for payload_condition in payload_conditions:
        if payload_condition.get("name"):
            del payload_condition["name"]
        assert any(
            payload_condition.items() <= rule_condition.items()
            for rule_condition in rule.data["conditions"]
        )
    assert RuleActivity.objects.filter(rule=rule, type=RuleActivityType.UPDATED.value).exists()


class ProjectRuleDetailsBaseTestCase(APITestCase):
    endpoint = "sentry-api-0-project-rule-details"

    def setUp(self) -> None:
        self.rule = self.create_project_rule(project=self.project)
        self.environment = self.create_environment(self.project, name="production")
        self.slack_integration = install_slack(organization=self.organization)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.jira_integration = self.create_provider_integration(
                provider="jira", name="Jira", external_id="jira:1"
            )
            self.jira_integration.add_organization(self.organization, self.user)
            self.jira_server_integration = self.create_provider_integration(
                provider="jira_server", name="Jira Server", external_id="jira_server:1"
            )
            self.jira_server_integration.add_organization(self.organization, self.user)
        self.sentry_app = self.create_sentry_app(
            name="Pied Piper",
            organization=self.organization,
            schema={"elements": [self.create_alert_rule_action_schema()]},
        )
        self.sentry_app_installation = self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.organization
        )
        self.sentry_app_settings_payload = [
            {"name": "title", "value": "Team Rocket"},
            {"name": "summary", "value": "We're blasting off again."},
        ]
        self.login_as(self.user)
        self.notify_issue_owners_action = [
            {
                "targetType": "IssueOwners",
                "fallthroughType": "ActiveMembers",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": "",
            }
        ]
        self.first_seen_condition = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
            }
        ]


class ProjectRuleDetailsTest(ProjectRuleDetailsBaseTestCase):
    def test_simple(self) -> None:
        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200
        )
        assert response.data["id"] == str(self.rule.id)
        assert response.data["environment"] is None
        assert response.data["conditions"][0]["name"]

    def test_non_existing_rule(self) -> None:
        self.get_error_response(self.organization.slug, self.project.slug, 12345, status_code=404)

    def test_with_environment(self) -> None:
        self.rule.update(environment_id=self.environment.id)
        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200
        )
        assert response.data["id"] == str(self.rule.id)
        assert response.data["environment"] == self.environment.name
        assert response.data["status"] == "active"

    def test_with_filters(self) -> None:
        conditions: list[dict[str, Any]] = [
            {"id": "sentry.rules.conditions.every_event.EveryEventCondition"},
            {"id": "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter", "value": 10},
        ]
        actions: list[dict[str, Any]] = [
            {"id": "sentry.rules.actions.notify_event.NotifyEventAction"}
        ]
        data = {
            "conditions": conditions,
            "actions": actions,
            "filter_match": "all",
            "action_match": "all",
            "frequency": 30,
        }
        self.rule.update(data=data)

        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200
        )
        assert response.data["id"] == str(self.rule.id)

        # ensure that conditions and filters are split up correctly
        assert len(response.data["conditions"]) == 1
        assert response.data["conditions"][0]["id"] == conditions[0]["id"]
        assert len(response.data["filters"]) == 1
        assert response.data["filters"][0]["id"] == conditions[1]["id"]

    def test_with_assigned_to_team_filter(self) -> None:
        conditions: list[dict[str, Any]] = [
            {"id": "sentry.rules.conditions.every_event.EveryEventCondition"},
            {
                "targetType": "Team",
                "id": "sentry.rules.filters.assigned_to.AssignedToFilter",
                "targetIdentifier": self.team.id,
            },
        ]
        actions: list[dict[str, Any]] = [
            {"id": "sentry.rules.actions.notify_event.NotifyEventAction"}
        ]
        data = {
            "conditions": conditions,
            "actions": actions,
            "filter_match": "all",
            "action_match": "all",
            "frequency": 30,
        }
        self.rule.update(data=data)

        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200
        )
        assert response.data["id"] == str(self.rule.id)
        assert (
            response.data["filters"][0]["name"]
            == f"The issue is assigned to team #{self.team.slug}"
        )

    def test_with_assigned_to_user_filter(self) -> None:
        conditions: list[dict[str, Any]] = [
            {"id": "sentry.rules.conditions.every_event.EveryEventCondition"},
            {
                "targetType": "Member",
                "id": "sentry.rules.filters.assigned_to.AssignedToFilter",
                "targetIdentifier": self.user.id,
            },
        ]
        actions: list[dict[str, Any]] = [
            {"id": "sentry.rules.actions.notify_event.NotifyEventAction"}
        ]
        data = {
            "conditions": conditions,
            "actions": actions,
            "filter_match": "all",
            "action_match": "all",
            "frequency": 30,
        }
        self.rule.update(data=data)

        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200
        )
        assert response.data["id"] == str(self.rule.id)
        assert (
            response.data["filters"][0]["name"] == f"The issue is assigned to {self.user.username}"
        )

    @responses.activate
    def test_neglected_rule(self) -> None:
        now = datetime.now(UTC)
        NeglectedRule.objects.create(
            rule=self.rule,
            organization=self.organization,
            opted_out=False,
            sent_initial_email_date=now,
            disable_date=now + timedelta(days=14),
        )
        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200
        )
        assert response.data["disableReason"] == "noisy"
        assert response.data["disableDate"] == now + timedelta(days=14)

        another_rule = self.create_project_rule(project=self.project)
        response = self.get_success_response(
            self.organization.slug, self.project.slug, another_rule.id, status_code=200
        )
        assert not response.data.get("disableReason")
        assert not response.data.get("disableDate")

    @responses.activate
    def test_with_snooze_rule(self) -> None:
        self.snooze_rule(user_id=self.user.id, owner_id=self.user.id, rule=self.rule)

        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200
        )

        assert response.data["snooze"]
        assert response.data["snoozeCreatedBy"] == "You"
        assert not response.data["snoozeForEveryone"]

    @responses.activate
    def test_with_snooze_rule_everyone(self) -> None:
        user2 = self.create_user("user2@example.com")
        self.snooze_rule(owner_id=user2.id, rule=self.rule)

        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200
        )

        assert response.data["snooze"]
        assert response.data["snoozeCreatedBy"] == user2.get_display_name()
        assert response.data["snoozeForEveryone"]

    @responses.activate
    def test_with_sentryapp_action(self) -> None:
        conditions = [
            {"id": "sentry.rules.conditions.every_event.EveryEventCondition"},
            {"id": "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter", "value": 10},
        ]
        actions = [
            {
                "id": "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
                "sentryAppInstallationUuid": self.sentry_app_installation.uuid,
                "settings": [
                    {"name": "title", "value": "An alert"},
                    {"summary": "Something happened here..."},
                    {"name": "points", "value": "3"},
                    {"name": "assignee", "value": "Nisanthan"},
                ],
            }
        ]
        data = {
            "conditions": conditions,
            "actions": actions,
            "filter_match": "all",
            "action_match": "all",
            "frequency": 30,
        }
        self.rule.update(data=data)
        responses.add(
            responses.GET,
            "https://example.com/sentry/members",
            json=[
                {"value": "bob", "label": "Bob"},
                {"value": "jess", "label": "Jess"},
            ],
            status=200,
        )

        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200
        )
        # Request to external service made
        assert len(responses.calls) == 1

        assert response.status_code == 200
        assert "errors" not in response.data
        assert "actions" in response.data

        # Check that the sentryapp action contains choices from the integration host
        action = response.data["actions"][0]
        assert (
            action["id"]
            == "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction"
        )
        assert action["formFields"]["optional_fields"][-1]
        assert "select" == action["formFields"]["optional_fields"][-1]["type"]
        assert "sentry/members" in action["formFields"]["optional_fields"][-1]["uri"]
        assert "bob" == action["formFields"]["optional_fields"][-1]["choices"][0][0]

    @responses.activate
    def test_with_unresponsive_sentryapp(self) -> None:
        conditions = [
            {"id": "sentry.rules.conditions.every_event.EveryEventCondition"},
            {"id": "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter", "value": 10},
        ]

        actions = [
            {
                "id": "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
                "sentryAppInstallationUuid": self.sentry_app_installation.uuid,
                "settings": [
                    {"name": "title", "value": "An alert"},
                    {"summary": "Something happened here..."},
                    {"name": "points", "value": "3"},
                    {"name": "assignee", "value": "Nisanthan"},
                ],
            }
        ]
        data = {
            "conditions": conditions,
            "actions": actions,
            "filter_match": "all",
            "action_match": "all",
            "frequency": 30,
        }
        self.rule.update(data=data)

        responses.add(responses.GET, "http://example.com/sentry/members", json={}, status=404)
        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200
        )
        assert len(responses.calls) == 1

        assert response.status_code == 200
        # Returns errors while fetching
        assert len(response.data["errors"]) == 1
        assert self.sentry_app.name in response.data["errors"][0]["detail"]

        # Disables the SentryApp
        assert (
            response.data["actions"][0]["sentryAppInstallationUuid"]
            == self.sentry_app_installation.uuid
        )
        assert response.data["actions"][0]["disabled"] is True

    @responses.activate
    def test_with_deleted_sentry_app(self) -> None:
        actions = [
            {
                "id": "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
                "sentryAppInstallationUuid": "123-uuid-does-not-exist",
                "settings": [
                    {"name": "title", "value": "An alert"},
                    {"summary": "Something happened here..."},
                    {"name": "points", "value": "3"},
                    {"name": "assignee", "value": "Nisanthan"},
                ],
            }
        ]
        data = {
            "conditions": [],
            "actions": actions,
            "filter_match": "all",
            "action_match": "all",
            "frequency": 30,
        }
        self.rule.update(data=data)

        responses.add(responses.GET, "http://example.com/sentry/members", json={}, status=404)
        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200
        )
        # Action with deleted SentryApp is removed
        assert response.data["actions"] == []

    @freeze_time()
    def test_last_triggered(self) -> None:
        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, expand=["lastTriggered"]
        )
        assert response.data["lastTriggered"] is None
        RuleFireHistory.objects.create(project=self.project, rule=self.rule, group=self.group)
        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, expand=["lastTriggered"]
        )
        assert response.data["lastTriggered"] == datetime.now(UTC)

    @responses.activate
    def test_with_jira_action_error(self) -> None:
        conditions = [
            {"id": "sentry.rules.conditions.every_event.EveryEventCondition"},
            {"id": "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter", "value": 10},
        ]
        actions = [
            {
                "id": "sentry.integrations.jira.notify_action.JiraCreateTicketAction",
                "integration": self.jira_integration.id,
                "customfield_epic_link": "EPIC-3",
                "customfield_severity": "Medium",
                "dynamic_form_fields": [
                    {
                        "choices": [
                            ["EPIC-1", "Citizen Knope"],
                            ["EPIC-2", "The Comeback Kid"],
                            ["EPIC-3", {"key": None, "ref": None, "props": {}, "_owner": None}],
                        ],
                        "label": "Epic Link",
                        "name": "customfield_epic_link",
                        "required": False,
                        "type": "select",
                        "url": f"/extensions/jira/search/{self.organization.slug}/{self.jira_integration.id}/",
                    },
                    {
                        "choices": [
                            ["Very High", "Very High"],
                            ["High", "High"],
                            ["Medium", "Medium"],
                            ["Low", "Low"],
                        ],
                        "label": "Severity",
                        "name": "customfield_severity",
                        "required": True,
                        "type": "select",
                    },
                ],
            }
        ]
        data = {
            "conditions": conditions,
            "actions": actions,
            "filter_match": "all",
            "action_match": "all",
            "frequency": 30,
        }

        self.rule.update(data=data)

        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200
        )
        # Expect that the choices get filtered to match the API: Array<string, string>
        assert response.data["actions"][0].get("dynamic_form_fields")[0].get("choices") == [
            ["EPIC-1", "Citizen Knope"],
            ["EPIC-2", "The Comeback Kid"],
        ]

    @responses.activate
    def test_with_jira_server_action_error(self) -> None:
        conditions = [
            {"id": "sentry.rules.conditions.every_event.EveryEventCondition"},
            {"id": "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter", "value": 10},
        ]
        actions = [
            {
                "id": "sentry.integrations.jira_server.notify_action.JiraServerCreateTicketAction",
                "integration": self.jira_server_integration.id,
                "customfield_epic_link": "EPIC-3",
                "customfield_severity": "Medium",
                "dynamic_form_fields": [
                    {
                        "choices": [
                            ["EPIC-1", "Citizen Knope"],
                            ["EPIC-2", "The Comeback Kid"],
                            ["EPIC-3", {"key": None, "ref": None, "props": {}, "_owner": None}],
                        ],
                        "label": "Epic Link",
                        "name": "customfield_epic_link",
                        "required": False,
                        "type": "select",
                        "url": f"/extensions/jira/search/{self.organization.slug}/{self.jira_server_integration.id}/",
                    },
                    {
                        "choices": [
                            ["Very High", "Very High"],
                            ["High", "High"],
                            ["Medium", "Medium"],
                            ["Low", "Low"],
                        ],
                        "label": "Severity",
                        "name": "customfield_severity",
                        "required": True,
                        "type": "select",
                    },
                ],
            }
        ]
        data = {
            "conditions": conditions,
            "actions": actions,
            "filter_match": "all",
            "action_match": "all",
            "frequency": 30,
        }

        self.rule.update(data=data)

        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200
        )
        # Expect that the choices get filtered to match the API: Array<string, string>
        assert response.data["actions"][0].get("dynamic_form_fields")[0].get("choices") == [
            ["EPIC-1", "Citizen Knope"],
            ["EPIC-2", "The Comeback Kid"],
        ]


class UpdateProjectRuleTest(ProjectRuleDetailsBaseTestCase):
    method = "PUT"

    def mock_conversations_list(self, channels):
        return patch(
            "slack_sdk.web.client.WebClient.conversations_list",
            return_value=SlackResponse(
                client=None,
                http_verb="POST",
                api_url="https://slack.com/api/conversations.list",
                req_args={},
                data={"ok": True, "channels": channels},
                headers={},
                status_code=200,
            ),
        )

    def mock_conversations_info(self, channel):
        return patch(
            "slack_sdk.web.client.WebClient.conversations_info",
            return_value=SlackResponse(
                client=None,
                http_verb="POST",
                api_url="https://slack.com/api/conversations.info",
                req_args={"channel": channel},
                data={"ok": True, "channel": channel},
                headers={},
                status_code=200,
            ),
        )

    @patch("sentry.signals.alert_rule_edited.send_robust")
    def test_simple(self, send_robust: MagicMock) -> None:
        conditions = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                "key": "foo",
                "match": "eq",
                "value": "bar",
            }
        ]
        payload = {
            "name": "hello world",
            "owner": self.user.id,
            "actionMatch": "any",
            "filterMatch": "any",
            "actions": [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}],
            "conditions": conditions,
        }
        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200, **payload
        )
        assert response.data["id"] == str(self.rule.id)
        assert_rule_from_payload(self.rule, payload)
        assert send_robust.called

    def test_no_owner(self) -> None:
        conditions = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                "key": "foo",
                "match": "eq",
                "value": "bar",
            }
        ]
        payload = {
            "name": "hello world",
            "owner": None,
            "actionMatch": "any",
            "filterMatch": "any",
            "actions": [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}],
            "conditions": conditions,
        }
        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200, **payload
        )
        assert response.data["id"] == str(self.rule.id)
        assert_rule_from_payload(self.rule, payload)

    def test_update_owner_type(self) -> None:
        team = self.create_team(organization=self.organization, members=[self.user])
        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]
        payload = {
            "name": "hello world 2",
            "owner": f"team:{team.id}",
            "actionMatch": "all",
            "actions": actions,
            "conditions": self.first_seen_condition,
        }
        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200, **payload
        )
        assert response.data["id"] == str(self.rule.id)
        assert response.data["owner"] == f"team:{team.id}"
        rule = Rule.objects.get(id=response.data["id"])
        assert rule.owner_team_id == team.id
        assert rule.owner_user_id is None

        payload = {
            "name": "hello world 2",
            "owner": f"user:{self.user.id}",
            "actionMatch": "all",
            "actions": actions,
            "conditions": self.first_seen_condition,
        }
        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200, **payload
        )
        assert response.data["id"] == str(self.rule.id)
        assert response.data["owner"] == f"user:{self.user.id}"
        rule = Rule.objects.get(id=response.data["id"])
        assert rule.owner_team_id is None
        assert rule.owner_user_id == self.user.id

    def test_team_owner_not_member(self) -> None:
        team = self.create_team(organization=self.organization)
        # Create a non-privileged member user (without team:admin scope)
        member_user = self.create_user()
        self.create_member(
            user=member_user,
            organization=self.organization,
            role="member",
            teams=[self.team],
        )
        self.login_as(member_user)
        payload = {
            "name": "hello world",
            "owner": f"team:{team.id}",
            "actionMatch": "any",
            "filterMatch": "any",
            "actions": [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}],
            "conditions": self.first_seen_condition,
        }
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            self.rule.id,
            status_code=status.HTTP_400_BAD_REQUEST,
            **payload,
        )
        assert "owner" in response.data
        assert (
            str(response.data["owner"][0])
            == "You must be a member of a team to assign it as the rule owner."
        )

    def test_team_owner_not_member_with_team_admin_scope(self) -> None:
        """Test that users with team:admin scope can assign a team they're not a member of as the owner"""
        team = self.create_team(organization=self.organization)
        # Create a manager user who has team:admin scope
        manager_user = self.create_user()
        self.create_member(
            user=manager_user,
            organization=self.organization,
            role="manager",
            teams=[self.team],
        )
        self.login_as(manager_user)
        payload = {
            "name": "hello world",
            "owner": f"team:{team.id}",
            "actionMatch": "any",
            "filterMatch": "any",
            "actions": [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}],
            "conditions": self.first_seen_condition,
        }
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            self.rule.id,
            status_code=status.HTTP_200_OK,
            **payload,
        )
        assert response.data["owner"] == f"team:{team.id}"
        rule = Rule.objects.get(id=response.data["id"])
        assert rule.owner_team_id == team.id
        assert rule.owner_user_id is None

    def test_update_name(self) -> None:
        conditions = [
            {
                "interval": "1h",
                "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
                "value": 666,
                "name": "The issue is seen more than 30 times in 1m",
            }
        ]
        actions = [
            {
                "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                "name": "Send a notification (for all legacy integrations)",
            }
        ]
        payload = {
            "name": "test",
            "environment": None,
            "actionMatch": "all",
            "filterMatch": "all",
            "frequency": 30,
            "conditions": conditions,
            "actions": actions,
        }

        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200, **payload
        )
        assert (
            response.data["conditions"][0]["name"] == "The issue is seen more than 666 times in 1h"
        )
        assert_rule_from_payload(self.rule, payload)

    def test_remove_conditions(self) -> None:
        """Test that you can edit an alert rule to have no conditions (aka fire on every event)"""
        rule = self.create_project_rule(
            project=self.project,
            action_data=self.notify_issue_owners_action,
            condition_data=self.first_seen_condition,
            name="no conditions",
        )
        payload = {
            "name": rule.label,
            "environment": None,
            "actionMatch": "all",
            "filterMatch": "all",
            "frequency": 30,
            "conditions": [],
            "actions": self.notify_issue_owners_action,
        }

        self.get_success_response(
            self.organization.slug, self.project.slug, rule.id, status_code=200, **payload
        )
        assert_rule_from_payload(rule, payload)

    def test_update_duplicate_rule(self) -> None:
        """Test that if you edit a rule such that it's now the exact duplicate of another rule in the same project
        we do not allow it"""
        conditions = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
            }
        ]
        rule = self.create_project_rule(
            project=self.project,
            action_data=self.notify_issue_owners_action,
            condition_data=conditions,
        )
        conditions.append(
            {
                "id": "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition",
                "interval": "1h",
                "value": "100.0",
                "comparisonType": "count",
            }
        )
        rule2 = self.create_project_rule(
            project=self.project,
            action_data=self.notify_issue_owners_action,
            condition_data=conditions,
        )
        conditions.pop(1)
        payload = {
            "name": "hello world",
            "actionMatch": "all",
            "actions": self.notify_issue_owners_action,
            "conditions": conditions,
        }
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            rule2.id,
            status_code=status.HTTP_400_BAD_REQUEST,
            **payload,
        )
        assert (
            resp.data["name"][0]
            == f"This rule is an exact duplicate of '{rule.label}' in this project and may not be created."
        )

    def test_duplicate_rule_environment(self) -> None:
        """Test that if one rule doesn't have an environment set (i.e. 'All Environments') and we compare it to a rule
        that does have one set, we consider this when determining if it's a duplicate"""
        self.create_project_rule(
            project=self.project,
            action_data=self.notify_issue_owners_action,
            condition_data=self.first_seen_condition,
        )
        env_rule = self.create_project_rule(
            project=self.project,
            action_data=self.notify_issue_owners_action,
            condition_data=self.first_seen_condition,
        )
        payload = {
            "name": "hello world",
            "actionMatch": "all",
            "actions": self.notify_issue_owners_action,
            "conditions": self.first_seen_condition,
        }
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            env_rule.id,
            status_code=status.HTTP_400_BAD_REQUEST,
            **payload,
        )
        assert (
            resp.data["name"][0]
            == f"This rule is an exact duplicate of '{env_rule.label}' in this project and may not be created."
        )

        # update env_rule to have an environment set - these should now be considered to be different
        payload["environment"] = self.environment.name
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            env_rule.id,
            status_code=status.HTTP_200_OK,
            **payload,
        )

    def test_duplicate_rule_both_have_environments(self) -> None:
        """Test that we do not allow editing a rule to be the exact same as another rule in the same project
        when they both have the same environment set, and then that we do allow it when they have different
        environments set (slightly different than if one if set and the other is not).
        """
        rule = self.create_project_rule(
            project=self.project,
            action_data=self.notify_issue_owners_action,
            condition_data=self.first_seen_condition,
            name="rule_with_env",
            environment_id=self.environment.id,
        )
        rule2 = self.create_project_rule(
            project=self.project,
            action_data=self.notify_issue_owners_action,
            condition_data=self.first_seen_condition,
            name="rule_wo_env",
        )
        payload = {
            "name": "hello world",
            "actionMatch": "all",
            "actions": self.notify_issue_owners_action,
            "conditions": self.first_seen_condition,
            "environment": self.environment.name,
        }
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            rule2.id,
            status_code=status.HTTP_400_BAD_REQUEST,
            **payload,
        )
        assert (
            resp.data["name"][0]
            == f"This rule is an exact duplicate of '{rule.label}' in this project and may not be created."
        )
        dev_env = self.create_environment(self.project, name="dev", organization=self.organization)
        payload["environment"] = dev_env.name

        self.get_success_response(
            self.organization.slug,
            self.project.slug,
            rule2.id,
            status_code=status.HTTP_200_OK,
            **payload,
        )

    def test_duplicate_rule_actions(self) -> None:
        """Test that if one rule doesn't have an action set (i.e. 'Do Nothing') and we compare it to a rule
        that does have one set, we consider this when determining if it's a duplicate"""

        # XXX(CEO): After we migrate old data so that no rules have no actions, this test won't be needed
        Rule.objects.create(
            project=self.project,
            data={"conditions": self.first_seen_condition, "action_match": "all"},
        )
        action_rule = Rule.objects.create(
            project=self.project,
            data={"conditions": self.first_seen_condition, "action_match": "all"},
        )

        payload = {
            "name": "hello world",
            "actionMatch": "all",
            "actions": self.notify_issue_owners_action,
            "conditions": self.first_seen_condition,
        }

        self.get_success_response(
            self.organization.slug,
            self.project.slug,
            action_rule.id,
            status_code=status.HTTP_200_OK,
            **payload,
        )

    def test_edit_rule(self) -> None:
        """Test that you can edit an alert rule w/o it comparing it to itself as a dupe"""
        conditions = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
            }
        ]
        self.create_project_rule(
            project=self.project,
            action_data=self.notify_issue_owners_action,
            condition_data=conditions,
        )
        conditions.append(
            {
                "id": "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition",
                "interval": "1h",
                "value": "100.0",
                "comparisonType": "count",
            }
        )
        payload = {
            "name": "hello world",
            "environment": self.environment.name,
            "actionMatch": "all",
            "actions": self.notify_issue_owners_action,
            "conditions": self.first_seen_condition,
        }
        self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200, **payload
        )

    @patch("sentry.analytics.record")
    def test_reenable_disabled_rule(self, record_analytics: MagicMock) -> None:
        """Test that when you edit and save a rule that was disabled, it's re-enabled as long as it passes the checks"""
        rule = Rule.objects.create(
            label="hello world",
            project=self.project,
            data={
                "conditions": self.first_seen_condition,
                "actions": [],
                "action_match": "all",
                "filter_match": "all",
            },
        )
        # disable the rule because it has no action(s)
        rule.status = ObjectStatus.DISABLED
        rule.save()

        payload = {
            "name": "hellooo world",
            "actionMatch": "all",
            "actions": self.notify_issue_owners_action,
            "conditions": self.first_seen_condition,
        }
        self.get_success_response(
            self.organization.slug, self.project.slug, rule.id, status_code=200, **payload
        )
        # re-fetch rule after update
        rule = Rule.objects.get(id=rule.id)
        assert rule.status == ObjectStatus.ACTIVE

        assert_any_analytics_event(
            record_analytics,
            RuleReenableEdit(
                rule_id=rule.id,
                user_id=self.user.id,
                organization_id=self.organization.id,
            ),
        )

    @patch("sentry.analytics.record")
    def test_rule_disable_opt_out_explicit(self, record_analytics: MagicMock) -> None:
        """Test that if a user explicitly opts out of their neglected rule being migrated
        to being disabled (by clicking a button on the front end), that we mark it as opted out.
        """
        rule = Rule.objects.create(
            label="hello world",
            project=self.project,
            data={
                "conditions": self.first_seen_condition,
                "actions": [],
                "action_match": "all",
                "filter_match": "all",
            },
        )
        now = datetime.now(UTC)
        NeglectedRule.objects.create(
            rule=rule,
            organization=self.organization,
            opted_out=False,
            disable_date=now + timedelta(days=14),
        )
        payload = {
            "name": "hellooo world",
            "actionMatch": "all",
            "actions": self.notify_issue_owners_action,
            "conditions": self.first_seen_condition,
            "optOutExplicit": True,
        }
        self.get_success_response(
            self.organization.slug, self.project.slug, rule.id, status_code=200, **payload
        )
        assert_any_analytics_event(
            record_analytics,
            RuleDisableOptOutExplicit(
                rule_id=rule.id,
                user_id=self.user.id,
                organization_id=self.organization.id,
            ),
        )
        neglected_rule = NeglectedRule.objects.get(rule=rule)
        assert neglected_rule.opted_out is True

    @patch("sentry.analytics.record")
    def test_rule_disable_opt_out_edit(self, record_analytics: MagicMock) -> None:
        """Test that if a user passively opts out of their neglected rule being migrated
        to being disabled (by editing the rule), that we mark it as opted out.
        """
        rule = Rule.objects.create(
            label="hello world",
            project=self.project,
            data={
                "conditions": self.first_seen_condition,
                "actions": [],
                "action_match": "all",
                "filter_match": "all",
            },
        )
        now = datetime.now(UTC)
        NeglectedRule.objects.create(
            rule=rule,
            organization=self.organization,
            opted_out=False,
            disable_date=now + timedelta(days=14),
        )
        payload = {
            "name": "hellooo world",
            "actionMatch": "all",
            "actions": self.notify_issue_owners_action,
            "conditions": self.first_seen_condition,
            "optOutEdit": True,
        }
        self.get_success_response(
            self.organization.slug, self.project.slug, rule.id, status_code=200, **payload
        )
        assert_any_analytics_event(
            record_analytics,
            RuleDisableOptOutEdit(
                rule_id=rule.id,
                user_id=self.user.id,
                organization_id=self.organization.id,
            ),
        )
        neglected_rule = NeglectedRule.objects.get(rule=rule)
        assert neglected_rule.opted_out is True

    def test_with_environment(self) -> None:
        payload = {
            "name": "hello world",
            "environment": self.environment.name,
            "actionMatch": "any",
            "filterMatch": "any",
            "actions": [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}],
            "conditions": [
                {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}
            ],
        }
        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200, **payload
        )
        assert response.data["id"] == str(self.rule.id)
        assert response.data["environment"] == self.environment.name
        assert_rule_from_payload(self.rule, payload)

    def test_with_null_environment(self) -> None:
        self.rule.update(environment_id=self.environment.id)

        payload = {
            "name": "hello world",
            "environment": None,
            "actionMatch": "any",
            "filterMatch": "any",
            "actions": [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}],
            "conditions": [
                {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}
            ],
        }

        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200, **payload
        )
        assert response.data["id"] == str(self.rule.id)
        assert response.data["environment"] is None
        assert_rule_from_payload(self.rule, payload)

    def test_update_channel_slack_workspace_fail_sdk(self) -> None:
        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
        actions = [
            {
                "channel_id": "old_channel_id",
                "workspace": str(self.slack_integration.id),
                "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                "channel": "#old_channel_name",
            }
        ]
        self.rule.update(data={"conditions": conditions, "actions": actions})

        channels = {
            "ok": "true",
            "channels": [
                {"name": "old_channel_name", "id": "old_channel_id"},
                {"name": "new_channel_name", "id": "new_channel_id"},
            ],
        }

        with self.mock_conversations_list(channels["channels"]):
            with self.mock_conversations_info(channels["channels"][0]):
                actions[0]["channel"] = "#new_channel_name"
                payload = {
                    "name": "#new_channel_name",
                    "actionMatch": "any",
                    "filterMatch": "any",
                    "actions": actions,
                    "conditions": conditions,
                    "frequency": 30,
                }
                self.get_error_response(
                    self.organization.slug,
                    self.project.slug,
                    self.rule.id,
                    status_code=400,
                    **payload,
                )

    def test_slack_channel_id_saved_sdk(self) -> None:
        channel_id = "CSVK0921"

        channel = {"name": "team-team-team", "id": channel_id}

        with self.mock_conversations_info(channel):
            payload = {
                "name": "hello world",
                "environment": None,
                "actionMatch": "any",
                "actions": [
                    {
                        "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                        "name": "Send a notification to the funinthesun Slack workspace to #team-team-team",
                        "workspace": str(self.slack_integration.id),
                        "channel": "#team-team-team",
                        "channel_id": channel_id,
                    }
                ],
                "conditions": [
                    {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}
                ],
            }
            response = self.get_success_response(
                self.organization.slug, self.project.slug, self.rule.id, status_code=200, **payload
            )
            assert response.data["id"] == str(self.rule.id)
            assert response.data["actions"][0]["channel_id"] == channel_id

    def test_invalid_rule_node_type(self) -> None:
        payload = {
            "name": "hello world",
            "actionMatch": "any",
            "filterMatch": "any",
            "conditions": [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}],
            "actions": [],
        }
        self.get_error_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=400, **payload
        )

    def test_invalid_rule_node(self) -> None:
        payload = {
            "name": "hello world",
            "actionMatch": "any",
            "filterMatch": "any",
            "conditions": [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}],
            "actions": [{"id": "foo"}],
        }
        self.get_error_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=400, **payload
        )

    def test_rule_form_not_valid(self) -> None:
        payload = {
            "name": "hello world",
            "actionMatch": "any",
            "filterMatch": "any",
            "conditions": [{"id": "sentry.rules.conditions.tagged_event.TaggedEventCondition"}],
            "actions": [],
        }
        self.get_error_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=400, **payload
        )

    def test_rule_form_owner_perms(self) -> None:
        new_user = self.create_user()
        payload = {
            "name": "hello world",
            "actionMatch": "any",
            "filterMatch": "any",
            "conditions": [{"id": "sentry.rules.conditions.tagged_event.TaggedEventCondition"}],
            "actions": [],
            "owner": f"user:{new_user.id}",
        }
        response = self.get_error_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=400, **payload
        )
        assert str(response.data["owner"][0]) == "User is not a member of this organization"

    def test_rule_form_missing_action(self) -> None:
        payload = {
            "name": "hello world",
            "actionMatch": "any",
            "filterMatch": "any",
            "action": [],
            "conditions": [{"id": "sentry.rules.conditions.tagged_event.TaggedEventCondition"}],
        }
        self.get_error_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=400, **payload
        )

    def test_update_filters(self) -> None:
        conditions = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                "name": "A new issue is created",
            }
        ]
        filters = [
            {"id": "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter", "value": 10}
        ]
        payload = {
            "name": "hello world",
            "actionMatch": "any",
            "filterMatch": "any",
            "actions": [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}],
            "conditions": conditions,
            "filters": filters,
        }
        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200, **payload
        )
        assert response.data["id"] == str(self.rule.id)

        assert_rule_from_payload(self.rule, payload)

    @responses.activate
    def test_update_sentry_app_action_success(self) -> None:
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=202,
        )
        actions = [
            {
                "id": "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
                "settings": self.sentry_app_settings_payload,
                "sentryAppInstallationUuid": self.sentry_app_installation.uuid,
                "hasSchemaFormConfig": True,
            },
        ]

        payload = {
            "name": "my super cool rule",
            "actionMatch": "any",
            "filterMatch": "any",
            "actions": actions,
            "conditions": [],
            "filters": [],
        }
        self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200, **payload
        )
        assert_rule_from_payload(self.rule, payload)
        assert len(responses.calls) == 1

    @responses.activate
    def test_update_sentry_app_action_failure(self) -> None:
        error_message = "Something is totally broken :'("
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=500,
            json={"message": error_message},
        )
        actions = [
            {
                "id": "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
                "settings": self.sentry_app_settings_payload,
                "sentryAppInstallationUuid": self.sentry_app_installation.uuid,
                "hasSchemaFormConfig": True,
            },
        ]
        payload = {
            "name": "my super cool rule",
            "actionMatch": "any",
            "filterMatch": "any",
            "actions": actions,
            "conditions": [],
            "filters": [],
        }
        response = self.get_error_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=500, **payload
        )
        assert len(responses.calls) == 1
        assert error_message in response.json().get("actions")[0]

    @patch("sentry.sentry_apps.services.app.app_service.trigger_sentry_app_action_creators")
    def test_update_sentry_app_action_failure_with_public_context(self, result: MagicMock) -> None:
        error_message = "Something is totally broken :'("
        result.return_value = RpcAlertRuleActionResult(
            success=False,
            message=error_message,
            error_type=SentryAppErrorType.CLIENT,
            public_context={"bruh": "bruhhhh"},
            status_code=409,
        )

        actions = [
            {
                "id": "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
                "settings": self.sentry_app_settings_payload,
                "sentryAppInstallationUuid": self.sentry_app_installation.uuid,
                "hasSchemaFormConfig": True,
            },
        ]
        payload = {
            "name": "my super cool rule",
            "actionMatch": "any",
            "filterMatch": "any",
            "actions": actions,
            "conditions": [],
            "filters": [],
        }
        response = self.get_error_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=409, **payload
        )
        assert error_message in response.json().get("actions")[0]
        assert response.json().get("context") == {"bruh": "bruhhhh"}

    @patch("sentry.sentry_apps.services.app.app_service.trigger_sentry_app_action_creators")
    def test_update_sentry_app_action_failure_sentry_error(self, result: MagicMock) -> None:
        error_message = "Something is totally broken :'("
        result.return_value = RpcAlertRuleActionResult(
            success=False,
            message=error_message,
            error_type=SentryAppErrorType.SENTRY,
            public_context={"bruh": "bro!"},
            webhook_context={"swig": "swoog"},
            status_code=510,
        )

        actions = [
            {
                "id": "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
                "settings": self.sentry_app_settings_payload,
                "sentryAppInstallationUuid": self.sentry_app_installation.uuid,
                "hasSchemaFormConfig": True,
            },
        ]
        payload = {
            "name": "my super cool rule",
            "actionMatch": "any",
            "filterMatch": "any",
            "actions": actions,
            "conditions": [],
            "filters": [],
        }
        response = self.get_error_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=510, **payload
        )
        assert error_message not in response.json().get("actions")[0]
        assert (
            response.json().get("actions")[0]
            == "Something went wrong during the custom integration process!"
        )
        assert response.json().get("context") == {"bruh": "bro!"}
        assert list(response.json().keys()) == ["context", "actions"]

    @patch("sentry.sentry_apps.services.app.app_service.trigger_sentry_app_action_creators")
    def test_update_sentry_app_action_failure_missing_error_type(self, result: MagicMock) -> None:
        error_message = "Something is totally broken :'("
        result.return_value = RpcAlertRuleActionResult(
            success=False,
            message=error_message,
            error_type=None,
            status_code=500,
        )

        actions = [
            {
                "id": "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
                "settings": self.sentry_app_settings_payload,
                "sentryAppInstallationUuid": self.sentry_app_installation.uuid,
                "hasSchemaFormConfig": True,
            },
        ]
        payload = {
            "name": "my super cool rule",
            "actionMatch": "any",
            "filterMatch": "any",
            "actions": actions,
            "conditions": [],
            "filters": [],
        }
        response = self.get_error_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=500, **payload
        )
        assert error_message not in response.json().get("actions")[0]
        assert (
            response.json().get("actions")[0]
            == "Something went wrong during the custom integration process!"
        )
        assert list(response.json().keys()) == ["actions"]

    def test_edit_condition_metric(self) -> None:
        payload = {
            "name": "name",
            "owner": self.user.id,
            "actionMatch": "any",
            "filterMatch": "any",
            "actions": [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}],
            "conditions": self.first_seen_condition,
        }
        self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200, **payload
        )

    def test_edit_non_condition_metric(self) -> None:
        payload = {
            "name": "new name",
            "owner": self.user.id,
            "actionMatch": "all",
            "filterMatch": "all",
            "actions": [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}],
            "conditions": self.rule.data["conditions"],
        }
        self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200, **payload
        )


class DeleteProjectRuleTest(ProjectRuleDetailsBaseTestCase):
    method = "DELETE"

    def test_simple(self) -> None:
        rule = self.create_project_rule(self.project)
        self.get_success_response(
            self.organization.slug, rule.project.slug, rule.id, status_code=202
        )
        rule.refresh_from_db()
        assert not Rule.objects.filter(
            id=self.rule.id, project=self.project, status=ObjectStatus.PENDING_DELETION
        ).exists()

    def test_dual_delete_workflow_engine(self) -> None:
        rule = self.create_project_rule(
            self.project,
            condition_data=[
                {
                    "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                    "name": "A new issue is created",
                },
                {
                    "id": "sentry.rules.filters.latest_release.LatestReleaseFilter",
                    "name": "The event occurs",
                },
            ],
        )

        alert_rule_workflow = AlertRuleWorkflow.objects.get(rule_id=rule.id)
        workflow = alert_rule_workflow.workflow
        when_dcg = workflow.when_condition_group
        assert when_dcg
        if_dcg = WorkflowDataConditionGroup.objects.get(workflow=workflow).condition_group

        self.get_success_response(
            self.organization.slug, rule.project.slug, rule.id, status_code=202
        )

        with self.tasks():
            run_scheduled_deletions()

        assert not AlertRuleWorkflow.objects.filter(rule_id=rule.id).exists()
        assert not Workflow.objects.filter(id=workflow.id).exists()
        assert not DataConditionGroup.objects.filter(id=when_dcg.id).exists()
        assert not DataConditionGroup.objects.filter(id=if_dcg.id).exists()
        assert not DataCondition.objects.filter(condition_group=when_dcg).exists()
        assert not DataCondition.objects.filter(condition_group=if_dcg).exists()
