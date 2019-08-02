from __future__ import absolute_import

from sentry import analytics
from sentry.mediators import Mediator, Param
from sentry.mediators import sentry_app_installations
from sentry.models import AuditLogEntryEvent
from sentry.utils.audit import create_audit_entry


class Destroyer(Mediator):
    sentry_app = Param("sentry.models.SentryApp")
    request = Param("rest_framework.request.Request", required=False)
    user = Param("sentry.models.User")

    def call(self):
        self._destroy_api_application()
        self._destroy_sentry_app_installations()
        self._destroy_proxy_user()
        self._destroy_sentry_app()
        return self.sentry_app

    def _destroy_sentry_app_installations(self):
        for install in self.sentry_app.installations.all():
            notify = False if self.sentry_app.is_internal else True
            sentry_app_installations.Destroyer.run(
                install=install, user=self.sentry_app.proxy_user, notify=notify
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
                data={"sentry_app": self.sentry_app.name},
            )

    def record_analytics(self):
        analytics.record(
            "sentry_app.deleted",
            user_id=self.user.id,
            organization_id=self.sentry_app.owner.id,
            sentry_app=self.sentry_app.slug,
        )
