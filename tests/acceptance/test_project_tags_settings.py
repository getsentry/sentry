from datetime import datetime, timezone
from unittest.mock import patch

from sentry.testutils.cases import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import no_silo_test

event_time = before_now(days=3)
current_time = datetime.now(timezone.utc)


@no_silo_test
class ProjectTagsSettingsTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])

        self.login_as(self.user)
        self.path = f"/settings/{self.org.slug}/projects/{self.project.slug}/tags/"

    @patch("django.utils.timezone.now", return_value=current_time)
    def test_tags_list(self, mock_timezone):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "level": "error",
                "timestamp": event_time.isoformat(),
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

        self.browser.wait_until_test_id("tag-row")
        self.browser.click('[data-test-id="tag-row"] [data-test-id="delete"]')
        self.browser.wait_until("[role='dialog'] [data-test-id='confirm-button']")

        self.browser.click("[role='dialog'] [data-test-id='confirm-button']")
        self.browser.wait_until_not('[data-test-id="tag-row"]')
