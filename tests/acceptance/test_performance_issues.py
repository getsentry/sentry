import random
import string
from unittest.mock import patch

import pytz

from fixtures.page_objects.issue_details import IssueDetailsPage
from sentry import options
from sentry.models import Group
from sentry.testutils import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils import json

FEATURES = {
    "projects:performance-suspect-spans-ingestion": True,
    "organizations:performance-n-plus-one-api-calls-detector": True,
}


class PerformanceIssuesTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.login_as(self.user)

        options.set("performance.issues.all.problem-detection", 1.0)
        options.set("performance.issues.n_plus_one_db.problem-creation", 1.0)
        options.set("performance.issues.n_plus_one_api_calls.problem-creation", 1.0)

        self.page = IssueDetailsPage(self.browser, self.client)
        self.dismiss_assistant()

    def create_sample_event(self, fixture, start_timestamp):
        event = json.loads(self.load_fixture(f"events/performance_problems/{fixture}.json"))

        for key in ["datetime", "location", "title"]:
            del event[key]

        event["contexts"] = {
            "trace": {"trace_id": "530c14e044aa464db6ddb43660e6474f", "span_id": "139fcdb7c5534eb4"}
        }

        ms_delta = start_timestamp - event["start_timestamp"]

        for item in [event, *event["spans"]]:
            item["start_timestamp"] += ms_delta
            item["timestamp"] += ms_delta

        return event

    def randomize_span_description(self, span):
        return {
            **span,
            "description": "".join(random.choice(string.ascii_lowercase) for _ in range(10)),
        }

    @patch("django.utils.timezone.now")
    def test_with_one_performance_issue(self, mock_now):
        mock_now.return_value = before_now(minutes=5).replace(tzinfo=pytz.utc)
        event_data = self.create_sample_event(
            "n-plus-one-in-django-new-view", mock_now.return_value.timestamp()
        )

        with self.feature(FEATURES):
            event = self.store_event(data=event_data, project_id=self.project.id)

            self.page.visit_issue(self.org.slug, event.groups[0].id)
            self.browser.snapshot("performance issue details", desktop_only=True)

    @patch("django.utils.timezone.now")
    def test_multiple_events_with_one_cause_are_grouped(self, mock_now):
        mock_now.return_value = before_now(minutes=5).replace(tzinfo=pytz.utc)
        event_data = self.create_sample_event(
            "n-plus-one-in-django-new-view", mock_now.return_value.timestamp()
        )

        with self.feature(FEATURES):
            [self.store_event(data=event_data, project_id=self.project.id) for _ in range(3)]

            assert Group.objects.count() == 1

    @patch("django.utils.timezone.now")
    def test_n_one_api_call_performance_issue(self, mock_now):
        mock_now.return_value = before_now(minutes=5).replace(tzinfo=pytz.utc)
        event_data = self.create_sample_event(
            "n-plus-one-api-calls/n-plus-one-api-calls-in-issue-stream",
            mock_now.return_value.timestamp(),
        )

        event_data["contexts"]["trace"]["op"] = "navigation"

        with self.feature(FEATURES):
            event = self.store_event(data=event_data, project_id=self.project.id)

            self.page.visit_issue(self.org.slug, event.groups[0].id)
            self.browser.snapshot("N+1 API Call issue details", desktop_only=True)

    @patch("django.utils.timezone.now")
    def test_multiple_events_with_multiple_causes_are_not_grouped(self, mock_now):
        mock_now.return_value = before_now(minutes=5).replace(tzinfo=pytz.utc)

        # Create identical events with different parent spans
        for _ in range(3):
            event_data = self.create_sample_event(
                "n-plus-one-in-django-new-view", mock_now.return_value.timestamp()
            )
            event_data["spans"] = [
                self.randomize_span_description(span) if span["op"] == "django.view" else span
                for span in event_data["spans"]
            ]

            with self.feature(FEATURES):
                self.store_event(data=event_data, project_id=self.project.id)

        assert Group.objects.count() == 3
