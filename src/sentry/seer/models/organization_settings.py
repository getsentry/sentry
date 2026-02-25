from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, region_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@region_silo_model
class SeerOrganizationSettings(DefaultFieldsModel):
    """
    Dedicated model for structured Seer organization-level settings that benefit
    from being proper columns (foreign keys, indexed fields, etc.). Simple boolean
    toggles (e.g. sentry:hide_ai_features) remain in OrganizationOption.
    """

    __relocation_scope__ = RelocationScope.Organization

    organization = FlexibleForeignKey(
        "sentry.Organization", on_delete=models.CASCADE, unique=True, db_index=True
    )
    # When null, the default coding agent is Sentry's built-in Seer agent.
    # When set, overrides the default to use a specific integration (e.g. a
    # Cursor integration). HybridCloudForeignKey because Integration
    # is a @control_silo_model.
    default_coding_agent_integration_id = HybridCloudForeignKey(
        "sentry.Integration", on_delete="SET_NULL", null=True, blank=True, db_index=True
    )

    class Meta:
        app_label = "seer"
        db_table = "seer_organizationsettings"

    __repr__ = sane_repr("organization_id", "default_coding_agent_integration_id")
