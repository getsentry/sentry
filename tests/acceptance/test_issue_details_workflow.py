from __future__ import absolute_import

from datetime import datetime
from django.utils import timezone

from sentry.testutils import AcceptanceTestCase, SnubaTestCase
from sentry.utils.samples import load_data
from tests.acceptance.page_objects.issue_details import IssueDetailsPage


class IssueDetailsWorkflowTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super(IssueDetailsWorkflowTest, self).setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.login_as(self.user)
        self.page = IssueDetailsPage(self.browser, self.client)
        self.dismiss_assistant()

    def create_sample_event(self, platform, default=None, sample_name=None):
        event_data = load_data(platform, default=default, sample_name=sample_name)
        event_data["event_id"] = "d964fdbd649a4cf8bfc35d18082b6b0e"
        event = self.store_event(
            data=event_data, project_id=self.project.id, assert_no_errors=False
        )
        event.group.update(
            first_seen=datetime(2015, 8, 13, 3, 8, 25, tzinfo=timezone.utc),
            last_seen=datetime(2016, 1, 13, 3, 8, 25, tzinfo=timezone.utc),
        )
        return event

    def test_resolve_basic(self):
        event = self.create_sample_event(platform="python")
        self.page.visit_issue(self.org.slug, event.group.id)
        self.page.resolve_issue()

        res = self.page.api_issue_get(event.group.id)
        assert res.status_code == 200, res
        assert res.data["status"] == "resolved"

    def test_ignore_basic(self):
        event = self.create_sample_event(platform="python")
        self.page.visit_issue(self.org.slug, event.group.id)
        self.page.ignore_issue()

        res = self.page.api_issue_get(event.group.id)
        assert res.status_code == 200, res
        assert res.data["status"] == "ignored"

    def test_bookmark(self):
        event = self.create_sample_event(platform="python")
        self.page.visit_issue(self.org.slug, event.group.id)
        self.page.bookmark_issue()

        res = self.page.api_issue_get(event.group.id)
        assert res.status_code == 200, res
        assert res.data["isBookmarked"]

    def test_assign_issue(self):
        event = self.create_sample_event(platform="python")
        self.page.visit_issue(self.org.slug, event.group.id)
        self.page.assign_to(self.user.email)

        res = self.page.api_issue_get(event.group.id)
        assert res.status_code == 200, res
        assert res.data["assignedTo"]

    def test_create_comment(self):
        event = self.create_sample_event(platform="python")
        self.page.visit_issue(self.org.slug, event.group.id)
        self.page.go_to_subtab("Activity")

        form = self.page.find_comment_form()
        form.find_element_by_tag_name("textarea").send_keys("this looks bad")
        form.submit()

        assert self.page.has_comment("this looks bad")
