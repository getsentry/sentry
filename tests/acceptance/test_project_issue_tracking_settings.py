from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class ProjectAlertSettingsTest(AcceptanceTestCase):
    def setUp(self):
        super(ProjectAlertSettingsTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            name='Rowdy Tiger',
            owner=None,
        )
        self.team = self.create_team(organization=self.org, name='Mariachi Band')
        self.project = self.create_project(
            organization=self.org,
            teams=[self.team],
            name='Bengal',
        )
        self.create_member(
            user=self.user,
            organization=self.org,
            role='owner',
            teams=[self.team],
        )

        self.login_as(self.user)
        self.path = '/{}/{}/settings/issue-tracking/'.format(self.org.slug, self.project.slug)

    def test_simple(self):
        self.browser.get(self.path)
        self.browser.wait_until_not('.loading-indicator')
        self.browser.snapshot('project issue tracking settings')
        self.browser.wait_until('.ref-issue-tracking-settings')
