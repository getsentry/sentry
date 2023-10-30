from django.db import router

from sentry import analytics
from sentry.constants import SentryAppInstallationStatus
from sentry.mediators.mediator import Mediator
from sentry.mediators.param import Param
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.services.hybrid_cloud.app import RpcSentryAppInstallation


class Updater(Mediator):
    sentry_app_installation = Param(RpcSentryAppInstallation)
    status = Param(str, required=False)
    using = router.db_for_write(SentryAppInstallation)

    def call(self):
        self._update_status()
        return self.sentry_app_installation

    def _update_status(self):
        # convert from string to integer
        if self.status == SentryAppInstallationStatus.INSTALLED_STR:
            for install in SentryAppInstallation.objects.filter(id=self.sentry_app_installation.id):
                install.update(status=SentryAppInstallationStatus.INSTALLED)

    def record_analytics(self):
        analytics.record(
            "sentry_app_installation.updated",
            sentry_app_installation_id=self.sentry_app_installation.id,
            sentry_app_id=self.sentry_app_installation.sentry_app.id,
            organization_id=self.sentry_app_installation.organization_id,
        )
