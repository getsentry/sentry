from copy import deepcopy
from unittest.mock import patch

import responses
from django.urls import reverse

from sentry.models import Environment, Integration, Rule, RuleActivity, RuleActivityType
from sentry.testutils import APITestCase
from sentry.utils import json


class ProjectRuleListTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project1 = self.create_project(teams=[team], name="foo")
        self.create_project(teams=[team], name="bar")

        url = reverse(
            "sentry-api-0-project-rules",
            kwargs={"organization_slug": project1.organization.slug, "project_slug": project1.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content

        rule_count = Rule.objects.filter(project=project1).count()
        assert len(response.data) == rule_count


class CreateProjectRuleTest(APITestCase):
    endpoint = "sentry-api-0-project-rules"
    method = "post"

    def run_test(
        self,
        actions,
        expected_conditions=None,
        filters=None,
        name="hello world",
        action_match="any",
        filter_match="any",
        frequency=30,
        conditions=None,
        **kwargs,
    ):
        self.login_as(user=self.user)
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
        assert rule.created_by == self.user
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
        self.login_as(user=self.user)

        project = self.create_project()
        integration = Integration.objects.create(
            provider="slack",
            name="Awesome Team",
            external_id="TXXXXXXX1",
            metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        integration.add_organization(project.organization, self.user)

        url = reverse(
            "sentry-api-0-project-rules",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        responses.add(
            method=responses.GET,
            url="https://slack.com/api/conversations.info",
            status=200,
            content_type="application/json",
            body=json.dumps(
                {"ok": "true", "channel": {"name": "team-team-team", "id": "CSVK0921"}}
            ),
        )
        response = self.client.post(
            url,
            data={
                "name": "hello world",
                "owner": f"user:{self.user.id}",
                "environment": None,
                "actionMatch": "any",
                "frequency": 5,
                "actions": [
                    {
                        "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                        "name": "Send a notification to the funinthesun Slack workspace to #team-team-team and show tags [] in notification",
                        "workspace": integration.id,
                        "channel": "#team-team-team",
                        "input_channel_id": "CSVK0921",
                    }
                ],
                "conditions": [
                    {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}
                ],
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert response.data["actions"][0]["channel_id"] == "CSVK0921"

    def test_missing_name(self):
        self.login_as(user=self.user)
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
            status_code=400,
        )

    def test_owner_perms(self):
        self.login_as(user=self.user)
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
            status_code=400,
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
            status_code=400,
        )
        assert str(response.data["owner"][0]) == "Team is not a member of this organization"

    def test_frequency_percent_validation(self):
        self.login_as(user=self.user)
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
            status_code=400,
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
            status_code=200,
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
            status_code=400,
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
        self.login_as(user=self.user)
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
            status_code=400,
        )

        assert response.data == {
            "filterMatch": ["Must select a filter match (all, any, none) if filters are supplied."]
        }

    def test_no_actions(self):
        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
        self.run_test(name="no action rule", actions=[], conditions=conditions)

    @patch(
        "sentry.integrations.slack.notify_action.get_channel_id",
        return_value=("#", None, True),
    )
    @patch("sentry.integrations.slack.tasks.find_channel_id_for_rule.apply_async")
    @patch("sentry.integrations.slack.tasks.uuid4")
    def test_kicks_off_slack_async_job(
        self, mock_uuid4, mock_find_channel_id_for_alert_rule, mock_get_channel_id
    ):
        project = self.create_project()

        mock_uuid4.return_value = self.get_mock_uuid()
        self.login_as(self.user)

        integration = Integration.objects.create(
            provider="slack",
            name="Awesome Team",
            external_id="TXXXXXXX1",
            metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        integration.add_organization(project.organization, self.user)

        url = reverse(
            "sentry-api-0-project-rules",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
            },
        )
        data = {
            "name": "hello world",
            "owner": f"user:{self.user.id}",
            "environment": None,
            "actionMatch": "any",
            "frequency": 5,
            "actions": [
                {
                    "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                    "name": "Send a notification to the funinthesun Slack workspace to #team-team-team and show tags [] in notification",
                    "workspace": str(integration.id),
                    "channel": "#team-team-team",
                    "channel_id": "",
                    "tags": "",
                }
            ],
            "conditions": [
                {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}
            ],
        }
        self.client.post(
            url,
            data=data,
            format="json",
        )

        assert not Rule.objects.filter(label="hello world").exists()
        kwargs = {
            "name": data["name"],
            "owner": self.user.actor.id,
            "environment": data.get("environment"),
            "action_match": data["actionMatch"],
            "filter_match": data.get("filterMatch"),
            "conditions": data.get("conditions", []) + data.get("filters", []),
            "actions": data.get("actions", []),
            "frequency": data.get("frequency"),
            "user_id": self.user.id,
            "uuid": "abc123",
        }
        call_args = mock_find_channel_id_for_alert_rule.call_args[1]["kwargs"]
        assert call_args.pop("project").id == project.id
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
        self.login_as(user=self.user)
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
            status_code=400,
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
            status_code=400,
        )
        assert (
            str(response.data["conditions"][0])
            == "Select a valid choice. bad data is not one of the available choices."
        )

    @patch("sentry.mediators.alert_rule_actions.AlertRuleActionCreator.run")
    def test_runs_alert_rule_action_creator(self, mock_alert_rule_action_creator):
        """
        Ensures that Sentry Apps with schema forms (UI components)
        receive a payload when an alert rule is created with them.
        """
        self.login_as(user=self.user)

        project = self.create_project()

        self.create_sentry_app(
            name="Pied Piper",
            organization=project.organization,
            schema={"elements": [self.create_alert_rule_action_schema()]},
        )
        install = self.create_sentry_app_installation(
            slug="pied-piper", organization=project.organization
        )

        actions = [
            {
                "id": "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
                "settings": [
                    {"name": "title", "value": "Team Rocket"},
                    {"name": "summary", "value": "We're blasting off again."},
                ],
                "sentryAppInstallationUuid": install.uuid,
                "hasSchemaFormConfig": True,
            },
        ]

        url = reverse(
            "sentry-api-0-project-rules",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        response = self.client.post(
            url,
            data={
                "name": "my super cool rule",
                "owner": f"user:{self.user.id}",
                "conditions": [],
                "filters": [],
                "actions": actions,
                "filterMatch": "any",
                "actionMatch": "any",
                "frequency": 30,
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert response.data["id"]

        rule = Rule.objects.get(id=response.data["id"])
        assert rule.data["actions"] == actions

        kwargs = {
            "install": install,
            "fields": actions[0].get("settings"),
        }

        call_kwargs = mock_alert_rule_action_creator.call_args[1]

        assert call_kwargs["install"].id == kwargs["install"].id
        assert call_kwargs["fields"] == kwargs["fields"]
