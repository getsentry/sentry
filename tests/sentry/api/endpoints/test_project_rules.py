from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import Environment, Rule
from sentry.testutils import APITestCase


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
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()

        conditions = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                "key": "foo",
                "match": "eq",
                "value": "bar",
            }
        ]

        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]

        url = reverse(
            "sentry-api-0-project-rules",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.post(
            url,
            data={
                "name": "hello world",
                "actionMatch": "any",
                "actions": actions,
                "conditions": conditions,
                "frequency": 30,
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert response.data["id"]

        rule = Rule.objects.get(id=response.data["id"])
        assert rule.label == "hello world"
        assert rule.data["action_match"] == "any"
        assert rule.data["actions"] == actions
        assert rule.data["conditions"] == conditions
        assert rule.data["frequency"] == 30

    def test_with_environment(self):
        self.login_as(user=self.user)

        project = self.create_project()

        Environment.get_or_create(project, "production")

        conditions = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                "key": "foo",
                "match": "eq",
                "value": "bar",
            }
        ]

        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]

        url = reverse(
            "sentry-api-0-project-rules",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.post(
            url,
            data={
                "name": "hello world",
                "environment": "production",
                "conditions": conditions,
                "actions": actions,
                "actionMatch": "any",
                "frequency": 30,
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert response.data["id"]
        assert response.data["environment"] == "production"

        rule = Rule.objects.get(id=response.data["id"])
        assert rule.label == "hello world"
        assert rule.environment_id == Environment.get_or_create(rule.project, "production").id

    def test_with_null_environment(self):
        self.login_as(user=self.user)

        project = self.create_project()

        conditions = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                "key": "foo",
                "match": "eq",
                "value": "bar",
            }
        ]

        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]

        url = reverse(
            "sentry-api-0-project-rules",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.post(
            url,
            data={
                "name": "hello world",
                "environment": None,
                "conditions": conditions,
                "actions": actions,
                "actionMatch": "any",
                "frequency": 30,
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert response.data["id"]
        assert response.data["environment"] is None

        rule = Rule.objects.get(id=response.data["id"])
        assert rule.label == "hello world"
        assert rule.environment_id is None

    def test_missing_name(self):
        self.login_as(user=self.user)

        project = self.create_project()

        conditions = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                "key": "foo",
                "match": "eq",
                "value": "bar",
            }
        ]

        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]

        url = reverse(
            "sentry-api-0-project-rules",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.post(
            url,
            data={"actionMatch": "any", "actions": actions, "conditions": conditions},
            format="json",
        )

        assert response.status_code == 400, response.content

    def test_match_values(self):
        self.login_as(user=self.user)

        project = self.create_project()

        conditions = [
            {
                "id": "sentry.rules.conditions.tagged_event.TaggedEventCondition",
                "key": "foo",
                "match": "is",
            }
        ]

        actions = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]

        url = reverse(
            "sentry-api-0-project-rules",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.post(
            url,
            data={
                "name": "hello world",
                "actionMatch": "any",
                "actions": actions,
                "conditions": conditions,
                "frequency": 30,
            },
            format="json",
        )

        assert response.status_code == 200, response.content

        # should fail if using another match type
        conditions = [
            {
                "id": "sentry.rules.conditions.tagged_event.TaggedEventCondition",
                "key": "foo",
                "match": "eq",
            }
        ]

        response = self.client.post(
            url,
            data={
                "name": "hello world",
                "actionMatch": "any",
                "actions": actions,
                "conditions": conditions,
                "frequency": 30,
            },
            format="json",
        )

        assert response.status_code == 400, response.content
