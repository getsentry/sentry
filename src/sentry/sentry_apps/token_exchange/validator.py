from dataclasses import dataclass

from django.utils.functional import cached_property

from sentry.coreapi import APIUnauthorized
from sentry.models.apiapplication import ApiApplication
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.services.app import RpcSentryAppInstallation
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
            raise APIUnauthorized("User is not a Sentry App")

    def _validate_app_is_owned_by_user(self) -> None:
        if self.sentry_app.proxy_user != self.user:
            raise APIUnauthorized("Sentry App does not belong to given user")

    def _validate_installation(self) -> None:
        if self.install.sentry_app.id != self.sentry_app.id:
            raise APIUnauthorized(
                f"Sentry App Installation is not for Sentry App: {self.sentry_app.slug}"
            )

    @cached_property
    def sentry_app(self) -> SentryApp:
        try:
            return self.application.sentry_app
        except SentryApp.DoesNotExist:
            raise APIUnauthorized("Sentry App does not exist")

    @cached_property
    def application(self) -> ApiApplication:
        try:
            return ApiApplication.objects.get(client_id=self.client_id)
        except ApiApplication.DoesNotExist:
            raise APIUnauthorized("Application does not exist")
