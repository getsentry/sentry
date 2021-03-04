from sentry.testutils import AcceptanceTestCase


class OrganizationDocumentIntegrationDetailView(AcceptanceTestCase):
    """
    As a developer, I can view an document-based integration, and learn more about it with the linked resources.
    """

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def load_page(self, slug):
        url = f"/settings/{self.organization.slug}/document-integrations/{slug}/"
        self.browser.get(url)
        self.browser.wait_until_not(".loading-indicator")

    def test_view_datadog(self):
        self.load_page("datadog")
        self.browser.snapshot("integrations - document-based detail overview")

        assert self.browser.element_exists('[data-test-id="learn-more"]')
