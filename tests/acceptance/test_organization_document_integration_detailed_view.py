from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class OrganizationDocumentIntegrationDetailView(AcceptanceTestCase):
    """
    As a developer, I can view an document-based integration, and learn more about it with the linked resources.
    """

    def setUp(self):
        super(OrganizationDocumentIntegrationDetailView, self).setUp()
        self.login_as(self.user)

    def load_page(self, slug):
        url = u"/settings/{}/document-integrations/{}/".format(self.organization.slug, slug)
        self.browser.get(url)
        self.browser.wait_until_not(".loading-indicator")

    def test_view_datadog(self):
        self.load_page("datadog")
        self.browser.snapshot("integrations - document-based detail overview")

        assert self.browser.element_exists('[data-test-id="learn-more"]')
