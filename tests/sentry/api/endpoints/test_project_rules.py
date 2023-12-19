from __future__ import annotations

from copy import deepcopy
from typing import Any, Mapping, Sequence
from unittest.mock import patch

import responses
from django.test import override_settings
from rest_framework import status

from sentry.constants import ObjectStatus
from sentry.models.actor import get_actor_for_user, get_actor_id_for_user
from sentry.models.environment import Environment
from sentry.models.rule import Rule, RuleActivity, RuleActivityType
from sentry.models.user import User
from sentry.silo import SiloMode
from sentry.tasks.integrations.slack.find_channel_id_for_rule import find_channel_id_for_rule
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import install_slack, with_feature
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.utils import json


class ProjectRuleBaseTestCase(APITestCase):
    endpoint = "sentry-api-0-project-rules"

    def setUp(self):
        self.rule = self.create_project_rule(project=self.project)
        self.slack_integration = install_slack(organization=self.organization)
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
        self.login_as(user=self.user)
        self.first_seen_condition = [
            {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}
        ]
        self.notify_event_action = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]
        self.notify_issue_owners_action = [
            {
                "targetType": "IssueOwners",
                "fallthroughType": "ActiveMembers",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": "",
                "name": "Send a notification to IssueOwners and if none can be found then send a notification to ActiveMembers",
            }
        ]


@region_silo_test
class ProjectRuleListTest(ProjectRuleBaseTestCase):
    def test_simple(self):
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            status_code=status.HTTP_200_OK,
        )
        assert len(response.data) == Rule.objects.filter(project=self.project).count()


