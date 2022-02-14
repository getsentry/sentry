from django.db import models

from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey


class SentryAppInstallationForProvider(DefaultFieldsModel):
    """Connects a sentry app installation to an organization and a provider."""

    __include_in_export__ = False

    sentry_app_installation = FlexibleForeignKey("sentry.SentryAppInstallation")
    organization = FlexibleForeignKey("sentry.Organization")
    provider = models.CharField(max_length=64)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_sentryappinstallationforprovider"
        unique_together = (("provider", "organization"),)
