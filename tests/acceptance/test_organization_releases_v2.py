from __future__ import absolute_import

from django.utils import timezone

from sentry.testutils import AcceptanceTestCase


class OrganizationReleasesV2Test(AcceptanceTestCase):
    def setUp(self):
        super(OrganizationReleasesV2Test, self).setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.project2 = self.create_project(
            organization=self.org, teams=[self.team], name="Bengal 2"
        )
        self.create_project(organization=self.org, teams=[self.team], name="Bengal 3")
        self.login_as(self.user)
        self.path = u"/organizations/{}/releases/".format(self.org.slug)
        self.project.update(first_event=timezone.now())

    def test_list(self):
        self.create_release(project=self.project, version="1.0")
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading")
        self.browser.snapshot("organization releases v2 - with releases")
        # TODO(releasesV2): add health data

    def test_detail(self):
        release = self.create_release(project=self.project, version="1.0")
        self.browser.get(self.path + release.version)
        self.browser.wait_until_not(".loading")
        self.browser.wait_until_test_id("release-wrapper")
        self.browser.snapshot("organization releases v2 - detail")
        # TODO(releasesV2): add health data

    def test_detail_pick_project(self):
        release = self.create_release(
            project=self.project, additional_projects=[self.project2], version="1.0"
        )
        self.browser.get(self.path + release.version)
        self.browser.wait_until_not(".loading")
        assert "Select a project to continue" in self.browser.element(".modal-header").text

    # This is snapshotting feature of globalSelectionHeader project picker where we see only specified projects
    # and a custom footer message saying "Only projects with this release are visible."
    def test_detail_global_header(self):
        release = self.create_release(
            project=self.project, additional_projects=[self.project2], version="1.0"
        )
        self.browser.get(u"{}?project={}".format(self.path + release.version, self.project.id))
        self.browser.wait_until_not(".loading")
        self.browser.click('[data-test-id="global-header-project-selector"]')
        self.browser.wait_until_test_id("release-wrapper")
        self.browser.snapshot("organization releases v2 - detail - global project header")
