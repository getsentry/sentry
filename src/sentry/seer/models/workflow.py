from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel


class SeerWorkflowStrategy(models.TextChoices):
    AGENTIC_TRIAGE = "agentic_triage"


class SeerWorkflowSchedule(models.TextChoices):
    DAILY = "daily"


@cell_silo_model
class SeerWorkflowConfig(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    strategy = models.CharField(max_length=256, choices=SeerWorkflowStrategy.choices)
    enabled = models.BooleanField(default=False)
    schedule = models.CharField(
        max_length=256, choices=SeerWorkflowSchedule.choices, default=SeerWorkflowSchedule.DAILY
    )
    extras = models.JSONField(db_default={}, default=dict)

    class Meta:
        app_label = "seer"
        db_table = "seer_workflowconfig"
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "strategy"], name="seer_workflowconfig_org_strategy_uniq"
            ),
        ]

    __repr__ = sane_repr("organization_id", "strategy", "enabled")

    @classmethod
    def get_or_create_for_strategy(
        cls, organization_id: int, strategy: SeerWorkflowStrategy
    ) -> SeerWorkflowConfig:
        config, _ = cls.objects.get_or_create(
            organization_id=organization_id,
            strategy=strategy.value,
        )
        return config


@cell_silo_model
class SeerWorkflowRun(DefaultFieldsModel):
    """Records each workflow invocation for an organization.

    A run can split its work into multiple SeerWorkflowRunExecution records,
    each dispatched independently to Seer.

    Cron invocations create one row per organization, workflow config, and
    schedule window. Each manual invocation creates a new row.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    workflow_config = FlexibleForeignKey(
        "seer.SeerWorkflowConfig", on_delete=models.SET_NULL, null=True
    )
    # Cron-derived schedule window (currently YYYY-MM-DDTHH:MM), nullable for
    # manual and historical runs.
    schedule_id = models.CharField(max_length=256, null=True)
    date_completed = models.DateTimeField(null=True)
    extras = models.JSONField(db_default={}, default=dict)

    class Meta:
        app_label = "seer"
        db_table = "seer_nightshiftrun"
        indexes = [
            models.Index(fields=["organization", "date_added"]),
            models.Index(fields=["date_added"]),
            models.Index(fields=["workflow_config", "date_added"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "workflow_config", "schedule_id"],
                condition=models.Q(schedule_id__isnull=False),
                name="seer_nightshiftrun_unique_org_config_schedule",
            )
        ]

    __repr__ = sane_repr("organization_id", "workflow_config_id", "date_added")


@cell_silo_model
class SeerWorkflowRunExecution(DefaultFieldsModel):
    """One chunk of a workflow run's work, dispatched as a single Seer feature run.

    A workflow run can use one execution for all its work or multiple executions
    to process smaller chunks. Each execution links to its own SeerRun when dispatched.
    """

    __relocation_scope__ = RelocationScope.Excluded

    run = FlexibleForeignKey(
        "seer.SeerWorkflowRun", on_delete=models.CASCADE, related_name="executions"
    )
    seer_run = models.OneToOneField(
        "seer.SeerRun", on_delete=models.SET_NULL, null=True, related_name="workflow_execution"
    )
    extras = models.JSONField(db_default={}, default=dict)

    class Meta:
        app_label = "seer"
        db_table = "seer_nightshiftrunshard"

    __repr__ = sane_repr("run_id", "seer_run_id")
