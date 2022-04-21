from datetime import datetime
from unittest.mock import patch

import responses
from django.urls import reverse
from freezegun import freeze_time
from pytz import UTC

from sentry.models import (
    Environment,
    Integration,
    Rule,
    RuleActivity,
    RuleActivityType,
    RuleFireHistory,
    RuleStatus,
    SentryAppComponent,
)
from sentry.testutils import APITestCase
from sentry.utils import json


class ProjectRuleDetailsTest(APITestCase):
    endpoint = "sentry-api-0-project-rule-details"

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
        assert response.data["id"] == str(rule.id)
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
        assert response.data["id"] == str(rule.id)
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
        assert response.data["id"] == str(rule.id)
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
        assert response.data["id"] == str(rule.id)

        # ensure that conditions and filters are split up correctly
        assert len(response.data["conditions"]) == 1
        assert response.data["conditions"][0]["id"] == conditions[0]["id"]
        assert len(response.data["filters"]) == 1
        assert response.data["filters"][0]["id"] == conditions[1]["id"]

    @responses.activate
    def test_with_unresponsive_sentryapp(self):
        self.login_as(user=self.user)

        self.sentry_app = self.create_sentry_app(
            organization=self.organization,
            published=True,
            verify_install=False,
            name="Super Awesome App",
            schema={"elements": [self.create_alert_rule_action_schema()]},
        )
        self.installation = self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.organization, user=self.user
        )

        conditions = [
            {"id": "sentry.rules.conditions.every_event.EveryEventCondition"},
            {"id": "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter", "value": 10},
        ]

        actions = [
            {
                "id": "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
                "sentryAppInstallationUuid": self.installation.uuid,
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

        rule = Rule.objects.create(project=self.project, label="foo", data=data)

        url = reverse(
            "sentry-api-0-project-rule-details",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
                "rule_id": rule.id,
            },
        )
        responses.add(responses.GET, "http://example.com/sentry/members", json={}, status=404)

        response = self.client.get(url, format="json")
        assert len(responses.calls) == 1

        assert response.status_code == 200
        # Returns errors while fetching
        assert len(response.data["errors"]) == 1
        assert response.data["errors"][0] == {
            "detail": "Could not fetch details from Super Awesome App"
        }

        # Disables the SentryApp
        assert response.data["actions"][0]["sentryAppInstallationUuid"] == self.installation.uuid
        assert response.data["actions"][0]["disabled"] is True

    @freeze_time()
    def test_last_triggered(self):
        self.login_as(user=self.user)
        rule = self.create_project_rule()
        resp = self.get_success_response(
            self.organization.slug, self.project.slug, rule.id, expand=["lastTriggered"]
        )
        assert resp.data["lastTriggered"] is None
        RuleFireHistory.objects.create(project=self.project, rule=rule, group=self.group)
        resp = self.get_success_response(
            self.organization.slug, self.project.slug, rule.id, expand=["lastTriggered"]
        )
        assert resp.data["lastTriggered"] == datetime.now().replace(tzinfo=UTC)


class UpdateProjectRuleTest(APITestCase):
    @patch("sentry.signals.alert_rule_edited.send_robust")
    def test_simple(self, send_robust):
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
                "owner": self.user.id,
                "actionMatch": "any",
                "filterMatch": "any",
                "actions": [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}],
                "conditions": conditions,
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(rule.id)

        rule = Rule.objects.get(id=rule.id)
        assert rule.label == "hello world"
        assert rule.owner == self.user.actor
        assert rule.environment_id is None
        assert rule.data["action_match"] == "any"
        assert rule.data["filter_match"] == "any"
        assert rule.data["actions"] == [
            {"id": "sentry.rules.actions.notify_event.NotifyEventAction"}
        ]
        assert rule.data["conditions"] == conditions

        assert RuleActivity.objects.filter(rule=rule, type=RuleActivityType.UPDATED.value).exists()
        assert send_robust.called

    def test_no_owner(self):
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
                "owner": None,
                "actionMatch": "any",
                "filterMatch": "any",
                "actions": [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}],
                "conditions": conditions,
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(rule.id)

        rule = Rule.objects.get(id=rule.id)
        assert rule.label == "hello world"
        assert rule.owner is None
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
        assert response.data["id"] == str(rule.id)
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
        assert response.data["id"] == str(rule.id)
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
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
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
            project=project,
            data={"conditions": [conditions], "actions": [actions]},
        )

        actions[0]["channel"] = "#new_channel_name"
        actions[0]["channel_id"] = "new_channel_id"

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

    @responses.activate
    def test_update_channel_slack_workspace_fail(self):
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
            project=project,
            data={"conditions": [conditions], "actions": [actions]},
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

        assert response.status_code == 400, response.content

    @responses.activate
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
        responses.add(
            method=responses.GET,
            url="https://slack.com/api/conversations.info",
            status=200,
            content_type="application/json",
            body=json.dumps(
                {"ok": "true", "channel": {"name": "team-team-team", "id": "CSVK0921"}}
            ),
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
                        "channel_id": "CSVK0921",
                    }
                ],
                "conditions": [
                    {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}
                ],
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(rule.id)
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

    def test_rule_form_owner_perms(self):
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
        other_user = self.create_user()
        response = self.client.put(
            url,
            data={
                "name": "hello world",
                "actionMatch": "any",
                "filterMatch": "any",
                "conditions": [{"id": "sentry.rules.conditions.tagged_event.TaggedEventCondition"}],
                "actions": [],
                "owner": other_user.actor.get_actor_identifier(),
            },
            format="json",
        )

        assert response.status_code == 400, response.content
        assert str(response.data["owner"][0]) == "User is not a member of this organization"

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
                "conditions": [{"id": "sentry.rules.conditions.tagged_event.TaggedEventCondition"}],
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
        assert response.data["id"] == str(rule.id)

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

    @patch("sentry.mediators.alert_rule_actions.AlertRuleActionCreator.run")
    def test_update_alert_rule_action(self, mock_alert_rule_action_creator):
        """
        Ensures that Sentry Apps with schema forms (UI components)
        receive a payload when an alert rule is updated with them.
        """
        self.login_as(user=self.user)

        project = self.create_project()

        rule = Rule.objects.create(project=project, label="my super cool rule")

        sentry_app = self.create_sentry_app(
            name="Pied Piper",
            organization=project.organization,
            schema={"elements": [self.create_alert_rule_action_schema()]},
        )
        install = self.create_sentry_app_installation(
            slug="pied-piper", organization=project.organization
        )

        sentry_app_component = SentryAppComponent.objects.get(
            sentry_app=sentry_app, type="alert-rule-action"
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
            "sentry-api-0-project-rule-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "rule_id": rule.id,
            },
        )
        with patch(
            "sentry.mediators.sentry_app_components.Preparer.run", return_value=sentry_app_component
        ):
            response = self.client.put(
                url,
                data={
                    "name": "my super cool rule",
                    "actionMatch": "any",
                    "filterMatch": "any",
                    "actions": actions,
                    "conditions": [],
                    "filters": [],
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(rule.id)

        rule = Rule.objects.get(id=rule.id)
        assert rule.data["actions"] == actions

        kwargs = {
            "install": install,
            "fields": actions[0].get("settings"),
        }

        call_kwargs = mock_alert_rule_action_creator.call_args[1]

        assert call_kwargs["install"].id == kwargs["install"].id
        assert call_kwargs["fields"] == kwargs["fields"]

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
