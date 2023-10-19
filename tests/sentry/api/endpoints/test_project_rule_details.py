from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Mapping
from unittest.mock import patch

import responses
from rest_framework import status

from sentry.constants import ObjectStatus
from sentry.integrations.slack.utils.channel import strip_channel_name
from sentry.models.actor import Actor, get_actor_for_user
from sentry.models.environment import Environment
from sentry.models.integrations.integration import Integration
from sentry.models.rule import NeglectedRule, Rule, RuleActivity, RuleActivityType
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import install_slack
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.utils import json


def assert_rule_from_payload(rule: Rule, payload: Mapping[str, Any]) -> None:
    """
    Helper function to assert every field on a Rule was modified correctly from the incoming payload
    """
    rule.refresh_from_db()
    assert rule.label == payload.get("name")

    owner_id = payload.get("owner")
    if owner_id:
        with assume_test_silo_mode(SiloMode.REGION):
            assert Actor.objects.get(id=rule.owner_id)
    else:
        assert rule.owner is None

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

    def setUp(self):
        self.rule = self.create_project_rule(project=self.project)
        self.environment = self.create_environment(self.project, name="production")
        self.slack_integration = install_slack(organization=self.organization)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.jira_integration = Integration.objects.create(
                provider="jira", name="Jira", external_id="jira:1"
            )
            self.jira_integration.add_organization(self.organization, self.user)
            self.jira_server_integration = Integration.objects.create(
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


@region_silo_test(stable=True)
class ProjectRuleDetailsTest(ProjectRuleDetailsBaseTestCase):
    def test_simple(self):
        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200
        )
        assert response.data["id"] == str(self.rule.id)
        assert response.data["environment"] is None
        assert response.data["conditions"][0]["name"]

    def test_non_existing_rule(self):
        self.get_error_response(self.organization.slug, self.project.slug, 12345, status_code=404)

    def test_with_environment(self):
        self.rule.update(environment_id=self.environment.id)
        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200
        )
        assert response.data["id"] == str(self.rule.id)
        assert response.data["environment"] == self.environment.name
        assert response.data["status"] == "active"

    def test_with_filters(self):
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

    @responses.activate
    def test_neglected_rule(self):
        now = datetime.now().replace(tzinfo=timezone.utc)
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
    def test_with_snooze_rule(self):
        self.snooze_rule(user_id=self.user.id, owner_id=self.user.id, rule=self.rule)

        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200
        )

        assert response.data["snooze"]
        assert response.data["snoozeCreatedBy"] == "You"
        assert not response.data["snoozeForEveryone"]

    @responses.activate
    def test_with_snooze_rule_everyone(self):
        user2 = self.create_user("user2@example.com")
        self.snooze_rule(owner_id=user2.id, rule=self.rule)

        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200
        )

        assert response.data["snooze"]
        assert response.data["snoozeCreatedBy"] == user2.get_display_name()
        assert response.data["snoozeForEveryone"]

    @responses.activate
    def test_with_unresponsive_sentryapp(self):
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
    def test_with_deleted_sentry_app(self):
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
    def test_last_triggered(self):
        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, expand=["lastTriggered"]
        )
        assert response.data["lastTriggered"] is None
        RuleFireHistory.objects.create(project=self.project, rule=self.rule, group=self.group)
        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, expand=["lastTriggered"]
        )
        assert response.data["lastTriggered"] == datetime.now().replace(tzinfo=timezone.utc)

    @responses.activate
    def test_with_jira_action_error(self):
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
    def test_with_jira_server_action_error(self):
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


