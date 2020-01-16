from __future__ import absolute_import

from django.utils import timezone

from sentry.testutils import AcceptanceTestCase

FEATURE_NAME = "organizations:health"


class OrganizationHealthTest(AcceptanceTestCase):
    def setUp(self):
        super(OrganizationHealthTest, self).setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.login_as(self.user)
        self.path = u"/organizations/{}/health/".format(self.org.slug)
        self.project.update(first_event=timezone.now())

    def test_no_access(self):
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading-indicator")
        self.browser.snapshot("global events - no access")

    def test(self):
        with self.feature(FEATURE_NAME):
            # data is for now mocked/hardcoded in the UI
            self.browser.get(self.path)
            self.browser.wait_until_not(".loading")
            self.browser.snapshot("organization health list")
