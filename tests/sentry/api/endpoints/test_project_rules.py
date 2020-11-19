from __future__ import absolute_import

from sentry.models import Environment, Integration, Rule, RuleActivity, RuleActivityType
from sentry.testutils import APITestCase
from sentry.utils import json


class ProjectRuleBaseTest(APITestCase):
    endpoint = "sentry-api-0-project-rules"

    def setUp(self):
        self.login_as(user=self.user)


class ProjectRuleListTest(ProjectRuleBaseTest):
    def setUp(self):
        super(ProjectRuleListTest, self).setUp()

    def test_simple(self):
        team = self.create_team()
        project1 = self.create_project(teams=[team], name="foo")
        self.create_project(teams=[team], name="bar")

        response = self.get_valid_response(project1.organization.slug, project1.slug)
        rule_count = Rule.objects.filter(project=project1).count()
        assert len(response.data) == rule_count


class CreateProjectRuleTest(ProjectRuleBaseTest):
    method = "post"

    def setUp(self):
        super(CreateProjectRuleTest, self).setUp()

    def test_simple(self):
        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]

        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]

        response = self.get_valid_response(
            self.project.organization.slug,
            self.project.slug,
            **{
                "name": "hello world",
                "actionMatch": "any",
                "filterMatch": "any",
                "actions": actions,
                "conditions": conditions,
                "frequency": 30,
            }
        )
        assert response.data["id"]
        assert response.data["createdBy"] == {
            "id": self.user.id,
            "name": self.user.get_display_name(),
            "email": self.user.email,
        }

        rule = Rule.objects.get(id=response.data["id"])
        assert rule.label == "hello world"
        assert rule.data["action_match"] == "any"
        assert rule.data["filter_match"] == "any"
        assert rule.data["actions"] == actions
        assert rule.data["conditions"] == conditions
        assert rule.data["frequency"] == 30
        assert rule.created_by == self.user

        assert RuleActivity.objects.filter(rule=rule, type=RuleActivityType.CREATED.value).exists()

    def test_with_environment(self):
        Environment.get_or_create(self.project, "production")

        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]

        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]

        response = self.get_valid_response(
            self.project.organization.slug,
            self.project.slug,
            **{
                "name": "hello world",
                "environment": "production",
                "conditions": conditions,
                "actions": actions,
                "actionMatch": "any",
                "filterMatch": "any",
                "frequency": 30,
            }
        )
        assert response.data["id"]
        assert response.data["environment"] == "production"

        rule = Rule.objects.get(id=response.data["id"])
        assert rule.label == "hello world"
        assert rule.environment_id == Environment.get_or_create(rule.project, "production").id

        assert RuleActivity.objects.filter(rule=rule, type=RuleActivityType.CREATED.value).exists()

    def test_with_null_environment(self):
        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]

        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]

        response = self.get_valid_response(
            self.project.organization.slug,
            self.project.slug,
            **{
                "name": "hello world",
                "environment": None,
                "conditions": conditions,
                "actions": actions,
                "actionMatch": "any",
                "filterMatch": "any",
                "frequency": 30,
            }
        )
        assert response.data["id"]
        assert response.data["environment"] is None

        rule = Rule.objects.get(id=response.data["id"])
        assert rule.label == "hello world"
        assert rule.environment_id is None

    def test_slack_channel_id_saved(self):
        project = self.create_project()
        integration = Integration.objects.create(
            provider="slack",
            name="Awesome Team",
            external_id="TXXXXXXX1",
            metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        integration.add_organization(project.organization, self.user)

        response = self.get_valid_response(
            project.organization.slug,
            project.slug,
            **{
                "name": "hello world",
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
            }
        )
        assert response.data["actions"][0]["channel_id"] == "CSVK0921"

    def test_missing_name(self):
        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]

        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]

        self.get_valid_response(
            self.project.organization.slug,
            self.project.slug,
            status_code=400,
            **{
                "actionMatch": "any",
                "filterMatch": "any",
                "actions": actions,
                "conditions": conditions,
            }
        )

    def test_match_values(self):
        conditions = [
            {
                "id": "sentry.rules.conditions.tagged_event.TaggedEventCondition",
                "key": "foo",
                "match": "is",
            }
        ]

        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]

        self.get_valid_response(
            self.project.organization.slug,
            self.project.slug,
            **{
                "name": "hello world",
                "actionMatch": "any",
                "filterMatch": "any",
                "actions": actions,
                "conditions": conditions,
                "frequency": 30,
            }
        )

        # should fail if using another match type
        conditions = [
            {
                "id": "sentry.rules.conditions.tagged_event.TaggedEventCondition",
                "key": "foo",
                "match": "eq",
            }
        ]

        self.get_valid_response(
            self.project.organization.slug,
            self.project.slug,
            status_code=400,
            **{
                "name": "hello world",
                "actionMatch": "any",
                "filterMatch": "any",
                "actions": actions,
                "conditions": conditions,
                "frequency": 30,
            }
        )

    def test_with_filters(self):
        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
        filters = [
            {"id": "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter", "value": 10}
        ]
        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]

        response = self.get_valid_response(
            self.project.organization.slug,
            self.project.slug,
            **{
                "name": "hello world",
                "conditions": conditions,
                "filters": filters,
                "actions": actions,
                "filterMatch": "any",
                "actionMatch": "any",
                "frequency": 30,
            }
        )
        assert response.data["id"]

        rule = Rule.objects.get(id=response.data["id"])
        assert rule.label == "hello world"
        assert rule.data["conditions"] == conditions + filters

    def test_with_no_filter_match(self):
        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]

        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]

        response = self.get_valid_response(
            self.project.organization.slug,
            self.project.slug,
            **{
                "name": "hello world",
                "conditions": conditions,
                "actions": actions,
                "actionMatch": "any",
                "frequency": 30,
            }
        )
        assert response.data["id"]

        rule = Rule.objects.get(id=response.data["id"])
        assert rule.label == "hello world"

    def test_with_filters_without_match(self):
        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
        filters = [
            {"id": "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter", "value": 10}
        ]
        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]

        response = self.get_valid_response(
            self.project.organization.slug,
            self.project.slug,
            status_code=400,
            **{
                "name": "hello world",
                "conditions": conditions,
                "filters": filters,
                "actions": actions,
                "actionMatch": "any",
                "frequency": 30,
            }
        )
        assert json.loads(response.content) == {
            "filterMatch": ["Must select a filter match (all, any, none) if filters are supplied."]
        }

    def test_no_actions(self):
        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]

        response = self.get_valid_response(
            self.project.organization.slug,
            self.project.slug,
            **{
                "name": "no action rule",
                "actionMatch": "any",
                "filterMatch": "any",
                "conditions": conditions,
                "frequency": 30,
            }
        )
        assert response.data["id"]
        assert response.data["createdBy"] == {
            "id": self.user.id,
            "name": self.user.get_display_name(),
            "email": self.user.email,
        }

        rule = Rule.objects.get(id=response.data["id"])
        assert rule.label == "no action rule"
        assert rule.data["action_match"] == "any"
        assert rule.data["filter_match"] == "any"
        assert rule.data["actions"] == []
        assert rule.data["conditions"] == conditions
        assert rule.data["frequency"] == 30
        assert rule.created_by == self.user

        assert RuleActivity.objects.filter(rule=rule, type=RuleActivityType.CREATED.value).exists()
