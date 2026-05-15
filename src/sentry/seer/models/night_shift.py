from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.seer.models.workflow import SeerWorkflowStrategy


@cell_silo_model
class SeerNightShiftRun(DefaultFieldsModel):
    """
    Records each night shift invocation for an organization.
    One row is created per org each time run_night_shift_for_org executes.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    workflow_config = FlexibleForeignKey(
        "seer.SeerWorkflowConfig", on_delete=models.SET_NULL, null=True
    )
    extras = models.JSONField(db_default={}, default=dict)

    class Meta:
        app_label = "seer"
        db_table = "seer_nightshiftrun"
        indexes = [
            models.Index(fields=["organization", "date_added"]),
            models.Index(fields=["date_added"]),
            models.Index(fields=["workflow_config", "date_added"]),
        ]

    __repr__ = sane_repr("organization_id", "workflow_config_id", "date_added")


@cell_silo_model
class SeerNightShiftRunResult(DefaultFieldsModel):
    """One unit of work produced by a night shift run, polymorphic by `kind`."""

    __relocation_scope__ = RelocationScope.Excluded

    run = FlexibleForeignKey(
        "seer.SeerNightShiftRun", on_delete=models.CASCADE, related_name="results"
    )
    kind = models.CharField(max_length=256, choices=SeerWorkflowStrategy.choices)
    group = FlexibleForeignKey(
        "sentry.Group", on_delete=models.CASCADE, db_constraint=False, null=True
    )
    seer_run_id = models.TextField(null=True)
    extras = models.JSONField(db_default={}, default=dict)

    class Meta:
        app_label = "seer"
        db_table = "seer_nightshiftrunissue"
        indexes = [
            models.Index(fields=["run", "kind"]),
        ]

    __repr__ = sane_repr("run_id", "kind", "group_id")
