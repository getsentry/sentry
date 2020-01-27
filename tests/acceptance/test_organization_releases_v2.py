from __future__ import absolute_import

from django.utils import timezone

from sentry.testutils import AcceptanceTestCase

FEATURE_NAME = "organizations:releases-v2"


class OrganizationReleasesV2Test(AcceptanceTestCase):
    def setUp(self):
        super(OrganizationReleasesV2Test, self).setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.login_as(self.user)
        self.path = u"/organizations/{}/releases-v2/".format(self.org.slug)
        self.project.update(first_event=timezone.now())

    def test_no_access(self):
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading")
        self.browser.snapshot("organization releases v2 - no access")

    def test(self):
        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not(".loading")
            # TODO(releasesv2): data is for now randomly hardcoded in the UI - this snapshot will always be different, turned off until finished api
            # self.browser.snapshot("organization releases v2 list")
