from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel


@cell_silo_model
class SeerNightShiftRun(DefaultFieldsModel):
    """
    Records each night shift invocation for an organization.
    One row is created per org each time run_night_shift_for_org executes.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    triage_strategy = models.CharField(max_length=64)
    error_message = models.TextField(null=True)

    class Meta:
        app_label = "seer"
        db_table = "seer_nightshiftrun"
        indexes = [
            models.Index(fields=["organization", "date_added"]),
            models.Index(fields=["date_added"]),
        ]

    __repr__ = sane_repr("organization_id", "triage_strategy", "date_added")


@cell_silo_model
class SeerNightShiftRunIssue(DefaultFieldsModel):
    """
    Links a night shift run to a specific issue that was triaged.
    Stores the action taken and an optional reference to the Seer run ID
    for looking up details in Seer's database.
    """

    __relocation_scope__ = RelocationScope.Excluded

    run = FlexibleForeignKey(
        "seer.SeerNightShiftRun", on_delete=models.CASCADE, related_name="issues"
    )
    group = FlexibleForeignKey("sentry.Group", on_delete=models.CASCADE, db_constraint=False)
    action = models.CharField(max_length=32)
    seer_run_id = models.TextField(null=True)

    class Meta:
        app_label = "seer"
        db_table = "seer_nightshiftrunissue"

    __repr__ = sane_repr("run_id", "group_id", "action")
