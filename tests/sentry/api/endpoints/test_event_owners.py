from __future__ import absolute_import

import six
from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase

from sentry.models import ProjectOwnership
from sentry.ownership.grammar import Rule, Owner, Matcher, dump_schema


class ProjectOwnershipEndpointTestCase(APITestCase):
    def setUp(self):
        self.login_as(user=self.user)
        self.user2 = self.create_user("user2@example.com")
        self.user3 = self.create_user("user3@example.com")

        self.team = self.create_team(
            organization=self.organization, slug="tiger-team", members=[self.user]
        )
        self.team2 = self.create_team(
            organization=self.organization, slug="tiger-team2", members=[self.user2]
        )
        self.team3 = self.create_team(
            organization=self.organization, slug="tiger-team3", members=[self.user3]
        )

        self.project = self.create_project(
            organization=self.organization, teams=[self.team, self.team2, self.team3], slug="bengal"
        )

    def test_no_rules(self):
        event1 = self.store_event(
            data={"stacktrace": {"frames": [{"filename": "foo.py"}]}}, project_id=self.project.id
        )

        self.path = reverse(
            "sentry-api-0-event-owners",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "event_id": event1.event_id,
            },
        )

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert len(resp.data["owners"]) == 0
        assert resp.data["rule"] is None
        assert len(resp.data["rules"]) == 0

    def test_no_matching_owners(self):
        rule_a = Rule(Matcher("path", "bar.py"), [Owner("user", self.user.email)])

        ProjectOwnership.objects.create(
            project_id=self.project.id, schema=dump_schema([rule_a]), fallthrough=True
        )

        event1 = self.store_event(
            data={"stacktrace": {"frames": [{"filename": "foo.py"}]}}, project_id=self.project.id
        )

        self.path = reverse(
            "sentry-api-0-event-owners",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "event_id": event1.event_id,
            },
        )

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert len(resp.data["owners"]) == 0
        assert resp.data["rule"] is None
        assert len(resp.data["rules"]) == 0

    def test_matching_non_existing_owner(self):
        rule_a = Rule(Matcher("path", "*"), [Owner("user", "doesnotexist@fake.com")])

        ProjectOwnership.objects.create(
            project_id=self.project.id, schema=dump_schema([rule_a]), fallthrough=True
        )

        event1 = self.store_event(
            data={"stacktrace": {"frames": [{"filename": "foo.py"}]}}, project_id=self.project.id
        )

        self.path = reverse(
            "sentry-api-0-event-owners",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "event_id": event1.event_id,
            },
        )

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert len(resp.data["owners"]) == 0
        assert resp.data["rule"] == Matcher(type="path", pattern="*")
        assert len(resp.data["rules"]) == 1

    def test_one_owner(self):
        rule_a = Rule(Matcher("path", "*.py"), [Owner("user", self.user.email)])

        ProjectOwnership.objects.create(
            project_id=self.project.id, schema=dump_schema([rule_a]), fallthrough=True
        )

        event1 = self.store_event(
            data={"stacktrace": {"frames": [{"filename": "foo.py"}]}}, project_id=self.project.id
        )

        self.path = reverse(
            "sentry-api-0-event-owners",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "event_id": event1.event_id,
            },
        )

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert len(resp.data["owners"]) == 1
        assert resp.data["owners"][0]["id"] == six.text_type(self.user.id)
        assert resp.data["rule"] == Matcher("path", "*.py")
        assert len(resp.data["rules"]) == 1

    def test_multiple_owners(self):
        users = [self.user, self.user2, self.user3]
        rules = [
            Rule(Matcher("path", "*.py"), [Owner("user", users[0].email)]),
            Rule(Matcher("path", "*foo*"), [Owner("user", users[1].email)]),
            Rule(Matcher("path", "*"), [Owner("user", users[2].email)]),
        ]

        ProjectOwnership.objects.create(
            project_id=self.project.id, schema=dump_schema(rules), fallthrough=True
        )

        event1 = self.store_event(
            data={"stacktrace": {"frames": [{"filename": "foo.py"}]}}, project_id=self.project.id
        )

        self.path = reverse(
            "sentry-api-0-event-owners",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "event_id": event1.event_id,
            },
        )

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert len(resp.data["owners"]) == 3
        assert [o["id"] for o in resp.data["owners"]] == [six.text_type(u.id) for u in users]
        assert resp.data["rule"] == Matcher("path", "*.py")
        assert len(resp.data["rules"]) == 3

    def test_multiple_owners_order_matters(self):
        users = [self.user, self.user2, self.user3]
        rules = [
            Rule(Matcher("path", "*.py"), [Owner("user", users[0].email)]),
            Rule(Matcher("path", "*foo*"), [Owner("user", users[1].email)]),
            Rule(Matcher("path", "*"), [Owner("user", users[2].email)]),
        ]
        rules.reverse()

        ProjectOwnership.objects.create(
            project_id=self.project.id, schema=dump_schema(rules), fallthrough=True
        )

        event1 = self.store_event(
            data={"stacktrace": {"frames": [{"filename": "foo.py"}]}}, project_id=self.project.id
        )

        self.path = reverse(
            "sentry-api-0-event-owners",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "event_id": event1.event_id,
            },
        )

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert len(resp.data["owners"]) == 3
        assert [o["id"] for o in resp.data["owners"]] == [
            six.text_type(u.id) for u in reversed(users)
        ]
        assert resp.data["rule"] == Matcher("path", "*")
        assert len(resp.data["rules"]) == 3

    def test_owners_of_different_types_ordered_correctly(self):
        owners = [self.user, self.team3, self.user2, self.team2, self.user3, self.team]
        rules = [
            Rule(Matcher("path", "*.py"), [Owner("user", owners[0].email)]),
            Rule(Matcher("path", "*py"), [Owner("team", owners[1].slug)]),
            Rule(Matcher("path", "*foo*"), [Owner("user", owners[2].email)]),
            Rule(Matcher("path", "*y"), [Owner("team", owners[3].slug)]),
            Rule(Matcher("path", "*"), [Owner("user", owners[4].email)]),
            Rule(Matcher("path", "*o.py"), [Owner("team", owners[5].slug)]),
        ]

        ProjectOwnership.objects.create(
            project_id=self.project.id, schema=dump_schema(rules), fallthrough=True
        )

        event1 = self.store_event(
            data={"stacktrace": {"frames": [{"filename": "foo.py"}]}}, project_id=self.project.id
        )

        self.path = reverse(
            "sentry-api-0-event-owners",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "event_id": event1.event_id,
            },
        )

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert len(resp.data["owners"]) == 6
        assert [o["id"] for o in resp.data["owners"]] == [six.text_type(o.id) for o in owners]
        assert [o["type"] for o in resp.data["owners"]] == ["user", "team"] * 3
        assert resp.data["rule"] == Matcher("path", "*.py")
        assert len(resp.data["rules"]) == 6
