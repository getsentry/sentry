from datetime import datetime
from typing import Any, Mapping
from unittest import mock
from unittest.mock import call, patch

import pytest
import responses
from freezegun import freeze_time
from pytz import UTC

from sentry.integrations.slack.utils.channel import strip_channel_name
from sentry.models import (
    Environment,
    Integration,
    Rule,
    RuleActivity,
    RuleActivityType,
    RuleFireHistory,
    RuleSnooze,
    RuleStatus,
    User,
)
from sentry.models.actor import get_actor_for_user
from sentry.testutils import APITestCase
from sentry.testutils.helpers import install_slack
from sentry.testutils.silo import exempt_from_silo_limits, region_silo_test
from sentry.utils import json


def assert_rule_from_payload(rule: Rule, payload: Mapping[str, Any]) -> None:
    """
    Helper function to assert every field on a Rule was modified correctly from the incoming payload
    """
    rule.refresh_from_db()
    assert rule.label == payload.get("name")

    owner_id = payload.get("owner")
    if owner_id:
        with exempt_from_silo_limits():
            assert rule.owner == User.objects.get(id=owner_id).actor
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
        assert any(
            payload_condition.items() <= rule_condition.items()
            for rule_condition in rule.data["conditions"]
        )
    assert RuleActivity.objects.filter(rule=rule, type=RuleActivityType.UPDATED.value).exists()


@region_silo_test(stable=True)
class ProjectRuleDetailsBaseTestCase(APITestCase):
    endpoint = "sentry-api-0-project-rule-details"

    def setUp(self):
        self.rule = self.create_project_rule(project=self.project)
        self.environment = self.create_environment(self.project, name="production")
        self.slack_integration = install_slack(organization=self.organization)
        self.jira_integration = Integration.objects.create(
            provider="jira", name="Jira", external_id="jira:1"
        )
        self.jira_integration.add_organization(self.organization, self.user)
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


@region_silo_test(stable=True)
class ProjectRuleDetailsTest(ProjectRuleDetailsBaseTestCase):
    def test_simple(self):
        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200
        )
        assert response.data["id"] == str(self.rule.id)
        assert response.data["environment"] is None

    def test_non_existing_rule(self):
        self.get_error_response(self.organization.slug, self.project.slug, 12345, status_code=404)

    def test_with_environment(self):
        self.rule.update(environment_id=self.environment.id)
        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200
        )
        assert response.data["id"] == str(self.rule.id)
        assert response.data["environment"] == self.environment.name

    def test_with_filters(self):
        conditions = [
            {"id": "sentry.rules.conditions.every_event.EveryEventCondition"},
            {"id": "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter", "value": 10},
        ]
        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]
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

    def test_with_snooze_rule(self):
        RuleSnooze.objects.create(
            user_id=self.user.id,
            owner_id=self.user.id,
            rule=self.rule,
            until=None,
        )

        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200
        )

        assert response.data["snooze"]
        assert response.data["snoozeCreatedBy"] == "You"
        assert not response.data["snoozeForEveryone"]

    def test_with_snooze_rule_everyone(self):
        user2 = self.create_user("user2@example.com")

        RuleSnooze.objects.create(
            owner_id=user2.id,
            rule=self.rule,
            until=None,
        )

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
        assert response.data["lastTriggered"] == datetime.now().replace(tzinfo=UTC)

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


@region_silo_test(stable=True)
class UpdateProjectRuleTest(ProjectRuleDetailsBaseTestCase):
    @pytest.fixture(autouse=True)
    def _setup_metric_patch(self):
        with mock.patch("sentry.api.endpoints.project_rule_details.metrics") as self.metrics:
            yield

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
        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
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
        conditions = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
            }
        ]
        payload = {
            "name": "name",
            "owner": self.user.id,
            "actionMatch": "any",
            "filterMatch": "any",
            "actions": [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}],
            "conditions": conditions,
        }
        self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=200, **payload
        )
        assert (
            call("sentry.issue_alert.conditions.edited", sample_rate=1.0)
            in self.metrics.incr.call_args_list
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
        assert (
            call("sentry.issue_alert.conditions.edited", sample_rate=1.0)
            not in self.metrics.incr.call_args_list
        )


@region_silo_test(stable=True)
class DeleteProjectRuleTest(ProjectRuleDetailsBaseTestCase):
    method = "DELETE"

    def test_simple(self):
        self.get_success_response(
            self.organization.slug, self.project.slug, self.rule.id, status_code=202
        )
        self.rule.refresh_from_db()
        assert self.rule.status == RuleStatus.PENDING_DELETION
        assert RuleActivity.objects.filter(
            rule=self.rule, type=RuleActivityType.DELETED.value
        ).exists()
