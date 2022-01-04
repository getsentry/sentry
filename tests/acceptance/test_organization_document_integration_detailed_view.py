from sentry.testutils import AcceptanceTestCase


class OrganizationDocumentIntegrationDetailView(AcceptanceTestCase):
    """
    As a developer, I can view an document-based integration, and learn more about it with the linked resources.
    """

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.doc = self.create_doc_integration(features=[1, 2, 3], is_draft=False)
        self.login_as(self.user)

    def load_page(self, slug):
        with self.feature("organizations:integrations-docs-from-db"):
            url = f"/settings/{self.organization.slug}/document-integrations/{slug}/"
            self.browser.get(url)
            self.browser.wait_until_not(".loading-indicator")

    def test_view_doc(self):
        with self.feature("organizations:integrations-docs-from-db"):
            self.load_page(self.doc.slug)
            self.browser.snapshot("integrations - document-based detail overview")
            assert self.browser.element_exists('[data-test-id="learn-more"]')
