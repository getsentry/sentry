from __future__ import absolute_import

import responses
import six

from django.core.urlresolvers import reverse

from sentry.models import Environment, Integration, Rule, RuleActivity, RuleActivityType, RuleStatus
from sentry.testutils import APITestCase
from sentry.utils import json


class ProjectRuleDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project1 = self.create_project(teams=[team], name="foo", fire_project_created=True)
        self.create_project(teams=[team], name="bar", fire_project_created=True)

        rule = project1.rule_set.all()[0]

        url = reverse(
            "sentry-api-0-project-rule-details",
            kwargs={
                "organization_slug": project1.organization.slug,
                "project_slug": project1.slug,
                "rule_id": rule.id,
            },
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == six.text_type(rule.id)
        assert response.data["environment"] is None

    def test_non_existing_rule(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project1 = self.create_project(teams=[team], name="foo", fire_project_created=True)
        self.create_project(teams=[team], name="bar", fire_project_created=True)

        url = reverse(
            "sentry-api-0-project-rule-details",
            kwargs={
                "organization_slug": project1.organization.slug,
                "project_slug": project1.slug,
                "rule_id": 12345,
            },
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 404

    def test_with_environment(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project1 = self.create_project(teams=[team], name="foo", fire_project_created=True)
        self.create_project(teams=[team], name="bar", fire_project_created=True)

        rule = project1.rule_set.all()[0]
        rule.update(environment_id=Environment.get_or_create(rule.project, "production").id)

        url = reverse(
            "sentry-api-0-project-rule-details",
            kwargs={
                "organization_slug": project1.organization.slug,
                "project_slug": project1.slug,
                "rule_id": rule.id,
            },
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == six.text_type(rule.id)
        assert response.data["environment"] == "production"

    def test_with_null_environment(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project1 = self.create_project(teams=[team], name="foo", fire_project_created=True)
        self.create_project(teams=[team], name="bar", fire_project_created=True)

        rule = project1.rule_set.all()[0]
        rule.update(environment_id=None)

        url = reverse(
            "sentry-api-0-project-rule-details",
            kwargs={
                "organization_slug": project1.organization.slug,
                "project_slug": project1.slug,
                "rule_id": rule.id,
            },
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == six.text_type(rule.id)
        assert response.data["environment"] is None

    def test_with_filters(self):
        self.login_as(user=self.user)

        project = self.create_project()

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

        rule = Rule.objects.create(project=project, label="foo", data=data)

        url = reverse(
            "sentry-api-0-project-rule-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "rule_id": rule.id,
            },
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == six.text_type(rule.id)

        # ensure that conditions and filters are split up correctly
        assert len(response.data["conditions"]) == 1
        assert response.data["conditions"][0]["id"] == conditions[0]["id"]
        assert len(response.data["filters"]) == 1
        assert response.data["filters"][0]["id"] == conditions[1]["id"]


class UpdateProjectRuleTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()

        rule = Rule.objects.create(project=project, label="foo")

        conditions = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                "key": "foo",
                "match": "eq",
                "value": "bar",
            }
        ]

        url = reverse(
            "sentry-api-0-project-rule-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "rule_id": rule.id,
            },
        )
        response = self.client.put(
            url,
            data={
                "name": "hello world",
                "actionMatch": "any",
                "filterMatch": "any",
                "actions": [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}],
                "conditions": conditions,
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert response.data["id"] == six.text_type(rule.id)

        rule = Rule.objects.get(id=rule.id)
        assert rule.label == "hello world"
        assert rule.environment_id is None
        assert rule.data["action_match"] == "any"
        assert rule.data["filter_match"] == "any"
        assert rule.data["actions"] == [
            {"id": "sentry.rules.actions.notify_event.NotifyEventAction"}
        ]
        assert rule.data["conditions"] == conditions

        assert RuleActivity.objects.filter(rule=rule, type=RuleActivityType.UPDATED.value).exists()

    def test_update_name(self):
        self.login_as(user=self.user)

        project = self.create_project()

        rule = Rule.objects.create(project=project, label="foo")

        url = reverse(
            "sentry-api-0-project-rule-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "rule_id": rule.id,
            },
        )

        response = self.client.put(
            url,
            data={
                "environment": None,
                "actionMatch": "all",
                "filterMatch": "all",
                "frequency": 30,
                "name": "test",
                "conditions": [
                    {
                        "interval": "1h",
                        "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
                        "value": 666,
                        "name": "The issue is seen more than 30 times in 1m",
                    }
                ],
                "id": rule.id,
                "actions": [
                    {
                        "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                        "name": "Send a notification (for all legacy integrations)",
                    }
                ],
                "dateCreated": "2018-04-24T23:37:21.246Z",
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert (
            response.data["conditions"][0]["name"] == "The issue is seen more than 666 times in 1h"
        )

        assert RuleActivity.objects.filter(rule=rule, type=RuleActivityType.UPDATED.value).exists()

    def test_with_environment(self):
        self.login_as(user=self.user)

        project = self.create_project()

        Environment.get_or_create(project, "production")

        rule = Rule.objects.create(project=project, label="foo")

        url = reverse(
            "sentry-api-0-project-rule-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "rule_id": rule.id,
            },
        )
        response = self.client.put(
            url,
            data={
                "name": "hello world",
                "environment": "production",
                "actionMatch": "any",
                "filterMatch": "any",
                "actions": [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}],
                "conditions": [
                    {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}
                ],
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert response.data["id"] == six.text_type(rule.id)
        assert response.data["environment"] == "production"

        rule = Rule.objects.get(id=rule.id)
        assert rule.label == "hello world"
        assert rule.environment_id == Environment.get_or_create(rule.project, "production").id

    def test_with_null_environment(self):
        self.login_as(user=self.user)

        project = self.create_project()

        rule = Rule.objects.create(
            project=project,
            environment_id=Environment.get_or_create(project, "production").id,
            label="foo",
        )

        url = reverse(
            "sentry-api-0-project-rule-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "rule_id": rule.id,
            },
        )
        response = self.client.put(
            url,
            data={
                "name": "hello world",
                "environment": None,
                "actionMatch": "any",
                "filterMatch": "any",
                "actions": [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}],
                "conditions": [
                    {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}
                ],
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert response.data["id"] == six.text_type(rule.id)
        assert response.data["environment"] is None

        rule = Rule.objects.get(id=rule.id)
        assert rule.label == "hello world"
        assert rule.environment_id is None

    @responses.activate
    def test_update_channel_slack(self):
        self.login_as(user=self.user)

        project = self.create_project()
        integration = Integration.objects.create(
            provider="slack",
            name="Awesome Team",
            external_id="TXXXXXXX1",
            metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        integration.add_organization(project.organization, self.user)

        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]

        actions = [
            {
                "channel_id": "old_channel_id",
                "workspace": integration.id,
                "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                "channel": "#old_channel_name",
            }
        ]

        rule = Rule.objects.create(
            project=project, data={"conditions": [conditions], "actions": [actions]},
        )

        actions[0]["channel"] = "#new_channel_name"

        url = reverse(
            "sentry-api-0-project-rule-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "rule_id": rule.id,
            },
        )

        channels = {
            "ok": "true",
            "channels": [
                {"name": "old_channel_name", "id": "old_channel_id"},
                {"name": "new_channel_name", "id": "new_channel_id"},
            ],
        }

        responses.add(
            method=responses.GET,
            url="https://slack.com/api/channels.list",
            status=200,
            content_type="application/json",
            body=json.dumps(channels),
        )

        response = self.client.put(
            url,
            data={
                "name": "#new_channel_name",
                "actionMatch": "any",
                "filterMatch": "any",
                "actions": actions,
                "conditions": conditions,
                "frequency": 30,
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        rule = Rule.objects.get(id=response.data["id"])
        assert rule.label == "#new_channel_name"
        assert rule.data["actions"][0]["channel_id"] == "new_channel_id"

    def test_slack_channel_id_saved(self):
        self.login_as(user=self.user)

        project = self.create_project()

        rule = Rule.objects.create(
            project=project,
            environment_id=Environment.get_or_create(project, "production").id,
            label="foo",
        )
        integration = Integration.objects.create(
            provider="slack",
            name="Awesome Team",
            external_id="TXXXXXXX1",
            metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        integration.add_organization(project.organization, self.user)

        url = reverse(
            "sentry-api-0-project-rule-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "rule_id": rule.id,
            },
        )
        response = self.client.put(
            url,
            data={
                "name": "hello world",
                "environment": None,
                "actionMatch": "any",
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
        assert response.data["id"] == six.text_type(rule.id)
        assert response.data["actions"][0]["channel_id"] == "CSVK0921"

    def test_invalid_rule_node_type(self):
        self.login_as(user=self.user)

        project = self.create_project()

        rule = Rule.objects.create(project=project, label="foo")

        url = reverse(
            "sentry-api-0-project-rule-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "rule_id": rule.id,
            },
        )
        response = self.client.put(
            url,
            data={
                "name": "hello world",
                "actionMatch": "any",
                "filterMatch": "any",
                "conditions": [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}],
                "actions": [],
            },
            format="json",
        )

        assert response.status_code == 400, response.content

    def test_invalid_rule_node(self):
        self.login_as(user=self.user)

        project = self.create_project()

        rule = Rule.objects.create(project=project, label="foo")

        url = reverse(
            "sentry-api-0-project-rule-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "rule_id": rule.id,
            },
        )
        response = self.client.put(
            url,
            data={
                "name": "hello world",
                "actionMatch": "any",
                "filterMatch": "any",
                "conditions": [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}],
                "actions": [{"id": "foo"}],
            },
            format="json",
        )

        assert response.status_code == 400, response.content

    def test_rule_form_not_valid(self):
        self.login_as(user=self.user)

        project = self.create_project()

        rule = Rule.objects.create(project=project, label="foo")

        url = reverse(
            "sentry-api-0-project-rule-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "rule_id": rule.id,
            },
        )
        response = self.client.put(
            url,
            data={
                "name": "hello world",
                "actionMatch": "any",
                "filterMatch": "any",
                "conditions": [{"id": "sentry.rules.conditions.tagged_event.TaggedEventCondition"}],
                "actions": [],
            },
            format="json",
        )

        assert response.status_code == 400, response.content

        def test_rule_form_missing_condition(self):
            self.login_as(user=self.user)

            project = self.create_project()

            rule = Rule.objects.create(project=project, label="foo")

            url = reverse(
                "sentry-api-0-project-rule-details",
                kwargs={
                    "organization_slug": project.organization.slug,
                    "project_slug": project.slug,
                    "rule_id": rule.id,
                },
            )
            response = self.client.put(
                url,
                data={
                    "name": "hello world",
                    "actionMatch": "any",
                    "filterMatch": "any",
                    "conditions": [],
                    "actions": [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}],
                },
                format="json",
            )

            assert response.status_code == 400, response.content

        def test_rule_form_missing_action(self):
            self.login_as(user=self.user)

            project = self.create_project()

            rule = Rule.objects.create(project=project, label="foo")

            url = reverse(
                "sentry-api-0-project-rule-details",
                kwargs={
                    "organization_slug": project.organization.slug,
                    "project_slug": project.slug,
                    "rule_id": rule.id,
                },
            )
            response = self.client.put(
                url,
                data={
                    "name": "hello world",
                    "actionMatch": "any",
                    "filterMatch": "any",
                    "action": [],
                    "conditions": [
                        {"id": "sentry.rules.conditions.tagged_event.TaggedEventCondition"}
                    ],
                },
                format="json",
            )

            assert response.status_code == 400, response.content

    def test_update_filters(self):
        self.login_as(user=self.user)

        project = self.create_project()

        rule = Rule.objects.create(project=project, label="foo")

        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
        filters = [
            {"id": "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter", "value": 10}
        ]

        url = reverse(
            "sentry-api-0-project-rule-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "rule_id": rule.id,
            },
        )
        response = self.client.put(
            url,
            data={
                "name": "hello world",
                "actionMatch": "any",
                "filterMatch": "any",
                "actions": [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}],
                "conditions": conditions,
                "filters": filters,
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert response.data["id"] == six.text_type(rule.id)

        rule = Rule.objects.get(id=rule.id)
        assert rule.label == "hello world"
        assert rule.environment_id is None
        assert rule.data["action_match"] == "any"
        assert rule.data["filter_match"] == "any"
        assert rule.data["actions"] == [
            {"id": "sentry.rules.actions.notify_event.NotifyEventAction"}
        ]
        assert rule.data["conditions"] == conditions + filters

        assert RuleActivity.objects.filter(rule=rule, type=RuleActivityType.UPDATED.value).exists()


class DeleteProjectRuleTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()

        rule = Rule.objects.create(project=project, label="foo")

        url = reverse(
            "sentry-api-0-project-rule-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "rule_id": rule.id,
            },
        )
        response = self.client.delete(url)

        assert response.status_code == 202, response.content

        rule = Rule.objects.get(id=rule.id)
        assert rule.status == RuleStatus.PENDING_DELETION

        assert RuleActivity.objects.filter(rule=rule, type=RuleActivityType.DELETED.value).exists()
