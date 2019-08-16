from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase

FEATURE_NAME = "organizations:events"


class OrganizationEventsTest(AcceptanceTestCase):
    def setUp(self):
        super(OrganizationEventsTest, self).setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=None, name="Rowdy Tiger")
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])

        self.login_as(self.user)
        self.path = u"/organizations/{}/events/".format(self.org.slug)

    def test_no_access(self):
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading-indicator")
        self.browser.snapshot("global events - no access")

    def test_events_empty(self):
        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not(".loading-indicator")
            self.browser.wait_until_not('[data-test-id="events-request-loading"]')
            self.browser.snapshot("global events - empty")
