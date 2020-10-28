from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class ProjectAllIntegrationsSettingsTest(AcceptanceTestCase):
    def setUp(self):
        super(ProjectAllIntegrationsSettingsTest, self).setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])

        self.login_as(self.user)

    def test_all_integrations_list(self):
        path = u"/{}/{}/settings/plugins/".format(self.org.slug, self.project.slug)
        self.browser.get(path)
        self.browser.wait_until_not(".loading-indicator")
        self.browser.snapshot("project settings - all integrations")
