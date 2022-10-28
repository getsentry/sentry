import datetime
from unittest.mock import patch

import pytest
import pytz

from fixtures.page_objects.issue_details import IssueDetailsPage
from sentry import options
from sentry.testutils import AcceptanceTestCase, SnubaTestCase
from sentry.utils import json
from sentry.utils.samples import load_data


@pytest.mark.skip(reason="PERF-1785: flaky: inconsistent snapshot")
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
        options.set("performance.issues.all.problem-creation", 1.0)
        options.set("performance.issues.n_plus_one_db.problem-creation", 1.0)

        self.page = IssueDetailsPage(self.browser, self.client)
        self.dismiss_assistant()

    @patch("django.utils.timezone.now")
    def test_with_one_performance_issue(self, mock_now):
        event = load_data("transaction")

        data = json.loads(
            self.load_fixture("events/performance_problems/n-plus-one-in-django-new-view.json")
        )
        event.update({"spans": data["spans"]})

        mock_now.return_value = datetime.datetime.fromtimestamp(event["start_timestamp"]).replace(
            tzinfo=pytz.utc
        )

        with self.feature(
            [
                "projects:performance-suspect-spans-ingestion",
                "organizations:performance-issues",
                "organizations:performance-issues-ingest",
            ]
        ):
            event = self.store_event(data=event, project_id=self.project.id)
            self.page.visit_issue(self.org.slug, event.groups[0].id)
            self.browser.click('[aria-label="Show Details"]')

            self.browser.snapshot("performance issue details", desktop_only=True)
