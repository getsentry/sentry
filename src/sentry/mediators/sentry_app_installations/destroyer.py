from __future__ import absolute_import

from sentry import analytics
from sentry.mediators import Mediator, Param
from sentry.mediators import service_hooks
from sentry.models import AuditLogEntryEvent, ServiceHook
from sentry.mediators.sentry_app_installations.installation_notifier import InstallationNotifier
from sentry.utils.audit import create_audit_entry


class Destroyer(Mediator):
    install = Param('sentry.models.SentryAppInstallation')
    user = Param('sentry.models.User')
    request = Param('rest_framework.request.Request', required=False)

    def call(self):
        self._destroy_grant()
        self._destroy_service_hooks()
        self._destroy_installation()
        return self.install

    def _destroy_grant(self):
        if self.install.api_grant_id:
            self.install.api_grant.delete()

    def _destroy_service_hooks(self):
        hooks = ServiceHook.objects.filter(
            application_id=self.install.sentry_app.application_id,
            actor_id=self.install.id,
        )
        for hook in hooks:
            service_hooks.Destroyer.run(service_hook=hook)

    def _destroy_installation(self):
        InstallationNotifier.run(
            install=self.install,
            user=self.user,
            action='deleted',
        )
        self.install.delete()

    def audit(self):
        if self.request:
            create_audit_entry(
                request=self.request,
                organization=self.install.organization,
                target_object=self.install.organization.id,
                event=AuditLogEntryEvent.SENTRY_APP_UNINSTALL,
                data={
                    'sentry_app': self.install.sentry_app.name,
                },
            )

    def record_analytics(self):
        analytics.record(
            'sentry_app.uninstalled',
            user_id=self.user.id,
            organization_id=self.install.organization_id,
            sentry_app=self.install.sentry_app.slug,
        )
