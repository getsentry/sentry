from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models.base import DefaultFieldsModel, region_silo_model
from sentry.db.models.fields.bounded import BoundedBigIntegerField


@region_silo_model
class PreventAIConfiguration(DefaultFieldsModel):
    """
    Configuration for Prevent AI features for git organizations per Sentry organization.

    This model stores configurations for Prevent AI functionality,
    allowing different settings for different git organizations and repos.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization_id = BoundedBigIntegerField(db_index=True)
    provider = models.CharField(max_length=64)
    git_organization_id = models.CharField(max_length=255)
    data = models.JSONField(default=dict)

    class Meta:
        app_label = "prevent"
        db_table = "sentry_preventaiconfiguration"
        unique_together = (("organization_id", "provider", "git_organization_id"),)
