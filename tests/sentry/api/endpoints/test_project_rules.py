from __future__ import annotations

from copy import deepcopy
from typing import Any, Mapping, Sequence
from unittest.mock import patch

import responses
from django.test import override_settings
from rest_framework import status

from sentry.models import Environment, Rule, RuleActivity, RuleActivityType, RuleStatus
from sentry.testutils import APITestCase
from sentry.testutils.helpers import install_slack
from sentry.testutils.silo import region_silo_test
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
        owner = self.user.actor.get_actor_identifier()
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
        assert rule.owner == self.user.actor
        assert rule.data["action_match"] == action_match
        assert rule.data["filter_match"] == filter_match
        assert rule.data["actions"] == actions
        assert rule.data["conditions"] == (
            expected_conditions if expected_conditions is not None else conditions
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
        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]

        self.run_test(actions=actions, conditions=conditions)

    def test_with_environment(self):
        Environment.get_or_create(self.project, "production")
        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]

        self.run_test(actions=actions, conditions=conditions, environment="production")

    def test_with_null_environment(self):
        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]

        self.run_test(actions=actions, conditions=conditions, environment=None)

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
        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="hello world",
            owner=f"user:{self.user.id}",
            environment=None,
            actionMatch="any",
            frequency=5,
            actions=actions,
            conditions=conditions,
            status_code=status.HTTP_200_OK,
        )
        assert response.data["actions"][0]["channel_id"] == channel_id

    def test_missing_name(self):
        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]
        self.get_error_response(
            self.organization.slug,
            self.project.slug,
            owner=self.user.actor.get_actor_identifier(),
            actionMatch="any",
            filterMatch="any",
            actions=actions,
            conditions=conditions,
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    @override_settings(MAX_ISSUE_ALERTS_PER_PROJECT=1)
    def test_exceed_limit(self):
        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]
        Rule.objects.filter(project=self.project).delete()
        self.run_test(conditions=conditions, actions=actions)
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            frequency=30,
            owner=self.user.actor.get_actor_identifier(),
            actionMatch="any",
            filterMatch="any",
            actions=actions,
            conditions=conditions,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert resp.data == "You may not exceed 1 rules per project"
        # Make sure pending deletions don't affect the process
        Rule.objects.filter(project=self.project).update(status=RuleStatus.PENDING_DELETION)
        self.run_test(conditions=conditions, actions=actions)

    def test_owner_perms(self):
        other_user = self.create_user()
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            owner=other_user.actor.get_actor_identifier(),
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
            owner=self.user.actor.get_actor_identifier(),
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
            owner=self.user.actor.get_actor_identifier(),
            actionMatch="any",
            filterMatch="any",
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
        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]
        expected_filters = deepcopy(filters)
        expected_filters[0]["value"] = ""
        self.run_test(actions=actions, filters=filters, expected_conditions=expected_filters)

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
            owner=self.user.actor.get_actor_identifier(),
            actionMatch="any",
            filterMatch="any",
            actions=actions,
            filters=filters,
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    def test_with_filters(self):
        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
        filters = [
            {"id": "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter", "value": 10}
        ]
        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]
        self.run_test(
            actions=actions,
            conditions=conditions,
            filters=filters,
            expected_conditions=conditions + filters,
        )

    def test_with_no_filter_match(self):
        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]

        self.run_test(
            filter_match=None,
            actions=actions,
            conditions=conditions,
        )

    def test_with_filters_without_match(self):
        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
        filters = [
            {"id": "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter", "value": 10}
        ]
        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="hello world",
            owner=self.user.actor.get_actor_identifier(),
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
        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
        self.run_test(name="no action rule", actions=[], conditions=conditions)

    @patch(
        "sentry.integrations.slack.actions.notification.get_channel_id",
        return_value=("#", None, True),
    )
    @patch("sentry.tasks.integrations.slack.find_channel_id_for_rule.apply_async")
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
        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
        payload = {
            "name": "hello world",
            "owner": f"user:{self.user.id}",
            "environment": None,
            "actionMatch": "any",
            "frequency": 5,
            "actions": actions,
            "conditions": conditions,
        }

        self.get_success_response(
            self.organization.slug,
            self.project.slug,
            **payload,
            status_code=status.HTTP_202_ACCEPTED,
        )

        assert not Rule.objects.filter(label=payload["name"]).exists()
        kwargs = {
            "name": payload["name"],
            "owner": self.user.actor.id,
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
        self.run_test(actions=actions, conditions=[condition])

        condition["comparisonType"] = "percent"
        condition["comparisonInterval"] = "1d"

        self.run_test(actions=actions, conditions=[condition])

    def test_comparison_condition_validation(self):
        condition = {
            "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
            "interval": "1h",
            "value": 50,
            "comparisonType": "percent",
        }
        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]
        response = self.get_error_response(
            self.project.organization.slug,
            self.project.slug,
            name="hello world",
            actionMatch="any",
            filterMatch="any",
            actions=actions,
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
            actions=actions,
            conditions=[condition],
            frequency=30,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert (
            str(response.data["conditions"][0])
            == "Select a valid choice. bad data is not one of the available choices."
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
