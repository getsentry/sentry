from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models.base import DefaultFieldsModel, region_silo_model
from sentry.db.models.fields.foreignkey import FlexibleForeignKey
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@region_silo_model
class PreventAIConfiguration(DefaultFieldsModel):
    """
    Model for managing configurations for Prevent AI features
    per Sentry organization and integration.

    DEPRECATED: This model is no longer used and will be removed in a future PR.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization")
    integration_id = HybridCloudForeignKey("sentry.Integration", on_delete="CASCADE", db_index=True)
    data = models.JSONField(default=dict)

    class Meta:
        app_label = "prevent"
        db_table = "prevent_ai_configuration"
        unique_together = (("organization_id", "integration_id"),)
