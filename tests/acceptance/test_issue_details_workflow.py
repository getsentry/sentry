from datetime import datetime, timezone
from unittest import mock

from selenium.webdriver.common.by import By

from fixtures.page_objects.issue_details import IssueDetailsPage
from sentry.models.groupinbox import GroupInboxReason, add_group_to_inbox
from sentry.services.eventstore.models import Event
from sentry.testutils.cases import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import no_silo_test
from sentry.utils.samples import load_data


@no_silo_test
class IssueDetailsWorkflowTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.login_as(self.user)
        self.page = IssueDetailsPage(self.browser, self.client)
        self.dismiss_assistant()

    def create_sample_event(
        self, platform: str, default: str | None = None, sample_name: str | None = None
    ) -> Event:
        event_data = load_data(
            platform, default=default, sample_name=sample_name, timestamp=before_now(minutes=10)
        )
        event_data["event_id"] = "d964fdbd649a4cf8bfc35d18082b6b0e"
        event = self.store_event(
            data=event_data,
            project_id=self.project.id,
            assert_no_errors=False,
        )
        event.group.update(
            first_seen=datetime(2015, 8, 13, 3, 8, 25, tzinfo=timezone.utc),
            last_seen=datetime(2016, 1, 13, 3, 8, 25, tzinfo=timezone.utc),
        )
        return event

    @mock.patch("sentry.api.helpers.group_index.update.update_group_open_period")
    def test_resolve_basic(self, mock_update_open_period: mock.MagicMock) -> None:
        event = self.create_sample_event(platform="python")
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)
        self.page.resolve_issue()
        self.wait_for_loading()

        res = self.page.api_issue_get(event.group)
        assert res.status_code == 200, res
        assert res.data["status"] == "resolved"

    def test_archive_basic(self) -> None:
        event = self.create_sample_event(platform="python")
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)
        self.page.archive_issue()
        self.wait_for_loading()

        res = self.page.api_issue_get(event.group)
        assert res.status_code == 200, res
        assert res.data["status"] == "ignored"

    def test_bookmark(self) -> None:
        event = self.create_sample_event(platform="python")
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)
        self.page.bookmark_issue()
        self.wait_for_loading()

        res = self.page.api_issue_get(event.group)
        assert res.status_code == 200, res
        assert res.data["isBookmarked"]

    def test_assign_issue(self) -> None:
        event = self.create_sample_event(platform="python")
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)
        self.page.assign_to(self.user.email)

        res = self.page.api_issue_get(event.group)
        assert res.status_code == 200, res
        assert res.data["assignedTo"]

    def test_create_comment(self) -> None:
        event = self.create_sample_event(platform="python")
        assert event.group is not None
        self.page.visit_issue_activity(self.org.slug, event.group.id)

        form = self.page.find_comment_form()
        form.find_element(by=By.TAG_NAME, value="textarea").send_keys("this looks bad")
        form.submit()

        assert self.page.has_comment("this looks bad")

    def test_mark_reviewed(self) -> None:
        event = self.create_sample_event(platform="python")
        assert event.group is not None
        add_group_to_inbox(event.group, GroupInboxReason.NEW)
        self.page.visit_issue(self.org.slug, event.group.id)
        self.page.mark_reviewed()

        res = self.page.api_issue_get(event.group)
        assert res.status_code == 200, res
        assert "inbox" not in res.data
