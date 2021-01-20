from sentry.testutils import AcceptanceTestCase


class OrganizationIntegrationDirectoryTest(AcceptanceTestCase):
    def setUp(self):
        super(OrganizationIntegrationDirectoryTest, self).setUp()
        self.login_as(self.user)

    def test_all_integrations_list(self):
        path = "/settings/{}/integrations/".format(self.organization.slug)
        self.browser.get(path)
        self.browser.wait_until_not(".loading-indicator")
        self.browser.snapshot("integrations - integration directory")
