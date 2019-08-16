from __future__ import absolute_import

from django.utils import timezone

from sentry.testutils import AcceptanceTestCase


class OrganizationReleasesTest(AcceptanceTestCase):
    def setUp(self):
        super(OrganizationReleasesTest, self).setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.login_as(self.user)
        self.path = u"/organizations/{}/releases/".format(self.org.slug)

    def test_with_releases(self):
        release = self.create_release(project=self.project, version="1.0")
        self.create_group(first_release=release, project=self.project, message="Foo bar")
        self.project.update(first_event=timezone.now())
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading")
        self.browser.snapshot("organization releases with releases")

    def test_with_no_releases(self):
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading")
        self.browser.snapshot("organization releases without releases")
