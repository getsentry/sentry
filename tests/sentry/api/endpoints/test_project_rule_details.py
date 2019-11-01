from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.models import Environment, Rule, RuleStatus
from sentry.testutils import APITestCase


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
        assert rule.data["actions"] == [
            {"id": "sentry.rules.actions.notify_event.NotifyEventAction"}
        ]
        assert rule.data["conditions"] == conditions

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
                "frequency": 30,
                "name": "test",
                "conditions": [
                    {
                        "interval": "1h",
                        "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
                        "value": 666,
                        "name": "An issue is seen more than 30 times in 1m",
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
            response.data["conditions"][0]["name"] == "An issue is seen more than 666 times in 1h"
        )

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
                    "action": [],
                    "conditions": [
                        {"id": "sentry.rules.conditions.tagged_event.TaggedEventCondition"}
                    ],
                },
                format="json",
            )

            assert response.status_code == 400, response.content


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
