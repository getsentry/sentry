from sentry.models.sentryshot import SentryShot
from sentry.services.sentryshot.service import SentryShotService
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class SentryShotServiceTest(AcceptanceTestCase):
    def test_valid_path(self):
        # using auth/login because it's mostly stable and doesn't need permission
        login_url = f"{self.browser.live_server_url}/auth/login"
        self.sentryshot = SentryShot.objects.create(
            sentry_url=login_url,
            component_identifier="content",
            organization_id=self.organization.id,
        )
        service = SentryShotService(self.sentryshot.uuid)
        success = service.generate_screenshot()
        assert success

    def test_invalid_component(self):
        login_url = f"{self.browser.live_server_url}/auth/login"
        self.sentryshot = SentryShot.objects.create(
            sentry_url=login_url,
            component_identifier="some-random-component",
            organization_id=self.organization.id,
        )
        service = SentryShotService(self.sentryshot.uuid)
        success = service.generate_screenshot()
        assert success is False
