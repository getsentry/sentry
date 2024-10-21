import logging

from django.db import router
from django.utils.functional import cached_property

from sentry import analytics
from sentry.coreapi import APIUnauthorized
from sentry.mediators.mediator import Mediator
from sentry.mediators.param import Param
from sentry.mediators.token_exchange.util import token_expiration
from sentry.mediators.token_exchange.validator import Validator
from sentry.models.apiapplication import ApiApplication
from sentry.models.apitoken import ApiToken
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.services.app import RpcSentryAppInstallation
from sentry.users.models.user import User

logger = logging.getLogger("sentry.token-exchange")


class Refresher(Mediator):
    """
    Exchanges a Refresh Token for a new Access Token
    """

    install = Param(RpcSentryAppInstallation)
    refresh_token = Param(str)
    client_id = Param(str)
    user = Param(User)
    using = router.db_for_write(User)

    def call(self):
        try:
            self._validate()
            self._delete_token()
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

    def record_analytics(self):
        analytics.record(
            "sentry_app.token_exchanged",
            sentry_app_installation_id=self.install.id,
            exchange_type="refresh",
        )

    def _validate(self):
        Validator.run(install=self.install, client_id=self.client_id, user=self.user)

        self._validate_token_belongs_to_app()

    def _validate_token_belongs_to_app(self):
        if self.token.application != self.application:
            raise APIUnauthorized("Token does not belong to the application")

    def _delete_token(self):
        self.token.delete()

    def _create_new_token(self):
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
    def token(self):
        try:
            return ApiToken.objects.get(refresh_token=self.refresh_token)
        except ApiToken.DoesNotExist:
            raise APIUnauthorized("Token does not exist")

    @cached_property
    def application(self):
        try:
            return ApiApplication.objects.get(client_id=self.client_id)
        except ApiApplication.DoesNotExist:
            raise APIUnauthorized("Application does not exist")

    @property
    def sentry_app(self):
        try:
            return self.application.sentry_app
        except SentryApp.DoesNotExist:
            raise APIUnauthorized("Sentry App does not exist")
