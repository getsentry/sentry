from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, cell_silo_model, sane_repr


@cell_silo_model
class CustomInboundFilter(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    project = FlexibleForeignKey(
        "sentry.Project", on_delete=models.CASCADE, related_name="custom_inbound_filters"
    )
    name = models.CharField(max_length=256, null=True, blank=True)
    active = models.BooleanField(default=True, db_default=True)
    conditions = models.JSONField(default=list)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_custominboundfilter"
        indexes = [
            models.Index(fields=["project", "id"], name="sentry_cif_project_id_idx"),
        ]

    __repr__ = sane_repr("project_id", "name")
