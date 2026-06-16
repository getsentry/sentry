import contextlib
from collections.abc import Callable, Generator
from types import FrameType
from unittest import mock

from fixtures.page_objects.organization_integration_settings import (
    OrganizationSentryAppDetailViewPage,
)
from sentry.deletions.tasks.scheduled import run_scheduled_deletions_control
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test


@contextlib.contextmanager
def _noop_timeout_alarm(
    seconds: float, handler: Callable[[int, FrameType | None], None]
) -> Generator[None]:
    # The install/uninstall webhooks fire from the live-server request thread, where
    # SIGALRM-based timeout_alarm raises (signals only work in the main thread). We don't
    # exercise webhook delivery here, so stub it out.
    yield


@no_silo_test
class OrganizationSentryAppDetailedView(AcceptanceTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.create_project(organization=self.organization)
        self.sentry_app = self.create_sentry_app(
            organization_id=self.organization.id,
            published=True,
            verify_install=False,
            name="Super Awesome App",
        )
        self.login_as(self.user)

        patcher = mock.patch("sentry.utils.sentry_apps.webhooks.timeout_alarm", _noop_timeout_alarm)
        patcher.start()
        self.addCleanup(patcher.stop)

    def load_page(self, slug: str) -> None:
        url = f"/settings/{self.organization.slug}/sentry-apps/{slug}/"
        self.browser.get(url)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

    def test_add_sentry_app(self) -> None:
        self.load_page(self.sentry_app.slug)

        detail_view_page = OrganizationSentryAppDetailViewPage(browser=self.browser)
        detail_view_page.click_install_button()

        self.browser.wait_until('[data-test-id="toast-success"]')
        assert SentryAppInstallation.objects.filter(
            organization_id=self.organization.id, sentry_app=self.sentry_app
        )

    def test_uninstallation(self) -> None:
        self.installation = self.create_sentry_app_installation(
            slug=self.sentry_app.slug,
            organization=self.organization,
            user=self.user,
            prevent_token_exchange=True,
        )

        self.load_page(self.sentry_app.slug)

        detail_view_page = OrganizationSentryAppDetailViewPage(browser=self.browser)

        detail_view_page.uninstall()
        self.browser.wait_until('[data-test-id="toast-success"]')

        with self.tasks():
            run_scheduled_deletions_control()

        assert not SentryAppInstallation.objects.filter(
            organization_id=self.organization.id, sentry_app=self.sentry_app
        )
