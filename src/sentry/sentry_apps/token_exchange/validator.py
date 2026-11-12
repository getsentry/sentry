from dataclasses import dataclass

from django.utils.functional import cached_property

from sentry.constants import SentryAppInstallationStatus, SentryAppStatus
from sentry.models.apiapplication import ApiApplication
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.token_exchange.util import SENSITIVE_CHARACTER_LIMIT
from sentry.sentry_apps.utils.errors import SentryAppIntegratorError, SentryAppSentryError
from sentry.users.models.user import User


@dataclass
class Validator:
    """
    Validates general authorization params for all types of token exchanges.
    """

    install: SentryAppInstallation
    client_id: str
    user: User

    def run(self) -> bool:
        self._validate_is_sentry_app_making_request()
        self._validate_app_is_owned_by_user()
        self._validate_application_is_active()
        self._validate_sentry_app()
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
                webhook_context={
                    "user": self.user.name,
                    "integration": self.sentry_app.slug,
                    "installation_uuid": self.install.uuid,
                },
            )

    def _validate_application_is_active(self) -> None:
        if not self.application.is_active:
            raise SentryAppIntegratorError(
                "Application is not active",
                status_code=401,
                webhook_context={
                    "application_id": self.application.id,
                    "client_id": self.client_id[:SENSITIVE_CHARACTER_LIMIT],
                },
            )

    def _validate_sentry_app(self) -> None:
        if self.sentry_app.status == SentryAppStatus.DELETION_IN_PROGRESS:
            raise SentryAppIntegratorError(
                "Integration is being deleted",
                status_code=401,
                webhook_context={"sentry_app_id": self.sentry_app.id},
            )

    def _validate_installation(self) -> None:
        # The caller may have loaded the installation before deletion started.
        try:
            installation = SentryAppInstallation.objects.get(
                id=self.install.id, date_deleted__isnull=True
            )
        except SentryAppInstallation.DoesNotExist:
            raise SentryAppIntegratorError(
                "Installation not found",
                status_code=401,
                webhook_context={"installation_uuid": self.install.uuid},
            )

        if installation.sentry_app_id != self.sentry_app.id:
            raise SentryAppIntegratorError(
                f"Given installation is not for integration: {self.sentry_app.slug}",
                webhook_context={"installation_uuid": self.install.uuid},
            )

        if installation.status == SentryAppInstallationStatus.PENDING_DELETION:
            raise SentryAppIntegratorError(
                "Installation is being deleted",
                status_code=401,
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
                webhook_context={"client_id": self.client_id[:SENSITIVE_CHARACTER_LIMIT]},
            )
