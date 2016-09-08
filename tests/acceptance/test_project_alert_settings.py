from __future__ import absolute_import

from django.utils import timezone

from sentry.testutils import AcceptanceTestCase


class ProjectAlertSettingsTest(AcceptanceTestCase):
    def setUp(self):
        super(ProjectAlertSettingsTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            name='Rowdy Tiger',
            owner=None,
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
        self.create_member(
            user=self.user,
            organization=self.org,
            role='owner',
            teams=[self.team],
        )
        self.login_as(self.user)
        self.path1 = '/{}/{}/settings/alerts/'.format(self.org.slug, self.project.slug)
        self.path2 = '/{}/{}/settings/alerts/rules/'.format(self.org.slug, self.project.slug)

    def test_settings_load(self):
        self.project.update(first_event=timezone.now())
        self.browser.get(self.path1)
        # dashboard is a bit complex to load since it has many subcomponents
        # so we bank on the core container and the activity container being
        # enough of a check
        self.browser.wait_until_not('.loading-indicator')
        self.browser.snapshot('project alert settings')

    def test_rules_load(self):
        self.project.update(first_event=timezone.now())
        self.browser.get(self.path1)
        # dashboard is a bit complex to load since it has many subcomponents
        # so we bank on the core container and the activity container being
        # enough of a check
        self.browser.wait_until('.rules-list')
        self.browser.wait_until_not('.loading-indicator')
        self.browser.snapshot('project alert rules')
