from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test

OPTION = {"sentry-apps.disabled-enforcement": True}


def disable_app(app: SentryApp) -> None:
    with assume_test_silo_mode(SiloMode.CONTROL):
        app.update(is_disabled=True)


@control_silo_test
class DisabledSentryAppDetailsTest(APITestCase):
    endpoint = "sentry-api-0-sentry-app-details"

    def setUp(self) -> None:
        self.superuser = self.create_user(is_superuser=True)
        self.app = self.create_sentry_app(name="Test", organization=self.organization)
        self.login_as(self.user)

    @override_options(OPTION)
    def test_get_disabled_app_returns_403(self) -> None:
        disable_app(self.app)
        self.get_error_response(self.app.slug, status_code=403)

    @override_options(OPTION)
    def test_get_non_disabled_app_returns_200(self) -> None:
        self.get_success_response(self.app.slug, status_code=200)

    @override_options(OPTION)
    def test_delete_disabled_app_allowed(self) -> None:
        disable_app(self.app)
        self.get_success_response(self.app.slug, method="delete", status_code=204)

    @override_options(OPTION)
    def test_put_disabled_app_allowed(self) -> None:
        disable_app(self.app)
        self.get_success_response(self.app.slug, method="put", status_code=200, name="Test")

    def test_disabled_app_without_option_returns_200(self) -> None:
        disable_app(self.app)
        self.get_success_response(self.app.slug, status_code=200)


@control_silo_test
class DisabledSentryAppInstallationTest(APITestCase):
    endpoint = "sentry-api-0-sentry-app-installation-details"

    def setUp(self) -> None:
        self.app = self.create_sentry_app(name="Test", organization=self.organization)
        self.install = self.create_sentry_app_installation(
            slug=self.app.slug, organization=self.organization, user=self.user
        )
        self.login_as(self.user)

    @override_options(OPTION)
    def test_get_installation_of_disabled_app_returns_403(self) -> None:
        disable_app(self.app)
        self.get_error_response(self.install.uuid, status_code=403)

    @override_options(OPTION)
    def test_delete_installation_of_disabled_app_allowed(self) -> None:
        disable_app(self.app)
        self.get_success_response(self.install.uuid, method="delete", status_code=204)

    @override_options(OPTION)
    def test_get_installation_of_non_disabled_app_returns_200(self) -> None:
        self.get_success_response(self.install.uuid, status_code=200)
