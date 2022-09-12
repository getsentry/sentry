from django.utils import timezone

from sentry.testutils import AcceptanceTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationUserFeedbackTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.login_as(self.user)
        self.path = f"/organizations/{self.org.slug}/user-feedback/"
        self.project.update(first_event=timezone.now())

    def test(self):
        self.create_userreport(date_added=timezone.now(), group=self.group, project=self.project)
        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.wait_until('[data-test-id="user-feedback-list"]')
        self.browser.snapshot("organization user feedback")

    def test_empty(self):
        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.snapshot("organization user feedback - empty")

    def test_no_access(self):
        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.snapshot("organization user feedback - no access")
