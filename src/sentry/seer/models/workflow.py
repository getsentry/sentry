from __future__ import annotations

from typing import Any

from django.db import models
from pydantic import BaseModel

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    cell_silo_model,
    sane_repr,
)
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


class SeerWorkflowStrategy(models.TextChoices):
    AGENTIC_TRIAGE = "agentic_triage"
    DUPLICATE_MONITORS = "duplicate_monitors"
    AGENTIC_TRIAGE_V2 = "agentic_triage_v2"
    BREACHED_METRIC_INVESTIGATION = "breached_metric_investigation"


# Strategies with one config per organization, found or created by get_or_create_for_strategy.
# We are hard-cutting over to the newer configurable strategies
SEER_LEGACY_WORKFLOW_STRATEGIES = frozenset(
    {SeerWorkflowStrategy.AGENTIC_TRIAGE, SeerWorkflowStrategy.DUPLICATE_MONITORS}
)

# Strategies with any number of configs per organization. Each config is looked up by its id.
SEER_CONFIGURABLE_WORKFLOW_STRATEGIES = frozenset(
    {SeerWorkflowStrategy.AGENTIC_TRIAGE_V2, SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION}
)

# Maximum configs with configurable strategies per organization. Configurable strategies have
# no uniqueness constraint, so this bounds how many automations an organization can create.
MAX_CONFIGURABLE_WORKFLOWS_PER_ORGANIZATION = 50


class SeerWorkflowConfigExtras(BaseModel):
    # The default strategy that seeded this config; unset for user-created configs.
    seeded_default: SeerWorkflowStrategy | None = None


class SeerWorkflowFilters(BaseModel):
    """Which work a workflow picks. Strategies subclass this to add their own filters."""

    # False means only the config's SeerWorkflowConfigProject rows, so a config with no rows
    # covers no projects rather than every project.
    all_projects: bool = False
    # An empty list means all environments.
    environments: list[str] = []


class SeerWorkflowSchedule(models.TextChoices):
    DAILY = "daily"


@cell_silo_model
class SeerWorkflowConfig(DefaultFieldsModel):
    """A workflow's saved configuration.

    Repositories are not configured here. Execution uses the resolved projects' existing Seer
    project-repository associations. Read and change it through SeerWorkflow in
    sentry.seer.workflows.workflow.
    """

    __relocation_scope__ = RelocationScope.Organization

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    service_account_id = HybridCloudForeignKey(
        "service_accounts.ServiceAccount",
        on_delete="SET_NULL",
        null=True,
    )
    strategy = models.CharField(max_length=256, choices=SeerWorkflowStrategy.choices)
    enabled = models.BooleanField(default=False)
    schedule = models.CharField(
        max_length=256, choices=SeerWorkflowSchedule.choices, default=SeerWorkflowSchedule.DAILY
    )
    # Metadata in the shape of SeerWorkflowConfigExtras.
    extras = models.JSONField(db_default={}, default=dict)
    # Incremented on every saved change, so runs can record which configuration they used.
    version = BoundedPositiveIntegerField(default=1, db_default=1)
    # Which work to pick, in the shape of SeerWorkflowFilters.
    filters = models.JSONField(default=dict, db_default={})
    # Result destinations, notifications and review behavior.
    output_policy = models.JSONField(default=dict, db_default={})

    class Meta:
        app_label = "seer"
        db_table = "seer_workflowconfig"
        constraints = [
            # Scoped to only the legacy workflows that allowed one per org
            models.UniqueConstraint(
                fields=["organization", "strategy"],
                condition=models.Q(
                    strategy__in=sorted(s.value for s in SEER_LEGACY_WORKFLOW_STRATEGIES)
                ),
                name="seer_workflowconfig_legacy_org_strategy_uniq",
            ),
        ]

    __repr__ = sane_repr("organization_id", "strategy", "enabled")

    @classmethod
    def get_or_create_for_strategy(
        cls, organization_id: int, strategy: SeerWorkflowStrategy
    ) -> SeerWorkflowConfig:
        if strategy not in SEER_LEGACY_WORKFLOW_STRATEGIES:
            raise ValueError(f"{strategy} configs are addressed by id, not by strategy")
        config, _ = cls.objects.get_or_create(
            organization_id=organization_id,
            strategy=strategy.value,
        )
        return config


