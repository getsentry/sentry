import logging
from dataclasses import dataclass

from django.db import router, transaction
from django.utils.functional import cached_property

from sentry import analytics
from sentry.coreapi import APIUnauthorized
from sentry.models.apiapplication import ApiApplication
from sentry.models.apitoken import ApiToken
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.services.app import RpcSentryAppInstallation
from sentry.sentry_apps.token_exchange.util import token_expiration
from sentry.sentry_apps.token_exchange.validator import Validator
from sentry.sentry_apps.utils.errors import SentryAppIntegratorError
from sentry.users.models.user import User

logger = logging.getLogger("sentry.token-exchange")


@dataclass
class Refresher:
    """
    Exchanges a Refresh Token for a new Access Token
    """

    install: RpcSentryAppInstallation
    refresh_token: str
    client_id: str
    user: User

    def run(self) -> ApiToken:
        with transaction.atomic(router.db_for_write(ApiToken)):
            try:
                self._validate()
                self.token.delete()

                self._record_analytics()
                return self._create_new_token()
            except APIUnauthorized:
                logger.info(
                    "refresher.context",
                    extra={
                        "application_id": self.application.id,
                        "refresh_token": self.refresh_token[-4:],
                    },
                )
                raise

    def _record_analytics(self) -> None:
        analytics.record(
            "sentry_app.token_exchanged",
            sentry_app_installation_id=self.install.id,
            exchange_type="refresh",
        )

    def _validate(self) -> None:
        Validator(install=self.install, client_id=self.client_id, user=self.user).run()

        if self.token.application != self.application:
            raise SentryAppIntegratorError("Token does not belong to the application")

    def _create_new_token(self) -> ApiToken:
        token = ApiToken.objects.create(
            user=self.user,
            application=self.application,
            scope_list=self.sentry_app.scope_list,
            expires_at=token_expiration(),
        )
        try:
            SentryAppInstallation.objects.get(id=self.install.id).update(api_token=token)
        except SentryAppInstallation.DoesNotExist:
            pass
        return token

    @cached_property
    def token(self) -> ApiToken:
        try:
            return ApiToken.objects.get(refresh_token=self.refresh_token)
        except ApiToken.DoesNotExist:
            raise SentryAppIntegratorError("Token does not exist")

    @cached_property
    def application(self) -> ApiApplication:
        try:
            return ApiApplication.objects.get(client_id=self.client_id)
        except ApiApplication.DoesNotExist:
            raise SentryAppIntegratorError("Application does not exist")

    @property
    def sentry_app(self) -> SentryApp:
        try:
            return self.application.sentry_app
        except SentryApp.DoesNotExist:
            raise SentryAppIntegratorError("Sentry App does not exist")
