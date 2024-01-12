import logging
import uuid
from functools import cached_property
from time import time
from unittest import mock

from django.urls import reverse

from sentry.event_manager import EventManager
from sentry.testutils.cases import PerformanceIssueTestCase, TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.performance_issues.event_generators import get_event
from sentry.testutils.silo import region_silo_test


def make_event(**kwargs):
    result = {
        "event_id": uuid.uuid1().hex,
        "level": logging.ERROR,
        "logger": "default",
        "tags": [],
    }
    result.update(kwargs)
    return result


nplus_one_no_timestamp = {**get_event("n-plus-one-in-django-index-view")}
del nplus_one_no_timestamp["timestamp"]


@region_silo_test
class NewestIssueViewTest(TestCase, PerformanceIssueTestCase):
    @cached_property
    def path(self):
        return reverse("sentry-organization-newest-issue", args=[self.org.slug, "performance"])

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

    def test_simple(self):
        with mock.patch("sentry_sdk.tracing.Span.containing_transaction"):
            latest_event_time = time()
            older_event_time = latest_event_time - 300

            event1 = self.create_performance_issue(
                event_data=make_event(**nplus_one_no_timestamp, timestamp=older_event_time),
                project_id=self.project1.id,
            )
            event2 = self.create_performance_issue(
                event_data=make_event(**nplus_one_no_timestamp, timestamp=latest_event_time),
                project_id=self.project2.id,
            )

            # issue error
            manager = EventManager(make_event(timestamp=latest_event_time))
            manager.normalize()
            manager.save(self.project1.id)

        resp = self.client.get(self.path, follow=True)
        assert resp.redirect_chain == [
            (f"http://testserver/organizations/{self.org.slug}/issues/{event1.group.id}/", 302)
        ]

        self.login_as(self.owner)
        resp = self.client.get(self.path, follow=True)
        assert resp.redirect_chain == [
            (f"http://testserver/organizations/{self.org.slug}/issues/{event2.group.id}/", 302)
        ]

    @override_options({"store.use-ingest-performance-detection-only": 1.0})
    @override_options({"performance.issues.all.problem-detection": 1.0})
    @override_options({"performance.issues.n_plus_one_db.problem-creation": 1.0})
    @with_feature("organizations:customer-domains")
    def test_simple_customer_domains(self):
        with mock.patch("sentry_sdk.tracing.Span.containing_transaction"):
            latest_event_time = time()
            older_event_time = latest_event_time - 300

            event1 = self.create_performance_issue(
                event_data=make_event(**nplus_one_no_timestamp, timestamp=older_event_time),
                project_id=self.project1.id,
            )
            event2 = self.create_performance_issue(
                event_data=make_event(**nplus_one_no_timestamp, timestamp=latest_event_time),
                project_id=self.project2.id,
            )

            # issue error
            manager = EventManager(make_event(timestamp=latest_event_time))
            manager.normalize()
            manager.save(self.project1.id)

        domain = f"{self.org.slug}.testserver"
        resp = self.client.get("/newest-performance-issue/", follow=True, SERVER_NAME=domain)
        assert resp.redirect_chain == [(f"http://{domain}/issues/{event1.group.id}/", 302)]

        self.login_as(self.owner)
        resp = self.client.get("/newest-performance-issue/", follow=True, SERVER_NAME=domain)
        assert resp.redirect_chain == [(f"http://{domain}/issues/{event2.group.id}/", 302)]

    def test_no_performance_issue(self):
        resp = self.client.get(self.path, follow=True)
        assert resp.redirect_chain == [
            (f"http://testserver/organizations/{self.org.slug}/issues/", 302)
        ]
