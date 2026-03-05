from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, region_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


class CodingAgent(models.TextChoices):
    SEER = "seer", "Seer"
    CURSOR = "cursor", "Cursor"


# Agents that require an integration to be configured.
# Validated at the API/serializer layer (not via DB constraint) so that adding
# new agents doesn't require a migration to update a CheckConstraint.
INTEGRATION_REQUIRED_AGENTS: frozenset[str] = frozenset({CodingAgent.CURSOR})


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
    # Which coding agent to use for new projects in this org.
    # "seer" = Sentry's built-in Seer agent (default)
    # "cursor" = Cursor (requires default_coding_agent_integration_id)
    # null = disabled, don't run any coding agent
    default_coding_agent = models.CharField(
        max_length=32,
        choices=CodingAgent.choices,
        default=CodingAgent.SEER,
        null=True,
    )
    # Only set when default_coding_agent requires an integration (e.g. "cursor").
    # HybridCloudForeignKey because Integration is a @control_silo_model.
    default_coding_agent_integration_id = HybridCloudForeignKey(
        "sentry.Integration", on_delete="SET_NULL", null=True, blank=True, db_index=True
    )

    class Meta:
        app_label = "seer"
        db_table = "seer_organizationsettings"

    __repr__ = sane_repr("organization_id", "default_coding_agent")
