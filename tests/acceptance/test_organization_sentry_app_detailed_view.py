from fixtures.page_objects.organization_integration_settings import (
    OrganizationSentryAppDetailViewPage,
)
from sentry.models import SentryAppInstallation
from sentry.testutils import AcceptanceTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationSentryAppDetailedView(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.create_project(organization=self.organization)
        self.sentry_app = self.create_sentry_app(
            organization=self.organization,
            published=True,
            verify_install=False,
            name="Super Awesome App",
        )
        self.login_as(self.user)

    def load_page(self, slug):
        url = f"/settings/{self.organization.slug}/sentry-apps/{slug}/"
        self.browser.get(url)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

    def test_add_sentry_app(self):
        self.load_page(self.sentry_app.slug)
        self.browser.snapshot("integrations - sentry app detail uninstalled")

        detail_view_page = OrganizationSentryAppDetailViewPage(browser=self.browser)
        detail_view_page.click_install_button()

        self.browser.wait_until('[data-test-id="toast-success"]')
        assert SentryAppInstallation.objects.filter(
            organization=self.organization, sentry_app=self.sentry_app
        )

    def test_uninstallation(self):
        self.installation = self.create_sentry_app_installation(
            slug=self.sentry_app.slug,
            organization=self.organization,
            user=self.user,
            prevent_token_exchange=True,
        )

        self.load_page(self.sentry_app.slug)
        self.browser.snapshot("integrations - sentry app detail installed")

        detail_view_page = OrganizationSentryAppDetailViewPage(browser=self.browser)

        detail_view_page.uninstall()
        self.browser.wait_until('[data-test-id="toast-success"]')
        assert not SentryAppInstallation.objects.filter(
            organization=self.organization, sentry_app=self.sentry_app
        )
