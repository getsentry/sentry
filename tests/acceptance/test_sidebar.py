from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class SidebarTest(AcceptanceTestCase):
    def setUp(self):
        super(SidebarTest, self).setUp()
        self.user = self.create_user("foo@example.com")
        self.login_as(self.user)
        self.create_organization(name="Foo Foo Foo Foo Foo Foo Foo", owner=self.user)
        self.create_organization(name="Bar Bar Bar Bar Bar Bar Bar", owner=self.user)
        self.path = "/"

    def test_new_sidebar(self):
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading")
        self.browser.click('[data-test-id="sidebar-dropdown"]')
        self.browser.move_to('[data-test-id="sidebar-switch-org"]')
        self.browser.wait_until_test_id("sidebar-switch-org-menu")
        self.browser.snapshot("sidebar - switch org expanded")
        self.browser.click('[data-test-id="sidebar-collapse"]')
        self.browser.snapshot("sidebar - collapsed")
        self.browser.click('[data-test-id="sidebar-broadcasts"]')
        self.browser.wait_until_test_id("sidebar-broadcasts-panel")
        self.browser.snapshot("sidebar - broadcasts panel")
        self.browser.click("footer")
        self.browser.wait_until_not('[data-test-id="sidebar-broadcasts-panel"]')
