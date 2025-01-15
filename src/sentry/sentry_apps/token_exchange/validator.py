from dataclasses import dataclass

from django.utils.functional import cached_property

from sentry.models.apiapplication import ApiApplication
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.services.app import RpcSentryAppInstallation
from sentry.sentry_apps.utils.errors import SentryAppIntegratorError, SentryAppSentryError
from sentry.users.models.user import User


@dataclass
class Validator:
    """
    Validates general authorization params for all types of token exchanges.
    """

    install: RpcSentryAppInstallation
    client_id: str
    user: User

    def run(self) -> bool:
        self._validate_is_sentry_app_making_request()
        self._validate_app_is_owned_by_user()
        self._validate_installation()
        return True

    def _validate_is_sentry_app_making_request(self) -> None:
        if not self.user.is_sentry_app:
            raise SentryAppIntegratorError(
                "User is not a Sentry App(custom integration)",
                webhook_context={
                    "user": self.user.name,
                },
            )

    def _validate_app_is_owned_by_user(self) -> None:
        if self.sentry_app.proxy_user != self.user:
            raise SentryAppIntegratorError(
                "Integration does not belong to given user",
                webhook_context={"user": self.user.name, "integration": self.sentry_app.slug},
            )

    def _validate_installation(self) -> None:
        if self.install.sentry_app.id != self.sentry_app.id:
            raise SentryAppIntegratorError(
                f"Given installation is not for integration: {self.sentry_app.slug}",
                webhook_context={"installation_uuid": self.install.uuid},
            )

    @cached_property
    def sentry_app(self) -> SentryApp:
        try:
            return self.application.sentry_app
        except SentryApp.DoesNotExist:
            raise SentryAppSentryError(
                "Integration does not exist",
                webhook_context={"application_id": self.application.id},
            )

    @cached_property
    def application(self) -> ApiApplication:
        try:
            return ApiApplication.objects.get(client_id=self.client_id)
        except ApiApplication.DoesNotExist:
            raise SentryAppSentryError(
                "Application does not exist",
                webhook_context={"client_id": self.client_id[:4]},
            )
