from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class ProjectReleasesTest(AcceptanceTestCase):
    def setUp(self):
        super(ProjectReleasesTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            owner=self.user, name='Rowdy Tiger')
        self.team = self.create_team(
            organization=self.org, name='Mariachi Band')
        self.project = self.create_project(
            organization=self.org,
            teams=[self.team],
            name='Bengal',
        )
        self.login_as(self.user)
        self.path = '/{}/{}/releases/'.format(
            self.org.slug, self.project.slug)

    def test_with_releases(self):
        release = self.create_release(
            project=self.project,
            version='1.0',
        )
        self.create_group(
            first_release=release,
            project=self.project,
            message='Foo bar',
        )
        self.browser.get(self.path)
        self.browser.wait_until_not('.loading')
        self.browser.wait_until('.ref-project-releases')
        self.browser.snapshot('project releases with releases')

    def test_with_no_releases(self):
        self.browser.get(self.path)
        self.browser.wait_until_not('.loading')
        self.browser.wait_until('.ref-project-releases')
        self.browser.wait_until('.ref-empty-state')
        self.browser.snapshot('project releases without releases')


class ProjectReleaseDetailsTest(AcceptanceTestCase):
    def setUp(self):
        super(ProjectReleaseDetailsTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            owner=self.user, name='Rowdy Tiger')
        self.team = self.create_team(
            organization=self.org, name='Mariachi Band')
        self.project = self.create_project(
            organization=self.org,
            teams=[self.team],
            name='Bengal',
        )
        self.release = self.create_release(
            project=self.project,
            version='1.0',
        )
        self.create_group(
            first_release=self.release,
            project=self.project,
            message='Foo bar',
        )
        self.login_as(self.user)
        self.path = '/{}/{}/releases/{}/'.format(
            self.org.slug, self.project.slug, self.release.version)

    def test_release_details_no_commits_no_deploys(self):
        self.browser.get(self.path)
        self.browser.wait_until_not('.loading')
        self.browser.wait_until('.ref-release-details')
        self.browser.snapshot('project release details no commits no deploys')
