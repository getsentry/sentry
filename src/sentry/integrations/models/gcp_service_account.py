from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, control_silo_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@control_silo_model
class GcpServiceAccount(DefaultFieldsModel):
    """
    Tracks per-customer GCP service accounts created for the GCP MCP org-level
    integration. Each Sentry org gets at most one SA.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization_id = HybridCloudForeignKey("sentry.Organization", on_delete="CASCADE", unique=True)
    service_account_email = models.CharField(max_length=255)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_gcpserviceaccount"