@region_silo_test(stable=True)
class UpdateProjectRuleTest(ProjectRuleDetailsBaseTestCase):
    method = "PUT"

    @patch("sentry.signals.alert_rule_edited.send_robust")
    def test_simple(self, send_robust):
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

    def test_no_owner(self):
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

    def test_update_name(self):
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

    def test_remove_conditions(self):
        """Test that you can edit an alert rule to have no conditions (aka fire on every event)"""
        rule = self.create_project_rule(
            project=self.project,
            action_match=self.notify_issue_owners_action,
            condition_match=self.first_seen_condition,
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

    def test_update_duplicate_rule(self):
        """Test that if you edit a rule such that it's now the exact duplicate of another rule in the same project
        we do not allow it"""
        conditions = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
            }
        ]
        rule = self.create_project_rule(
            project=self.project,
            action_match=self.notify_issue_owners_action,
            condition_match=conditions,
        )
        conditions.append(
            {
                "id": "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition",
                "interval": "1h",
                "value": "100",
                "comparisonType": "count",
            }
        )
        rule2 = self.create_project_rule(
            project=self.project,
            action_match=self.notify_issue_owners_action,
            condition_match=conditions,
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

    def test_duplicate_rule_environment(self):
        """Test that if one rule doesn't have an environment set (i.e. 'All Environments') and we compare it to a rule
        that does have one set, we consider this when determining if it's a duplicate"""
        self.create_project_rule(
            project=self.project,
            action_match=self.notify_issue_owners_action,
            condition_match=self.first_seen_condition,
        )
        env_rule = self.create_project_rule(
            project=self.project,
            action_match=self.notify_issue_owners_action,
            condition_match=self.first_seen_condition,
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

    def test_duplicate_rule_both_have_environments(self):
        """Test that we do not allow editing a rule to be the exact same as another rule in the same project
        when they both have the same environment set, and then that we do allow it when they have different
        environments set (slightly different than if one if set and the other is not).
        """
        rule = self.create_project_rule(
            project=self.project,
            action_match=self.notify_issue_owners_action,
            condition_match=self.first_seen_condition,
            name="rule_with_env",
            environment_id=self.environment.id,
        )
        rule2 = self.create_project_rule(
            project=self.project,
            action_match=self.notify_issue_owners_action,
            condition_match=self.first_seen_condition,
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

    def test_duplicate_rule_actions(self):
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

    def test_edit_rule(self):
        """Test that you can edit an alert rule w/o it comparing it to itself as a dupe"""
        conditions = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
            }
        ]
        self.create_project_rule(
            project=self.project,
            action_match=self.notify_issue_owners_action,
            condition_match=conditions,
        )
        conditions.append(
            {
                "id": "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition",
                "interval": "1h",
                "value": "100",
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
    def test_reenable_disabled_rule(self, record_analytics):
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

        assert self.analytics_called_with_args(
            record_analytics,
            "rule_reenable.edit",
            rule_id=rule.id,
            user_id=self.user.id,
            organization_id=self.organization.id,
        )

    @patch("sentry.analytics.record")
    def test_rule_disable_opt_out_explicit(self, record_analytics):
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
        now = datetime.now().replace(tzinfo=timezone.utc)
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
        assert self.analytics_called_with_args(
            record_analytics,
            "rule_disable_opt_out.explicit",
            rule_id=rule.id,
            user_id=self.user.id,
            organization_id=self.organization.id,
        )
        neglected_rule = NeglectedRule.objects.get(rule=rule)
        assert neglected_rule.opted_out is True

    @patch("sentry.analytics.record")
    def test_rule_disable_opt_out_edit(self, record_analytics):
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
        now = datetime.now().replace(tzinfo=timezone.utc)
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
        assert self.analytics_called_with_args(
            record_analytics,
            "rule_disable_opt_out.edit",
            rule_id=rule.id,
            user_id=self.user.id,
            organization_id=self.organization.id,
        )
        neglected_rule = NeglectedRule.objects.get(rule=rule)
        assert neglected_rule.opted_out is True

    def test_with_environment(self):
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

    def test_with_null_environment(self):
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

    @responses.activate
    def test_update_channel_slack(self):
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

        actions[0]["channel"] = "#new_channel_name"
        actions[0]["channel_id"] = "new_channel_id"
        channels = {
            "ok": "true",
            "channels": [
                {"name": "old_channel_name", "id": "old_channel_id"},
                {"name": "new_channel_name", "id": "new_channel_id"},
            ],
        }

        responses.add(
            method=responses.GET,
            url="https://slack.com/api/conversations.list",
            status=200,
            content_type="application/json",
            body=json.dumps(channels),
        )
        responses.add(
            method=responses.GET,
            url="https://slack.com/api/conversations.info",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": channels["ok"], "channel": channels["channels"][1]}),
        )

        payload = {
            "name": "#new_channel_name",
            "actionMatch": "any",
            "filterMatch": "any",
            "actions": actions,
            "conditions": conditions,
            "frequency": 30,
        }
        self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200, **payload
        )
        assert_rule_from_payload(self.rule, payload)

    @responses.activate
    def test_update_channel_slack_workspace_fail(self):
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
        responses.add(
            method=responses.GET,
            url="https://slack.com/api/conversations.list",
            status=200,
            content_type="application/json",
            body=json.dumps(channels),
        )
        responses.add(
            method=responses.GET,
            url="https://slack.com/api/conversations.info",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": channels["ok"], "channel": channels["channels"][0]}),
        )

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
            self.organization.slug, self.project.slug, self.rule.id, status_code=400, **payload
        )

    @responses.activate
    def test_slack_channel_id_saved(self):
        channel_id = "CSVK0921"
        responses.add(
            method=responses.GET,
            url="https://slack.com/api/conversations.info",
            status=200,
            content_type="application/json",
            body=json.dumps(
                {"ok": "true", "channel": {"name": "team-team-team", "id": channel_id}}
            ),
        )
        payload = {
            "name": "hello world",
            "environment": None,
            "actionMatch": "any",
            "actions": [
                {
                    "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                    "name": "Send a notification to the funinthesun Slack workspace to #team-team-team and show tags [] in notification",
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

    def test_invalid_rule_node_type(self):
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

    def test_invalid_rule_node(self):
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

    def test_rule_form_not_valid(self):
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

    def test_rule_form_owner_perms(self):
        new_user = self.create_user()
        payload = {
            "name": "hello world",
            "actionMatch": "any",
            "filterMatch": "any",
            "conditions": [{"id": "sentry.rules.conditions.tagged_event.TaggedEventCondition"}],
            "actions": [],
            "owner": get_actor_for_user(new_user).get_actor_identifier(),
        }
        response = self.get_error_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=400, **payload
        )
        assert str(response.data["owner"][0]) == "User is not a member of this organization"

    def test_rule_form_missing_action(self):
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

    def test_update_filters(self):
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
    def test_update_sentry_app_action_success(self):
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
    def test_update_sentry_app_action_failure(self):
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
            self.organization.slug, self.project.slug, self.rule.id, status_code=400, **payload
        )
        assert len(responses.calls) == 1
        assert error_message in response.json().get("actions")[0]

    def test_edit_condition_metric(self):
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

    def test_edit_non_condition_metric(self):
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


@region_silo_test(stable=True)
class DeleteProjectRuleTest(ProjectRuleDetailsBaseTestCase):
    method = "DELETE"

    def test_simple(self):
        rule = self.create_project_rule(self.project)
        self.get_success_response(
            self.organization.slug, rule.project.slug, rule.id, status_code=202
        )
        rule.refresh_from_db()
        assert not Rule.objects.filter(
            id=self.rule.id, project=self.project, status=ObjectStatus.PENDING_DELETION
        ).exists()
