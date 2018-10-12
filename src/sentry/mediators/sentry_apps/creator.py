from __future__ import absolute_import

import six

from collections import Iterable

from sentry.mediators import Mediator, Param
from sentry.models import (ApiApplication, SentryApp, User)


class Creator(Mediator):
    name = Param(six.string_types)
    user = Param('sentry.models.User')
    scopes = Param(Iterable)
    webhook_url = Param(six.string_types)

    def call(self):
        self.proxy = self._create_proxy_user()
        self.api_app = self._create_api_application()
        self.app = self._create_sentry_app()
        return self.app

    def _create_proxy_user(self):
        return User.objects.create(
            username=self.name.lower(),
            is_sentry_app=True,
        )

    def _create_api_application(self):
        return ApiApplication.objects.create(
            owner=self.proxy,
        )

    def _create_sentry_app(self):
        return SentryApp.objects.create(
            name=self.name,
            application=self.api_app,
            owner=self.user,
            proxy_user=self.proxy,
            scope_list=self.scopes,
            webhook_url=self.webhook_url,
        )
