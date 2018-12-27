from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class HealthTest(AcceptanceTestCase):
    def setUp(self):
        super(HealthTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            name='Rowdy Tiger Rowdy Tiger',
            owner=None,
        )
        self.team = self.create_team(organization=self.org, name='Mariachi Band Mariachi Band')
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
        self.path = '/organizations/{}/health'.format(self.org.slug)

    def test_overview_without_feature_flag(self):
        self.browser.get('{}/'.format(self.path))
        self.browser.wait_until_not('.loading-indicator')
        self.browser.snapshot('health overview - no permissions')

    def test_overview(self):
        with self.feature('organizations:health'):
            self.browser.get('{}/'.format(self.path))
            self.browser.wait_until_not('.loading-indicator')
            self.browser.snapshot('health overview')
