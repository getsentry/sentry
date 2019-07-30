from __future__ import absolute_import

from sentry.utils.cache import memoize
from sentry.mediators import Mediator, Param
from sentry.models import (
    AuditLogEntryEvent, SentryAppInstallationToken
)


class Destroyer(Mediator):
    sentry_app_installation = Param('sentry.models.SentryAppInstallation')
    api_token = Param('sentry.models.ApiToken')
    generate_audit = Param(bool, default=False)
    user = Param('sentry.models.User')
    request = Param('rest_framework.request.Request', required=False)

    def call(self):
        self._destroy_sentry_app_installation_token()
        self._destroy_api_token()
        return self.api_token

    def _destroy_api_token(self):
        self.api_token.delete()

    def _destroy_sentry_app_installation_token(self):
        SentryAppInstallationToken.objects.get(
            api_token=self.api_token,
            sentry_app_installation=self.sentry_app_installation,
        ).delete()

    def audit(self):
        from sentry.utils.audit import create_audit_entry
        if self.request and self.generate_audit:
            create_audit_entry(
                request=self.request,
                organization=self.organization,
                target_object=self.api_token.id,
                event=AuditLogEntryEvent.INTERNAL_INTEGRATION_REMOVE_TOKEN,
                data={'sentry_app': self.sentry_app.name},
            )

    def record_analytics(self):
        from sentry import analytics
        analytics.record(
            'sentry_app_installation_token.deleted',
            user_id=self.user.id,
            organization_id=self.organization.id,
            sentry_app_installation_id=self.sentry_app_installation.id,
            sentry_app=self.sentry_app.slug,
        )

    @memoize
    def sentry_app(self):
        return self.sentry_app_installation.sentry_app

    @memoize
    def organization(self):
        return self.sentry_app_installation.organization
