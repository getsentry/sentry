from __future__ import absolute_import

import six

from sentry import analytics
from sentry.constants import SentryAppInstallationStatus
from sentry.mediators import Mediator, Param, service_hooks
from sentry.models import AuditLogEntryEvent, ApiGrant, SentryApp, SentryAppInstallation
from sentry.utils.cache import memoize
from sentry.tasks.sentry_apps import installation_webhook


class Creator(Mediator):
    organization = Param("sentry.models.Organization")
    slug = Param(six.string_types)
    user = Param("sentry.models.User")
    request = Param("rest_framework.request.Request", required=False)
    notify = Param(bool, default=True)

    def call(self):
        self._create_api_grant()
        self._create_install()
        self._create_service_hooks()
        self.install.is_new = True
        return self.install

    def _create_install(self):
        status = SentryAppInstallationStatus.PENDING
        if not self.sentry_app.verify_install:
            status = SentryAppInstallationStatus.INSTALLED

        self.install = SentryAppInstallation.objects.create(
            organization_id=self.organization.id,
            sentry_app_id=self.sentry_app.id,
            api_grant_id=self.api_grant.id,
            status=status,
        )

    def _create_api_grant(self):
        self.api_grant = ApiGrant.objects.create(
            user_id=self.sentry_app.proxy_user.id, application_id=self.api_application.id
        )

    def _create_service_hooks(self):
        # only make the service hook if there is a webhook url
        if self.sentry_app.webhook_url:
            service_hooks.Creator.run(
                application=self.api_application,
                actor=self.install,
                projects=[],
                organization=self.organization,
                events=self.sentry_app.events,
                url=self.sentry_app.webhook_url,
            )

    def post_install(self):
        if self.notify:
            installation_webhook.delay(self.install.id, self.user.id)

    def audit(self):
        from sentry.utils.audit import create_audit_entry

        if self.request:
            create_audit_entry(
                request=self.request,
                organization=self.install.organization,
                target_object=self.install.organization.id,
                event=AuditLogEntryEvent.SENTRY_APP_INSTALL,
                data={"sentry_app": self.sentry_app.name},
            )

    def record_analytics(self):
        analytics.record(
            "sentry_app.installed",
            user_id=self.user.id,
            organization_id=self.organization.id,
            sentry_app=self.slug,
        )

    @memoize
    def api_application(self):
        return self.sentry_app.application

    @memoize
    def sentry_app(self):
        return SentryApp.objects.get(slug=self.slug)
