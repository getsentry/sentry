from __future__ import absolute_import

import six

from collections import Iterable

from sentry.constants import SentryAppStatus
from sentry.mediators import Mediator, Param
from sentry.models import (
    AuditLogEntryEvent,
    ApiToken,
)
from .creator import Creator as SentryAppCreator
from ..sentry_app_installations import Creator as InstallationCreator


class InternalCreator(Mediator):
    name = Param(six.string_types)
    author = Param(six.string_types)
    organization = Param('sentry.models.Organization')
    scopes = Param(Iterable, default=lambda self: [])
    events = Param(Iterable, default=lambda self: [])
    webhook_url = Param(six.string_types)
    redirect_url = Param(six.string_types, required=False)
    is_alertable = Param(bool, default=False)
    verify_install = Param(bool, default=False)
    schema = Param(dict, default=lambda self: {})
    overview = Param(six.string_types, required=False)
    request = Param('rest_framework.request.Request', required=False)
    user = Param('sentry.models.User')

    def call(self):
        self.sentry_app = SentryAppCreator.run(**self.kwargs)
        self.sentry_app.status = SentryAppStatus.INTERNAL
        self.sentry_app.save()

        self._create_access_token()
        self._install()

        return self.sentry_app

    def _create_access_token(self):
        self.api_token = ApiToken.objects.create(
            user=self.sentry_app.proxy_user,
            application_id=self.sentry_app.application.id,
            scope_list=self.sentry_app.scope_list,
            expires_at=None,
        )

    def _install(self):
        install = InstallationCreator.run(
            organization=self.organization,
            slug=self.sentry_app.slug,
            user=self.user,
            request=self.request,
            notify=False,
        )
        install.api_token = self.api_token
        install.save()

    def audit(self):
        from sentry.utils.audit import create_audit_entry
        if self.request:
            create_audit_entry(
                request=self.request,
                organization=self.organization,
                target_object=self.organization.id,
                event=AuditLogEntryEvent.INTERNAL_INTEGRATION_ADD,
            )

    def record_analytics(self):
        from sentry import analytics
        analytics.record(
            'internal_integration.created',
            user_id=self.user.id,
            organization_id=self.organization.id,
            sentry_app=self.sentry_app.slug,
        )
