from sentry.coreapi import APIUnauthorized
from sentry.mediators import Mediator, Param
from sentry.models import ApiApplication, SentryApp
from sentry.utils.cache import memoize


class Validator(Mediator):
    """
    Validates general authorization params for all types of token exchanges.
    """

    install = Param("sentry.models.SentryAppInstallation")
    client_id = Param((str,))
    user = Param("sentry.models.User")

    def call(self):
        self._validate_is_sentry_app_making_request()
        self._validate_app_is_owned_by_user()
        self._validate_installation()
        return True

    def _validate_is_sentry_app_making_request(self):
        if not self.user.is_sentry_app:
            raise APIUnauthorized

    def _validate_app_is_owned_by_user(self):
        if self.sentry_app.proxy_user != self.user:
            raise APIUnauthorized

    def _validate_installation(self):
        if self.install.sentry_app != self.sentry_app:
            raise APIUnauthorized

    @memoize
    def sentry_app(self):
        try:
            return self.application.sentry_app
        except SentryApp.DoesNotExist:
            raise APIUnauthorized

    @memoize
    def application(self):
        try:
            return ApiApplication.objects.get(client_id=self.client_id)
        except ApiApplication.DoesNotExist:
            raise APIUnauthorized