@region_silo_test
class CreateProjectRuleTest(ProjectRuleBaseTestCase):
    method = "post"

    def clean_data(self, data):
        cleaned_data = []
        for datum in data:
            if datum.get("name"):
                del datum["name"]
            cleaned_data.append(datum)
        return cleaned_data

    def run_test(
        self,
        actions: Sequence[Mapping[str, Any]] | None = None,
        conditions: Sequence[Mapping[str, Any]] | None = None,
        filters: Sequence[Mapping[str, Any]] | None = None,
        expected_conditions: Sequence[Mapping[str, Any]] | None = None,
        name: str | None = "hello world",
        action_match: str | None = "any",
        filter_match: str | None = "any",
        frequency: int | None = 30,
        **kwargs: Any,
    ):
        owner = get_actor_for_user(self.user).get_actor_identifier()
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.user = User.objects.get(id=self.user.id)  # reload user after setting actor
        query_args = {}
        if "environment" in kwargs:
            query_args["environment"] = kwargs["environment"]
        if filters:
            query_args["filters"] = filters
        if filter_match:
            query_args["filterMatch"] = filter_match
        if conditions:
            query_args["conditions"] = conditions
        if actions:
            query_args["actions"] = actions
        response = self.get_success_response(
            self.project.organization.slug,
            self.project.slug,
            name=name,
            owner=owner,
            actionMatch=action_match,
            frequency=frequency,
            **query_args,
        )
        assert response.data["id"]
        assert response.data["owner"] == owner
        assert response.data["createdBy"] == {
            "id": self.user.id,
            "name": self.user.get_display_name(),
            "email": self.user.email,
        }

        rule = Rule.objects.get(id=response.data["id"])
        assert rule.label == name
        assert rule.owner == get_actor_for_user(self.user)
        assert rule.data["action_match"] == action_match
        assert rule.data["filter_match"] == filter_match

        updated_actions = self.clean_data(actions)
        assert rule.data["actions"] == updated_actions

        if conditions:
            updated_conditions = self.clean_data(conditions)

        assert rule.data["conditions"] == (
            expected_conditions if expected_conditions is not None else updated_conditions
        )
        assert rule.data["frequency"] == frequency
        assert rule.created_by_id == self.user.id
        if "environment" in kwargs:
            environment = kwargs["environment"]
            assert response.data["environment"] == environment
            if environment is None:
                assert rule.environment_id is None
            else:
                assert (
                    rule.environment_id
                    == Environment.objects.get(name=environment, projects=self.project).id
                )

        assert RuleActivity.objects.filter(rule=rule, type=RuleActivityType.CREATED.value).exists()
        return response

    def test_simple(self):
        self.run_test(actions=self.notify_issue_owners_action, conditions=self.first_seen_condition)

    def test_with_name(self):
        conditions = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                "name": "A new issue is created",
            }
        ]
        actions = [
            {
                "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                "name": "Send a notification to IssueOwners and if none can be found then send a notification to ActiveMembers",
            }
        ]

        self.run_test(actions=actions, conditions=conditions)

    def test_duplicate_rule(self):
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="hellboy",
            frequency=1440,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="all",
            actions=self.notify_issue_owners_action,
            conditions=self.first_seen_condition,
        )
        rule = Rule.objects.get(id=response.data["id"])

        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            frequency=rule.data["frequency"],
            owner=self.user.get_actor_identifier(),
            actionMatch=rule.data["action_match"],
            filterMatch=rule.data["filter_match"],
            actions=rule.data["actions"],
            conditions=self.first_seen_condition,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert (
            resp.data["name"][0]
            == f"This rule is an exact duplicate of '{rule.label}' in this project and may not be created."
        )

    def test_duplicate_rule_environment(self):
        """Test the duplicate check for various forms of environments being set (and not set)"""
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="no_env_rule",
            frequency=1440,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="all",
            actions=self.notify_issue_owners_action,
            conditions=self.first_seen_condition,
        )
        no_env_rule = Rule.objects.get(id=response.data.get("id"))

        # first make sure we detect a duplicate rule if they're the same and don't have envs set
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="also_no_env_rule",
            frequency=1440,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="all",
            actions=self.notify_issue_owners_action,
            conditions=self.first_seen_condition,
            status_code=status.HTTP_400_BAD_REQUEST,
        )

        assert (
            response.data["name"][0]
            == f"This rule is an exact duplicate of '{no_env_rule.label}' in this project and may not be created."
        )

        # next test that we can create a rule that's a duplicate of the first rule but with an environment set
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="env_rule",
            frequency=1440,
            environment=self.environment.name,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="all",
            actions=self.notify_issue_owners_action,
            conditions=self.first_seen_condition,
        )
        env_rule = Rule.objects.get(id=response.data.get("id"))

        # now test that we CAN'T create a duplicate rule with the same env as the last rule
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="same_env_rule",
            frequency=1440,
            environment=self.environment.name,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="all",
            actions=self.notify_issue_owners_action,
            conditions=self.first_seen_condition,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert (
            response.data["name"][0]
            == f"This rule is an exact duplicate of '{env_rule.label}' in this project and may not be created."
        )

        # finally, test that we can create a rule that's duplicate except it has a different environment
        dev_env = self.create_environment(self.project, name="dev", organization=self.organization)
        self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="diff_env_rule",
            frequency=1440,
            environment=dev_env.name,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="all",
            actions=self.notify_issue_owners_action,
            conditions=self.first_seen_condition,
        )

    def test_pre_save(self):
        """Test that a rule with name data in the conditions and actions is saved without it"""
        actions = [
            {
                "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                "name": "Send a notification to IssueOwners and if none can be found then send a notification to ActiveMembers",
            }
        ]
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="hello world",
            owner=f"user:{self.user.id}",
            environment=None,
            actionMatch="any",
            frequency=5,
            actions=actions,
            conditions=self.first_seen_condition,
            status_code=status.HTTP_200_OK,
        )
        rule = Rule.objects.get(id=response.data.get("id"))
        assert rule.data["actions"][0] == {
            "id": "sentry.rules.actions.notify_event.NotifyEventAction"
        }
        assert rule.data["conditions"][0] == {
            "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"
        }

    def test_with_environment(self):
        Environment.get_or_create(self.project, "production")
        self.run_test(
            actions=self.notify_event_action,
            conditions=self.first_seen_condition,
            environment="production",
        )

    def test_with_null_environment(self):
        self.run_test(
            actions=self.notify_event_action, conditions=self.first_seen_condition, environment=None
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
        actions = [
            {
                "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                "name": "Send a notification to the funinthesun Slack workspace to #team-team-team and show tags [] in notification",
                "workspace": str(self.slack_integration.id),
                "channel": "#team-team-team",
                "input_channel_id": channel_id,
            }
        ]
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="hello world",
            owner=f"user:{self.user.id}",
            environment=None,
            actionMatch="any",
            frequency=5,
            actions=actions,
            conditions=self.first_seen_condition,
            status_code=status.HTTP_200_OK,
        )
        assert response.data["actions"][0]["channel_id"] == channel_id

    def test_missing_name(self):
        self.get_error_response(
            self.organization.slug,
            self.project.slug,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="any",
            actions=self.notify_event_action,
            conditions=self.first_seen_condition,
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    @override_settings(MAX_FAST_CONDITION_ISSUE_ALERTS=1)
    def test_exceed_limit_fast_conditions(self):
        Rule.objects.filter(project=self.project).delete()
        self.run_test(conditions=self.first_seen_condition, actions=self.notify_event_action)
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            frequency=30,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="any",
            actions=self.notify_event_action,
            conditions=self.first_seen_condition,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert (
            resp.data["conditions"][0]
            == "You may not exceed 1 rules with this type of condition per project."
        )
        # Make sure pending deletions don't affect the process
        Rule.objects.filter(project=self.project).update(status=ObjectStatus.PENDING_DELETION)
        self.run_test(conditions=self.first_seen_condition, actions=self.notify_event_action)

    @override_settings(MAX_SLOW_CONDITION_ISSUE_ALERTS=1)
    @override_settings(MAX_MORE_SLOW_CONDITION_ISSUE_ALERTS=2)
    def test_exceed_limit_slow_conditions(self):
        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]
        conditions = [
            {
                "id": "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition",
                "interval": "1h",
                "value": 100,
                "comparisonType": "count",
            }
        ]
        Rule.objects.filter(project=self.project).delete()
        self.run_test(conditions=conditions, actions=actions)
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            frequency=30,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="any",
            actions=actions,
            conditions=conditions,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert (
            resp.data["conditions"][0]
            == "You may not exceed 1 rules with this type of condition per project."
        )
        # Make sure pending deletions don't affect the process
        Rule.objects.filter(project=self.project).update(status=ObjectStatus.PENDING_DELETION)
        self.run_test(conditions=conditions, actions=actions)
        actions.append(
            {
                "targetType": "Team",
                "fallthroughType": "ActiveMembers",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": self.team.id,
            }
        )
        with self.feature("organizations:more-slow-alerts"):
            self.run_test(conditions=conditions, actions=actions)

    def test_owner_perms(self):
        other_user = self.create_user()
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            owner=other_user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="any",
            actions=[],
            conditions=[],
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert str(response.data["owner"][0]) == "User is not a member of this organization"
        other_team = self.create_team(self.create_organization())
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            owner=other_team.actor.get_actor_identifier(),
            actionMatch="any",
            filterMatch="any",
            actions=[],
            conditions=[],
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert str(response.data["owner"][0]) == "Team is not a member of this organization"

    def test_frequency_percent_validation(self):
        condition = {
            "id": "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition",
            "interval": "1h",
            "value": 101,
            "comparisonType": "count",
        }
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            frequency=30,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="any",
            conditions=[condition],
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert (
            str(response.data["conditions"][0]) == "Ensure this value is less than or equal to 100"
        )

        # Upper bound shouldn't be enforced when we're doing a comparison alert
        condition["comparisonType"] = "percent"
        condition["comparisonInterval"] = "1d"
        self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            frequency=30,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="any",
            actions=self.notify_event_action,
            conditions=[condition],
            status_code=status.HTTP_200_OK,
        )

    def test_match_values(self):
        filters = [
            {
                "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                "key": "foo",
                "match": "is",
            }
        ]
        expected_filters = deepcopy(filters)
        expected_filters[0]["value"] = ""
        self.run_test(
            actions=self.notify_event_action, filters=filters, expected_conditions=expected_filters
        )

        # should fail if using another match type
        filters = [
            {
                "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                "key": "foo",
                "match": "eq",
            }
        ]
        self.get_error_response(
            self.organization.slug,
            self.project.slug,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="any",
            actions=self.notify_event_action,
            filters=filters,
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    def test_with_filters(self):
        conditions: list[dict[str, Any]] = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                "name": "A new issue is created",
            }
        ]
        filters: list[dict[str, Any]] = [
            {"id": "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter", "value": 10}
        ]
        actions: list[dict[str, Any]] = [
            {"id": "sentry.rules.actions.notify_event.NotifyEventAction"}
        ]
        self.run_test(
            actions=actions,
            conditions=conditions,
            filters=filters,
            expected_conditions=conditions + filters,
        )

    def test_with_no_filter_match(self):
        conditions: list[dict[str, Any]] = [
            {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}
        ]
        actions: list[dict[str, Any]] = [
            {"id": "sentry.rules.actions.notify_event.NotifyEventAction"}
        ]

        self.run_test(
            filter_match=None,
            actions=actions,
            conditions=conditions,
        )

    def test_with_filters_without_match(self):
        conditions: list[dict[str, Any]] = [
            {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}
        ]
        filters: list[dict[str, Any]] = [
            {"id": "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter", "value": 10}
        ]
        actions: list[dict[str, Any]] = [
            {"id": "sentry.rules.actions.notify_event.NotifyEventAction"}
        ]

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="hello world",
            owner=self.user.get_actor_identifier(),
            conditions=conditions,
            filters=filters,
            actions=actions,
            actionMatch="any",
            frequency=30,
            status_code=status.HTTP_400_BAD_REQUEST,
        )

        assert response.data == {
            "filterMatch": ["Must select a filter match (all, any, none) if filters are supplied."]
        }

    def test_no_actions(self):
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            frequency=30,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="any",
            actions=[],
            conditions=self.first_seen_condition,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert resp.data["actions"][0] == "You must add an action for this alert to fire."

    @patch(
        "sentry.integrations.slack.actions.notification.get_channel_id",
        return_value=("#", None, True),
    )
    @patch.object(find_channel_id_for_rule, "apply_async")
    @patch("sentry.integrations.slack.utils.rule_status.uuid4")
    def test_kicks_off_slack_async_job(
        self,
        mock_uuid4,
        mock_find_channel_id_for_alert_rule,
        mock_get_channel_id,
    ):
        mock_uuid4.return_value = self.get_mock_uuid()
        actions = [
            {
                "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                "name": (
                    "Send a notification to the funinthesun Slack workspace to"
                    " #team-team-team and show tags [] in notification"
                ),
                "workspace": str(self.slack_integration.id),
                "channel": "#team-team-team",
                "channel_id": "",
                "tags": "",
            }
        ]
        payload: dict[str, Any] = {
            "name": "hello world",
            "owner": f"user:{self.user.id}",
            "environment": None,
            "actionMatch": "any",
            "frequency": 5,
            "actions": actions,
            "conditions": self.first_seen_condition,
        }

        self.get_success_response(
            self.organization.slug,
            self.project.slug,
            **payload,
            status_code=status.HTTP_202_ACCEPTED,
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.user = User.objects.get(id=self.user.id)  # reload user to get actor
        assert not Rule.objects.filter(label=payload["name"]).exists()
        payload["actions"][0].pop("name")
        kwargs = {
            "name": payload["name"],
            "owner": get_actor_id_for_user(self.user),
            "environment": payload.get("environment"),
            "action_match": payload["actionMatch"],
            "filter_match": payload.get("filterMatch"),
            "conditions": payload.get("conditions", []) + payload.get("filters", []),
            "actions": payload.get("actions", []),
            "frequency": payload.get("frequency"),
            "user_id": self.user.id,
            "uuid": "abc123",
        }
        call_args = mock_find_channel_id_for_alert_rule.call_args[1]["kwargs"]
        assert call_args.pop("project").id == self.project.id
        assert call_args == kwargs

    def test_comparison_condition(self):
        condition = {
            "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
            "interval": "1h",
            "value": 50,
        }
        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]
        self.run_test(
            actions=actions,
            conditions=[condition],
            expected_conditions=[
                {
                    "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
                    "interval": "1h",
                    "value": 50,
                    "comparisonType": "count",
                }
            ],
        )

        condition["comparisonType"] = "count"
        actions.append(
            {
                "targetType": "Team",
                "fallthroughType": "ActiveMembers",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": self.team.id,
            }
        )
        self.run_test(actions=actions, conditions=[condition])

        condition["comparisonType"] = "percent"
        condition["comparisonInterval"] = "1d"
        actions.append(
            {
                "targetType": "Member",
                "fallthroughType": "ActiveMembers",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": self.user.id,
            }
        )
        self.run_test(actions=actions, conditions=[condition])

    def test_comparison_condition_validation(self):
        condition = {
            "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
            "interval": "1h",
            "value": 50,
            "comparisonType": "percent",
        }
        response = self.get_error_response(
            self.project.organization.slug,
            self.project.slug,
            name="hello world",
            actionMatch="any",
            filterMatch="any",
            actions=self.notify_event_action,
            conditions=[condition],
            frequency=30,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert (
            str(response.data["conditions"][0])
            == "comparisonInterval is required when comparing by percent"
        )

        condition["comparisonInterval"] = "bad data"
        response = self.get_error_response(
            self.project.organization.slug,
            self.project.slug,
            name="hello world",
            actionMatch="any",
            filterMatch="any",
            actions=self.notify_event_action,
            conditions=[condition],
            frequency=30,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert (
            str(response.data["conditions"][0])
            == "Select a valid choice. bad data is not one of the available choices."
        )

    @with_feature("organizations:latest-adopted-release-filter")
    def test_latest_adopted_release_filter_validation(self):
        filter = {
            "id": "sentry.rules.filters.latest_adopted_release_filter.LatestAdoptedReleaseFilter",
            "oldest_or_newest": "oldest",
            "older_or_newer": "newer",
            "environment": self.environment.name + "fake",
        }
        response = self.get_error_response(
            self.project.organization.slug,
            self.project.slug,
            name="hello world",
            actionMatch="any",
            filterMatch="any",
            actions=self.notify_event_action,
            filters=[filter],
            frequency=30,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert (
            str(response.data["filters"][0])
            == "environment does not exist or is not associated with this organization"
        )
        filter["environment"] = self.environment.name
        self.get_success_response(
            self.project.organization.slug,
            self.project.slug,
            name="hello world",
            actionMatch="any",
            filterMatch="any",
            actions=self.notify_event_action,
            filters=[filter],
            frequency=30,
        )

    @responses.activate
    def test_create_sentry_app_action_success(self):
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=status.HTTP_202_ACCEPTED,
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
            "owner": f"user:{self.user.id}",
            "conditions": [],
            "filters": [],
            "actions": actions,
            "filterMatch": "any",
            "actionMatch": "any",
            "frequency": 30,
        }

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            **payload,
            status_code=status.HTTP_200_OK,
        )
        new_rule_id = response.data["id"]
        assert new_rule_id is not None
        rule = Rule.objects.get(id=new_rule_id)
        assert rule.data["actions"] == actions
        assert len(responses.calls) == 1

    @responses.activate
    def test_create_sentry_app_action_failure(self):
        error_message = "Something is totally broken :'("
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
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
            "owner": f"user:{self.user.id}",
            "conditions": [],
            "filters": [],
            "actions": actions,
            "filterMatch": "any",
            "actionMatch": "any",
            "frequency": 30,
        }

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            **payload,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert len(responses.calls) == 1
        assert error_message in response.json().get("actions")[0]
