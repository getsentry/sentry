from __future__ import absolute_import

from django.utils import timezone
from sentry.utils.compat.mock import Mock, patch

from sentry.testutils import AcceptanceTestCase


class OrganizationRateLimitsTest(AcceptanceTestCase):
    def setUp(self):
        super(OrganizationRateLimitsTest, self).setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])
        self.login_as(self.user)
        self.path = u"/organizations/{}/rate-limits/".format(self.org.slug)

    @patch("sentry.app.quotas.get_maximum_quota", Mock(return_value=(100, 60)))
    def test_with_rate_limits(self):
        self.project.update(first_event=timezone.now())
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading-indicator")
        self.browser.wait_until_test_id("rate-limit-editor")
        self.browser.snapshot("organization rate limits with quota")
        assert self.browser.element_exists_by_test_id("rate-limit-editor")

    @patch("sentry.app.quotas.get_maximum_quota", Mock(return_value=(0, 60)))
    def test_without_rate_limits(self):
        self.project.update(first_event=timezone.now())
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading-indicator")
        self.browser.wait_until_test_id("rate-limit-editor")
        self.browser.snapshot("organization rate limits without quota")
        assert self.browser.element_exists_by_test_id("rate-limit-editor")
