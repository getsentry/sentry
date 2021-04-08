from datetime import datetime

from sentry.constants import INTERNAL_INTEGRATION_TOKEN_COUNT_MAX
from sentry.exceptions import ApiTokenLimitError
from sentry.mediators import Mediator, Param
from sentry.models import ApiToken, AuditLogEntryEvent, SentryAppInstallationToken
from sentry.utils.cache import memoize


class Creator(Mediator):
    sentry_app_installation = Param("sentry.models.SentryAppInstallation")
    expires_at = Param(datetime.date, default=None, required=False)
    # analytics and audit params
    generate_audit = Param(bool, default=False)
    user = Param("sentry.models.User")
    request = Param("rest_framework.request.Request", required=False)

    def call(self):
        self._check_token_limit()
        self._create_api_token()
        self._create_sentry_app_installation_token()
        return self.api_token

    def _check_token_limit(self):
        curr_count = SentryAppInstallationToken.objects.filter(
            sentry_app_installation=self.sentry_app_installation
        ).count()
        if curr_count >= INTERNAL_INTEGRATION_TOKEN_COUNT_MAX:
            raise ApiTokenLimitError(
                "Cannot generate more than %d tokens for a single integration"
                % INTERNAL_INTEGRATION_TOKEN_COUNT_MAX
            )

    def _create_api_token(self):
        self.api_token = ApiToken.objects.create(
            user=self.sentry_app.proxy_user,
            application_id=self.sentry_app.application.id,
            scope_list=self.sentry_app.scope_list,
            expires_at=self.expires_at,
        )

    def _create_sentry_app_installation_token(self):
        self.sentry_app_installation_token = SentryAppInstallationToken.objects.create(
            api_token=self.api_token, sentry_app_installation=self.sentry_app_installation
        )

    def audit(self):
        from sentry.utils.audit import create_audit_entry

        if self.request and self.generate_audit:
            create_audit_entry(
                request=self.request,
                organization=self.organization,
                target_object=self.api_token.id,
                event=AuditLogEntryEvent.INTERNAL_INTEGRATION_ADD_TOKEN,
                data={"sentry_app": self.sentry_app.name},
            )

    def record_analytics(self):
        from sentry import analytics

        analytics.record(
            "sentry_app_installation_token.created",
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
