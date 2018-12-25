from __future__ import absolute_import

import six
import pytz

from datetime import datetime

from sentry.coreapi import APIUnauthorized
from sentry.mediators import Mediator, Param
from sentry.mediators.token_exchange.validator import Validator
from sentry.mediators.token_exchange.util import token_expiration
from sentry.models import ApiApplication, ApiToken, SentryApp
from sentry.utils.cache import memoize


class Refresher(Mediator):
    """
    Exchanges a Refresh Token for a new Access Token
    """

    install = Param('sentry.models.SentryAppInstallation')
    refresh_token = Param(six.string_types)
    client_id = Param(six.string_types)
    user = Param('sentry.models.User')

    def call(self):
        self._validate()
        self._expire_token()

        return ApiToken.objects.create(
            user=self.user,
            application=self.application,
            scope_list=self.sentry_app.scope_list,
            expires_at=token_expiration(),
        )

    def _validate(self):
        Validator.run(
            install=self.install,
            client_id=self.client_id,
            user=self.user,
        )

        self._validate_token_belongs_to_app()
        self._validate_token_is_active()

    def _validate_token_belongs_to_app(self):
        if self.token.application != self.application:
            raise APIUnauthorized

    def _validate_token_is_active(self):
        if self.token.expires_at < datetime.utcnow().replace(tzinfo=pytz.UTC):
            raise APIUnauthorized

    def _expire_token(self):
        self.token.update(expires_at=datetime.utcnow())

    @memoize
    def token(self):
        try:
            return ApiToken.objects.get(refresh_token=self.refresh_token)
        except ApiToken.DoesNotExist:
            raise APIUnauthorized

    @memoize
    def application(self):
        try:
            return ApiApplication.objects.get(client_id=self.client_id)
        except ApiApplication.DoesNotExist:
            raise APIUnauthorized

    @property
    def sentry_app(self):
        try:
            return self.application.sentry_app
        except SentryApp.DoesNotExist:
            raise APIUnauthorized
