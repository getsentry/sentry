from __future__ import absolute_import

from sentry.mediators import Mediator, Param
from sentry.mediators import sentry_app_installations
from sentry.models import AuditLogEntryEvent
from sentry.utils.audit import create_audit_entry


class Destroyer(Mediator):
    sentry_app = Param('sentry.models.SentryApp')
    request = Param('rest_framework.request.Request', required=False)

    def call(self):
        self._destroy_sentry_app_installations()
        self._destroy_api_application()
        self._destroy_proxy_user()
        self._destroy_sentry_app()
        return self.sentry_app

    def _destroy_sentry_app_installations(self):
        for install in self.sentry_app.installations.all():
            sentry_app_installations.Destroyer.run(
                install=install,
                user=self.sentry_app.proxy_user,
            )

    def _destroy_api_application(self):
        self.sentry_app.application.delete()

    def _destroy_proxy_user(self):
        self.sentry_app.proxy_user.delete()

    def _destroy_sentry_app(self):
        self.sentry_app.delete()

    def audit(self):
        if self.request:
            create_audit_entry(
                request=self.request,
                organization=self.sentry_app.owner,
                target_object=self.sentry_app.owner.id,
                event=AuditLogEntryEvent.SENTRY_APP_REMOVE,
                data={
                    'sentry_app': self.sentry_app.name,
                },
            )
