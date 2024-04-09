import pytest

from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class SidebarTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.login_as(self.user)
        self.create_organization(name="Foo Foo Foo Foo Foo Foo Foo", owner=self.user)
        self.create_organization(name="Bar Bar Bar Bar Bar Bar Bar", owner=self.user)
        self.path = "/"

    @pytest.mark.skip("Tests are flaking cause of org name being inconsistent")
    def test_new_sidebar(self):
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading")
        self.browser.click('[data-test-id="sidebar-dropdown"]')
        self.browser.move_to('[data-test-id="sidebar-switch-org"]')
        self.browser.wait_until_test_id("sidebar-switch-org-menu")
        self.browser.click('[data-test-id="sidebar-collapse"]')
        self.browser.click('[data-test-id="sidebar-broadcasts"]')
        self.browser.wait_until_test_id("sidebar-broadcasts-panel")
        self.browser.click("footer")
        self.browser.wait_until_not('[data-test-id="sidebar-broadcasts-panel"]')

    def test_help_search(self):
        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

        self.browser.wait_until_test_id("help-sidebar")
        self.browser.click('[data-test-id="help-sidebar"]')
        self.browser.wait_until_test_id("search-docs-and-faqs")
        self.browser.click('[data-test-id="search-docs-and-faqs"]')
        self.browser.wait_until(
            'input[placeholder="Search for documentation, FAQs, blog posts..."]'
        )
