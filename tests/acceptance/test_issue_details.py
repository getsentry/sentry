from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase
from sentry.utils.samples import create_sample_event


class IssueDetailsTest(AcceptanceTestCase):
    def setUp(self):
        super(IssueDetailsTest, self).setUp()
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

    def test_python_event(self):
        event = create_sample_event(self.project, platform='python')

        self.browser.get(self.route(
            '/{}/{}/issues/{}/', self.org.slug, self.project.slug, event.group.id
        ))
        self.wait_until('.entries')
        self.snapshot('issue details python')

    def test_cocoa_event(self):
        event = create_sample_event(self.project, platform='cocoa')

        self.browser.get(self.route(
            '/{}/{}/issues/{}/', self.org.slug, self.project.slug, event.group.id
        ))
        self.wait_until('.entries')
        self.snapshot('issue details cocoa')
