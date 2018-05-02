from __future__ import absolute_import

from django.utils import timezone

from sentry.testutils import AcceptanceTestCase


class ProjectOverviewTest(AcceptanceTestCase):
    def setUp(self):
        super(ProjectOverviewTest, self).setUp()
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
        self.path = '/{}/{}/dashboard/'.format(
            self.org.slug, self.project.slug)

    def test_with_issues(self):
        self.project.update(first_event=timezone.now())
        self.create_group(
            project=self.project,
            message='Foo bar',
        )
        self.browser.get(self.path)
        self.browser.wait_until('.chart-wrapper')
        self.browser.wait_until_not('.loading')
        self.browser.snapshot('project dashboard with issues')

    def test_with_no_issues(self):
        self.project.update(first_event=timezone.now())
        self.browser.get(self.path)
        self.browser.wait_until_not('.loading')
        self.browser.wait_until('.group-list-empty')
        self.browser.wait_until_not('.loading')
        self.browser.snapshot('project dashboard without issues')
