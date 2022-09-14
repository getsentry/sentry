from sentry.testutils import AcceptanceTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationIntegrationDirectoryTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_all_integrations_list(self):
        path = f"/settings/{self.organization.slug}/integrations/"
        self.browser.get(path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.snapshot("integrations - integration directory")
