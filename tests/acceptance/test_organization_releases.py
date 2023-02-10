from datetime import datetime

from django.utils import timezone

from sentry.testutils import AcceptanceTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class OrganizationReleasesTest(AcceptanceTestCase):
    release_date = datetime(2020, 5, 18, 15, 13, 58, 132928, tzinfo=timezone.utc)

    def setUp(self):
        super().setUp()
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
        self.path = f"/organizations/{self.org.slug}/releases/"
        self.project.update(first_event=timezone.now())

    def test_list(self):
        self.create_release(project=self.project, version="1.0", date_added=self.release_date)
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading")
        self.browser.snapshot("organization releases - with releases")
        # TODO(releases): add health data

    def test_detail(self):
        release = self.create_release(
            project=self.project, version="1.0", date_added=self.release_date
        )
        self.browser.get(self.path + release.version)
        self.browser.wait_until_not(".loading")
        self.browser.wait_until_test_id("release-wrapper")
        self.browser.wait_until_not('[data-test-id="loading-placeholder"]')
        self.browser.snapshot("organization releases - detail")
        # TODO(releases): add health data

    def test_detail_pick_project(self):
        release = self.create_release(
            project=self.project,
            additional_projects=[self.project2],
            version="1.0",
            date_added=self.release_date,
        )
        self.browser.get(self.path + release.version)
        self.browser.wait_until_not(".loading")
        assert "Select a project to continue" in self.browser.element("[role='dialog'] header").text

    # This is snapshotting features that are enable through the discover and performance features.
    def test_detail_with_discover_and_performance(self):
        with self.feature(["organizations:discover-basic", "organizations:performance-view"]):
            release = self.create_release(
                project=self.project, version="1.0", date_added=self.release_date
            )
            self.browser.get(self.path + release.version)
            self.browser.wait_until_not(".loading")
            self.browser.wait_until_test_id("release-wrapper")
            self.browser.wait_until_not('[data-test-id="loading-placeholder"]')
            self.browser.snapshot("organization releases - detail with discover and performance")
            # TODO(releases): add health data