@cell_silo_model
class SeerWorkflowConfigProject(DefaultFieldsModel):
    """One selected project of a config whose filters do not select all projects."""

    __relocation_scope__ = RelocationScope.Organization

    config = FlexibleForeignKey("seer.SeerWorkflowConfig", on_delete=models.CASCADE)
    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)

    class Meta:
        app_label = "seer"
        db_table = "seer_workflowconfigproject"
        constraints = [
            models.UniqueConstraint(
                fields=["config", "project"], name="seer_workflowconfigproject_config_project_uniq"
            ),
        ]

    __repr__ = sane_repr("config_id", "project_id")


@cell_silo_model
class SeerWorkflowTriggerBinding(DefaultFieldsModel):
    """Connect a WFE Action to an automation; a config may have multiple bindings."""

    __relocation_scope__ = RelocationScope.Excluded

    workflow_config = FlexibleForeignKey("seer.SeerWorkflowConfig", on_delete=models.CASCADE)
    trigger_action = models.OneToOneField(
        "workflow_engine.Action", on_delete=models.CASCADE, related_name="seer_workflow_binding"
    )

    class Meta:
        app_label = "seer"
        db_table = "seer_workflowtriggerbinding"

    __repr__ = sane_repr("workflow_config_id", "trigger_action_id")


class SeerWorkflowRunStatus(models.TextChoices):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETE = "complete"
    FAILED = "failed"
    REJECTED = "rejected"


class SeerWorkflowExecutionStatus(models.TextChoices):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETE = "complete"
    FAILED = "failed"


class WorkflowSnapshotFilters(SeerWorkflowFilters):
    class Config:
        extra = "allow"


class WorkflowRunSnapshot(BaseModel):
    config_version: int
    strategy: SeerWorkflowStrategy
    filters: WorkflowSnapshotFilters
    project_ids: tuple[int, ...]
    output_policy: dict[str, Any]
    inputs: dict[str, Any]

    class Config:
        allow_mutation = False


class WorkflowRunError(BaseModel):
    # Stable snake_case failure category chosen by the caller, e.g. "dispatch_failed".
    code: str
    # Explanation safe to display, e.g. "Could not start the execution."
    message: str


class SeerWorkflowRunExtras(BaseModel):
    snapshot: WorkflowRunSnapshot
    error: WorkflowRunError | None = None

    class Config:
        # Preserve strategy-specific metadata when updating shared fields.
        extra = "allow"


class SeerWorkflowExecutionExtras(BaseModel):
    error: WorkflowRunError | None = None

    class Config:
        extra = "allow"


@cell_silo_model
class SeerWorkflowRun(DefaultFieldsModel):
    """Records each workflow invocation for an organization.

    A run can split its work into multiple SeerWorkflowRunExecution records,
    each dispatched independently to Seer.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    workflow_config = FlexibleForeignKey(
        "seer.SeerWorkflowConfig", on_delete=models.CASCADE, null=True
    )
    # Cron window (e.g. 2024-07-22T22:00) or event identity (e.g. issue_created:123).
    trigger_key = models.CharField(max_length=256, null=True, db_column="schedule_id")
    # Null for historical runs that have not adopted the shared lifecycle.
    status = models.CharField(max_length=256, choices=SeerWorkflowRunStatus.choices, null=True)
    date_completed = models.DateTimeField(null=True)
    # Shape: SeerWorkflowRunExtras.
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
                fields=["organization", "workflow_config", "trigger_key"],
                condition=models.Q(trigger_key__isnull=False),
                name="seer_nightshiftrun_unique_org_config_schedule",
            ),
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
    status = models.CharField(
        max_length=256, choices=SeerWorkflowExecutionStatus.choices, null=True
    )
    date_completed = models.DateTimeField(null=True)
    # Shape: SeerWorkflowExecutionExtras.
    extras = models.JSONField(db_default={}, default=dict)

    class Meta:
        app_label = "seer"
        db_table = "seer_nightshiftrunshard"

    __repr__ = sane_repr("run_id", "seer_run_id")
