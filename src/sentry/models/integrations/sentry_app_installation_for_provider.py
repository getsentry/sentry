from django.db import models

from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, control_silo_only_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@control_silo_only_model
class SentryAppInstallationForProvider(DefaultFieldsModel):
    """Connects a sentry app installation to an organization and a provider."""

    __include_in_export__ = False

    sentry_app_installation = FlexibleForeignKey("sentry.SentryAppInstallation")
    organization_id = HybridCloudForeignKey("sentry.Organization", on_delete="CASCADE")
    provider = models.CharField(max_length=64)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_sentryappinstallationforprovider"
        unique_together = (("provider", "organization_id"),)
