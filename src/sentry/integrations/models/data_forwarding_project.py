from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model
from sentry.db.models.fields.jsonfield import JSONField


@region_silo_model
class DataForwardingProject(DefaultFieldsModel):
    """
    Links DataForwardingConfig to specific projects with optional project-specific overrides.
    """

    __relocation_scope__ = RelocationScope.Organization

    config = FlexibleForeignKey(
        "sentry.DataForwardingConfig",
        on_delete=models.CASCADE,
        related_name="project_configs",
    )
    project_id = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)
    overrides = JSONField(default=dict)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dataforwardingproject"
        unique_together = (("config", "project_id"),)

    def get_config(self) -> dict:
        """
        Get the configuration by merging the base config with project overrides.
        """
        base_config = self.config.config.copy()

        effective_config = base_config.copy()
        effective_config.update(self.overrides)

        return effective_config
