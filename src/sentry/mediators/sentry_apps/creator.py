from __future__ import absolute_import

import six

from collections import Iterable

from sentry.utils.audit import create_audit_entry
from sentry.mediators import Mediator, Param
from sentry.models import (AuditLogEntryEvent, ApiApplication, SentryApp, SentryAppComponent, User,)


class Creator(Mediator):
    name = Param(six.string_types)
    organization = Param('sentry.models.Organization')
    scopes = Param(Iterable)
    events = Param(Iterable, default=lambda self: [])
    webhook_url = Param(six.string_types)
    redirect_url = Param(six.string_types, required=False)
    is_alertable = Param(bool, default=False)
    schema = Param(dict, default=lambda self: {})
    overview = Param(six.string_types, required=False)
    request = Param('rest_framework.request.Request', required=False)

    def call(self):
        self.proxy = self._create_proxy_user()
        self.api_app = self._create_api_application()
        self.app = self._create_sentry_app()
        self._create_ui_components()
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
            schema=self.schema or {},
            webhook_url=self.webhook_url,
            redirect_url=self.redirect_url,
            is_alertable=self.is_alertable,
            overview=self.overview,
        )

    def _create_ui_components(self):
        schema = self.schema or {}

        for element in schema.get('elements', []):
            SentryAppComponent.objects.create(
                type=element['type'],
                sentry_app_id=self.app.id,
                schema=element,
            )

    def audit(self):
        if self.request:
            create_audit_entry(
                request=self.request,
                organization=self.organization,
                target_object=self.organization.id,
                event=AuditLogEntryEvent.SENTRY_APP_ADD,
                data={
                    'sentry_app': self.app.name,
                },
            )
