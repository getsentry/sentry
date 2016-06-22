from __future__ import absolute_import

from django.utils import timezone

from sentry.testutils import AcceptanceTestCase


class ProjectIssuesTest(AcceptanceTestCase):
    def setUp(self):
        super(ProjectIssuesTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            owner=self.user,
            name='Rowdy Tiger'
        )
        self.team = self.create_team(
            organization=self.org,
            name='Mariachi Band'
        )
        self.project = self.create_project(
            organization=self.org,
            team=self.team,
            name='Bengal',
        )
        self.login_as(self.user)
        self.path = self.route(
            '/{}/{}/', self.org.slug, self.project.slug
        )

    # TODO(dcramer): abstract fixtures into a basic set that is present for
    # all acceptance tests
    def test_not_setup(self):
        # TODO(dcramer): we should add basic assertions around "i wanted this
        # URL but was sent somewhere else"
        self.browser.get(self.path)
        self.wait_until('.awaiting-events')
        self.snapshot('project issues not configured')

    def test_with_issues(self):
        self.project.update(first_event=timezone.now())
        self.create_group(
            project=self.project,
            message='Foo bar',
        )
        self.browser.get(self.path)
        self.wait_until('.group-list')
        self.snapshot('project issues with issues')

    def test_with_no_issues(self):
        self.project.update(first_event=timezone.now())
        self.browser.get(self.path)
        self.wait_until('.empty-stream')
        self.snapshot('project issues without issues')
