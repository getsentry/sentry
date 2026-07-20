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
    # Dedupe key within (run, kind), meaningful only to the workflow that set
    # it (e.g. AGENTIC_TRIAGE uses str(group_id)). Lets redelivery-safe
    # dedupe work for workflows whose unit of work isn't a group.
    idempotency_key = models.CharField(max_length=256, null=True)
    seer_run_id = models.TextField(null=True)  # TODO: remove once result_seer_run is backfilled
    # TODO: make required once backfilled
    result_seer_run = FlexibleForeignKey("seer.SeerRun", on_delete=models.SET_NULL, null=True)
    extras = models.JSONField(db_default={}, default=dict)

    class Meta:
        app_label = "seer"
        db_table = "seer_nightshiftrunissue"
        indexes = [
            models.Index(fields=["run", "kind"]),
        ]
        constraints = [
            # One row per (run, kind, idempotency_key), so redelivered shard
            # results can't duplicate rows.
            models.UniqueConstraint(
                fields=["run", "kind", "idempotency_key"],
                condition=models.Q(idempotency_key__isnull=False),
                name="seer_nightshiftrunresult_unique_run_kind_idempotency_key",
            )
        ]

    __repr__ = sane_repr("run_id", "kind", "group_id")


@cell_silo_model
class SeerNightShiftRunShard(DefaultFieldsModel):
    """One shard of a night shift run, owning the SeerRun for a single
    dispatched Seer feature run. A run fans out its work into one or more shards
    dispatched as independent feature runs."""

    __relocation_scope__ = RelocationScope.Excluded

    run = FlexibleForeignKey(
        "seer.SeerNightShiftRun", on_delete=models.CASCADE, related_name="shards"
    )
    seer_run = models.OneToOneField(
        "seer.SeerRun", on_delete=models.SET_NULL, null=True, related_name="night_shift_shard"
    )
    extras = models.JSONField(db_default={}, default=dict)

    class Meta:
        app_label = "seer"
        db_table = "seer_nightshiftrunshard"

    __repr__ = sane_repr("run_id", "seer_run_id")
