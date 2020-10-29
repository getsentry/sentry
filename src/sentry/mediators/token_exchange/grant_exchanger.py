from __future__ import absolute_import

import six
import pytz

from datetime import datetime

from sentry import analytics
from sentry.coreapi import APIUnauthorized
from sentry.mediators import Mediator, Param
from sentry.mediators.token_exchange.validator import Validator
from sentry.mediators.token_exchange.util import token_expiration
from sentry.models import ApiApplication, ApiToken, ApiGrant, SentryApp
from sentry.utils.cache import memoize


class GrantExchanger(Mediator):
    """
    Exchanges a Grant Code for an Access Token
    """

    install = Param("sentry.models.SentryAppInstallation")
    code = Param(six.string_types)
    client_id = Param(six.string_types)
    user = Param("sentry.models.User")

    def call(self):
        self._validate()
        self._create_token()

        # Once it's exchanged it's no longer valid and should not be
        # exchangeable, so we delete it.
        self._delete_grant()

        return self.token

    def record_analytics(self):
        analytics.record(
            "sentry_app.token_exchanged",
            sentry_app_installation_id=self.install.id,
            exchange_type="authorization",
        )

    def _validate(self):
        Validator.run(install=self.install, client_id=self.client_id, user=self.user)

        if not self._grant_belongs_to_install() or not self._sentry_app_user_owns_grant():
            raise APIUnauthorized

        if not self._grant_is_active():
            raise APIUnauthorized("Grant has already expired.")

    def _grant_belongs_to_install(self):
        return self.grant.sentry_app_installation == self.install

    def _sentry_app_user_owns_grant(self):
        return self.grant.application.owner == self.user

    def _grant_is_active(self):
        return self.grant.expires_at > datetime.now(pytz.UTC)

    def _delete_grant(self):
        self.grant.delete()

    def _create_token(self):
        self.token = ApiToken.objects.create(
            user=self.user,
            application=self.application,
            scope_list=self.sentry_app.scope_list,
            expires_at=token_expiration(),
        )
        self.install.api_token = self.token
        self.install.save()

    @memoize
    def grant(self):
        try:
            return (
                ApiGrant.objects.select_related("sentry_app_installation")
                .select_related("application")
                .select_related("application__sentry_app")
                .get(code=self.code)
            )
        except ApiGrant.DoesNotExist:
            raise APIUnauthorized

    @property
    def application(self):
        try:
            return self.grant.application
        except ApiApplication.DoesNotExist:
            raise APIUnauthorized

    @property
    def sentry_app(self):
        try:
            return self.application.sentry_app
        except SentryApp.DoesNotExist:
            raise APIUnauthorized
