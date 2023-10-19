from sentry.testutils.cases import AcceptanceTestCase


class ApiApplicationTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization(name="Rowdy Tiger Rowdy Tiger Rowdy Tiger", owner=None)
        self.project = self.create_project(
            organization=self.org, teams=[self.team], name="Bengal Bengal Bengal Bengal"
        )
        self.login_as(self.user)
        self.path = "/api/applications/"

    def test_simple(self):
        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

        self.browser.click_when_visible('[aria-label="Create New Application"]')
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

        self.browser.click('[href="/settings/account/api/applications/"]')
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.click_when_visible('[data-test-id="toast-success"]')
        self.browser.wait_until_not('[data-test-id="toast-success"]')

        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.click_when_visible('[aria-label="Remove"]')
        self.browser.wait_until_not('[data-test-id="toast-loading"]')
        self.browser.wait_until_test_id("empty-message")
