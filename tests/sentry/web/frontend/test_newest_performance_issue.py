import logging
import uuid
from time import time
from unittest import mock

from django.urls import reverse
from exam import fixture

from sentry.event_manager import EventManager
from sentry.testutils import TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.performance_issues.event_generators import EVENTS


def make_event(**kwargs):
    result = {
        "event_id": uuid.uuid1().hex,
        "level": logging.ERROR,
        "logger": "default",
        "tags": [],
    }
    result.update(kwargs)
    return result


nplus_one_no_timestamp = {**EVENTS["n-plus-one-in-django-index-view"]}
del nplus_one_no_timestamp["timestamp"]


class DisabledMemberViewTest(TestCase):
    @fixture
    def path(self):
        return reverse("sentry-organization-newest-performance-issue", args=[self.org.slug])

    def setUp(self):
        super().setUp()
        self.owner = self.create_user()
        self.org = self.create_organization(owner=self.owner)
        self.user = self.create_user()
        self.create_member(user=self.user, organization=self.org, role="member")
        self.team1 = self.create_team(organization=self.org, members=[self.user])
        self.team2 = self.create_team(organization=self.org, members=[self.owner])
        self.project1 = self.create_project(organization=self.org, teams=[self.team1])
        self.project2 = self.create_project(organization=self.org, teams=[self.team2])
        self.login_as(self.user)

    @override_options({"store.use-ingest-performance-detection-only": 1.0})
    @override_options({"performance.issues.all.problem-creation": 1.0})
    @override_options({"performance.issues.all.problem-detection": 1.0})
    @override_options({"performance.issues.n_plus_one_db.problem-creation": 1.0})
    def test_simple(self):
        self.project1.update_option("sentry:performance_issue_creation_rate", 1.0)
        self.project2.update_option("sentry:performance_issue_creation_rate", 1.0)
        with mock.patch("sentry_sdk.tracing.Span.containing_transaction"), self.feature(
            {
                "projects:performance-suspect-spans-ingestion": True,
                "organizations:performance-issues-ingest": True,
            }
        ):
            latest_event_time = time()
            older_event_time = latest_event_time - 300

            manager = EventManager(make_event(**nplus_one_no_timestamp, timestamp=older_event_time))
            manager.normalize()
            event1 = manager.save(self.project1.id)

            manager = EventManager(
                make_event(**nplus_one_no_timestamp, timestamp=latest_event_time)
            )
            manager.normalize()
            event2 = manager.save(self.project2.id)

            # issue error
            manager = EventManager(make_event(timestamp=latest_event_time))
            manager.normalize()
            manager.save(self.project1.id)

        resp = self.client.get(self.path, follow=True)
        assert resp.redirect_chain == [
            (f"/organizations/{self.org.slug}/issues/{event1.groups[0].id}/", 302)
        ]

        self.login_as(self.owner)
        resp = self.client.get(self.path, follow=True)
        assert resp.redirect_chain == [
            (f"/organizations/{self.org.slug}/issues/{event2.groups[0].id}/", 302)
        ]

    def test_no_performance_issue(self):
        resp = self.client.get(self.path, follow=True)
        assert resp.redirect_chain == [(f"/organizations/{self.org.slug}/issues/", 302)]
