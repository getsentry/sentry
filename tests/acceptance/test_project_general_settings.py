from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class ProjectGeneralSettingsTest(AcceptanceTestCase):
    def setUp(self):
        super(ProjectGeneralSettingsTest, self).setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])

        self.login_as(self.user)

    def test_saved_searches(self):
        path = u"/{}/{}/settings/".format(self.org.slug, self.project.slug)
        self.browser.get(path)
        self.browser.wait_until_not(".loading-indicator")
        self.browser.snapshot("project settings - general settings")

    def test_mobile_menu(self):
        """
        It is only possible to open the menu at mobile widths
        """
        path = u"/{}/{}/settings/".format(self.org.slug, self.project.slug)

        with self.browser.mobile_viewport():
            self.browser.get(path)
            self.browser.wait_until_not(".loading-indicator")

            self.browser.click('[aria-label="Open the menu"]')
            self.browser.wait_until("body.scroll-lock")
            self.browser.snapshot("project settings - mobile menu", mobile_only=True)
