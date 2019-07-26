from __future__ import absolute_import

from sentry.utils.audit import create_audit_entry
from sentry import analytics
from sentry.mediators import Mediator, Param
from sentry.models import (
    AuditLogEntryEvent, ApiToken, SentryAppInstallationToken
)


class Creator(Mediator):
    sentry_app_installation = Param('sentry.models.SentryAppInstallation')
    # analytics and audit params
    user = Param('sentry.models.User')
    request = Param('rest_framework.request.Request', required=False)

    def call(self):
        self.sentry_app = self.sentry_app_installation.sentry_app
        self.organization = self.sentry_app_installation.organization
        self._create_api_token()
        self._create_sentry_app_installation_token()
        return self.sentry_app_installation_token

    def _create_api_token(self):
        self.api_token = ApiToken.objects.create(
            user=self.sentry_app.proxy_user,
            application_id=self.sentry_app.application.id,
            scope_list=self.sentry_app.scope_list,
            expires_at=None,
        )

    def _create_sentry_app_installation_token(self):
        self.sentry_app_installation_token = SentryAppInstallationToken.objects.create(
            api_token=self.api_token,
            sentry_app_installation=self.sentry_app_installation
        )

    def audit(self):
        if self.request:
            create_audit_entry(
                request=self.request,
                organization=self.organization,
                target_object=self.sentry_app_installation_token.id,
                event=AuditLogEntryEvent.SENTRY_APP_INSTALLATION_TOKEN_CREATED,
                data={
                    'sentry_app': self.sentry_app.name,
                    'sentry_app_installation_id': self.sentry_app_installation.id,
                },
            )

    def record_analytics(self):
        analytics.record(
            'sentry_app_installation_token.created',
            user_id=self.user.id,
            organization_id=self.organization.id,
            sentry_app_installation_id=self.sentry_app_installation.id,
            sentry_app=self.sentry_app.slug,
        )
