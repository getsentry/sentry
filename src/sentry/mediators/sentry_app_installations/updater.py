from sentry import analytics
from sentry.constants import SentryAppInstallationStatus
from sentry.mediators import Mediator, Param
from sentry.mediators.param import if_param


class Updater(Mediator):
    sentry_app_installation = Param("sentry.models.SentryAppInstallation")
    status = Param((str,), required=False)

    def call(self):
        self._update_status()
        self.sentry_app_installation.save()
        return self.sentry_app_installation

    @if_param("status")
    def _update_status(self):
        # convert from string to integer
        if self.status == SentryAppInstallationStatus.INSTALLED_STR:
            self.sentry_app_installation.status = SentryAppInstallationStatus.INSTALLED

    def record_analytics(self):
        analytics.record(
            "sentry_app_installation.updated",
            sentry_app_installation_id=self.sentry_app_installation.id,
            sentry_app_id=self.sentry_app_installation.sentry_app.id,
            organization_id=self.sentry_app_installation.organization.id,
        )
