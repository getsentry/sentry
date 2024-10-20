from django.db import router
from django.utils.functional import cached_property

from sentry.coreapi import APIUnauthorized
from sentry.mediators.mediator import Mediator
from sentry.mediators.param import Param
from sentry.models.apiapplication import ApiApplication
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.services.app import RpcSentryAppInstallation
from sentry.users.models.user import User


class Validator(Mediator):
    """
    Validates general authorization params for all types of token exchanges.
    """

    install = Param(RpcSentryAppInstallation)
    client_id = Param(str)
    user = Param(User)
    using = router.db_for_write(User)

    def call(self):
        self._validate_is_sentry_app_making_request()
        self._validate_app_is_owned_by_user()
        self._validate_installation()
        return True

    def _validate_is_sentry_app_making_request(self):
        if not self.user.is_sentry_app:
            raise APIUnauthorized("User is not a Sentry App")

    def _validate_app_is_owned_by_user(self):
        if self.sentry_app.proxy_user != self.user:
            raise APIUnauthorized("Sentry App does not belong to given user")

    def _validate_installation(self):
        if self.install.sentry_app.id != self.sentry_app.id:
            raise APIUnauthorized(
                f"Sentry App Installation is not for Sentry App: {self.sentry_app.slug}"
            )

    @cached_property
    def sentry_app(self):
        try:
            return self.application.sentry_app
        except SentryApp.DoesNotExist:
            raise APIUnauthorized("Sentry App does not exist")

    @cached_property
    def application(self):
        try:
            return ApiApplication.objects.get(client_id=self.client_id)
        except ApiApplication.DoesNotExist:
            raise APIUnauthorized("Application does not exist")
