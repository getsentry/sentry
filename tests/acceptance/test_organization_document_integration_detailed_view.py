from sentry.testutils import AcceptanceTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationDocumentIntegrationDetailView(AcceptanceTestCase):
    """
    As a developer, I can view an document-based integration, and learn more about it with the linked resources.
    """

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user, name="Walter Mitty")
        self.doc = self.create_doc_integration(
            name="Quintessence of Life", features=[1, 2, 3], is_draft=False
        )
        self.login_as(self.user)

    def load_page(self, slug):
        url = f"/settings/{self.organization.slug}/document-integrations/{slug}/"
        self.browser.get(url)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

    def test_view_doc(self):
        self.load_page(self.doc.slug)
        self.browser.snapshot("integrations - document-based detail overview")
        assert self.browser.element_exists('[data-test-id="learn-more"]')
