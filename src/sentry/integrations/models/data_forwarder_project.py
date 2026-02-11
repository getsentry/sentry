from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model
from sentry.db.models.fields.encryption.encrypted_json_field import EncryptedJSONField


@region_silo_model
class DataForwarderProject(DefaultFieldsModel):
    """
    Links DataForwarder to specific projects with optional project-specific overrides.
    """

    __relocation_scope__ = RelocationScope.Organization

    is_enabled = models.BooleanField(default=True)
    data_forwarder = FlexibleForeignKey(
        "sentry.DataForwarder",
        on_delete=models.CASCADE,
        related_name="projects",
    )
    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)
    overrides = EncryptedJSONField(default=dict)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dataforwarderproject"
        unique_together = (("data_forwarder", "project"),)

    def get_config(self) -> dict:
        """
        Get the configuration by merging the base config with project overrides.
        """
        base_config = self.data_forwarder.config.copy()

        effective_config = base_config.copy()
        effective_config.update(self.overrides)

        return effective_config
