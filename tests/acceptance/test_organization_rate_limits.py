from unittest.mock import Mock, patch

from django.utils import timezone

from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class OrganizationRateLimitsTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])
        self.login_as(self.user)
        self.path = f"/organizations/{self.org.slug}/rate-limits/"

    @patch("sentry.quotas.get_maximum_quota", Mock(return_value=(100, 60)))
    def test_with_rate_limits(self):
        self.project.update(first_event=timezone.now())
        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.wait_until_test_id("rate-limit-editor")
        assert self.browser.element_exists_by_test_id("rate-limit-editor")

    @patch("sentry.quotas.get_maximum_quota", Mock(return_value=(0, 60)))
    def test_without_rate_limits(self):
        self.project.update(first_event=timezone.now())
        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.wait_until_test_id("rate-limit-editor")
        assert self.browser.element_exists_by_test_id("rate-limit-editor")
