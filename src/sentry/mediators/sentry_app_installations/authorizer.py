from __future__ import absolute_import

import six

from datetime import datetime, timedelta
from django.utils.crypto import constant_time_compare

from sentry.coreapi import APIUnauthorized
from sentry.mediators import Mediator, Param
from sentry.models import ApiGrant, ApiApplication, ApiToken, SentryApp
from sentry.utils.cache import memoize


TOKEN_LIFE_IN_HOURS = 8


class Authorizer(Mediator):
    install = Param('sentry.models.SentryAppInstallation')
    grant_type = Param(six.string_types)
    code = Param(six.string_types)
    client_id = Param(six.string_types)
    user = Param('sentry.models.User')

    def call(self):
        self._validate_grant_type()
        self._validate_install()
        self._validate_sentry_app()
        self._validate_grant()
        return self.exchange()

    def exchange(self):
        return ApiToken.objects.create(
            user=self.user,
            application=self.application,
            scope_list=self.sentry_app.scope_list,
            expires_at=(datetime.now() + timedelta(hours=TOKEN_LIFE_IN_HOURS)),
        )

    def _validate_grant_type(self):
        if not self.grant_type == 'authorization_code':
            raise APIUnauthorized

    def _validate_install(self):
        if not self.install.sentry_app.proxy_user == self.user:
            raise APIUnauthorized

    def _validate_sentry_app(self):
        if not self.user.is_sentry_app:
            raise APIUnauthorized

    def _validate_grant(self):
        if (
            not self.grant_belongs_to_install() or
            not self.application_owned_by_user() or
            not self.client_id_matches()
        ):
            raise APIUnauthorized

        if self.grant.is_expired():
            raise APIUnauthorized

    def grant_belongs_to_install(self):
        return self.grant.sentry_app_installation == self.install

    def application_owned_by_user(self):
        return self.grant.application.owner == self.user

    def client_id_matches(self):
        return constant_time_compare(
            self.grant.application.client_id,
            self.client_id,
        )

    @memoize
    def sentry_app(self):
        try:
            return self.application.sentry_app
        except SentryApp.DoesNotExist:
            raise APIUnauthorized

    @memoize
    def application(self):
        try:
            return self.grant.application
        except ApiApplication.DoesNotExist:
            raise APIUnauthorized

    @memoize
    def grant(self):
        try:
            return ApiGrant.objects \
                .select_related('sentry_app_installation') \
                .select_related('application') \
                .select_related('application__sentry_app') \
                .get(code=self.code)
        except ApiGrant.DoesNotExist:
            raise APIUnauthorized
