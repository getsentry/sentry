from __future__ import absolute_import

import six

from collections import Iterable

from sentry.mediators import Mediator, Param
from sentry.models import (ApiApplication, SentryApp, User)


class Creator(Mediator):
    name = Param(six.string_types)
    organization = Param('sentry.models.Organization')
    scopes = Param(Iterable)
    events = Param(Iterable, default=lambda self: [])
    webhook_url = Param(six.string_types)
    redirect_url = Param(six.string_types, required=False)
    is_alertable = Param(bool, default=False)
    overview = Param(six.string_types, required=False)

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
            owner_id=self.proxy.id,
        )

    def _create_sentry_app(self):
        from sentry.mediators.service_hooks.creator import expand_events

        return SentryApp.objects.create(
            name=self.name,
            application_id=self.api_app.id,
            owner_id=self.organization.id,
            proxy_user_id=self.proxy.id,
            scope_list=self.scopes,
            events=expand_events(self.events),
            webhook_url=self.webhook_url,
            redirect_url=self.redirect_url,
            is_alertable=self.is_alertable,
            overview=self.overview,
        )
