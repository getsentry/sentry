from __future__ import annotations

from django.contrib.postgres.fields.array import ArrayField
from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    cell_silo_model,
    sane_repr,
)
from sentry.db.models.base import DefaultFieldsModel


class SeerWorkflowStrategy(models.TextChoices):
    AGENTIC_TRIAGE = "agentic_triage"
    DUPLICATE_MONITORS = "duplicate_monitors"
    AGENTIC_TRIAGE_V2 = "agentic_triage_v2"


# Strategies with one config per organization, found or created by get_or_create_for_strategy.
SEER_LEGACY_WORKFLOW_STRATEGIES = frozenset(
    {SeerWorkflowStrategy.AGENTIC_TRIAGE, SeerWorkflowStrategy.DUPLICATE_MONITORS}
)
# Strategies with any number of configs per organization. Each config is looked up by its id.
SEER_CONFIGURABLE_WORKFLOW_STRATEGIES = frozenset({SeerWorkflowStrategy.AGENTIC_TRIAGE_V2})


class SeerWorkflowSchedule(models.TextChoices):
    DAILY = "daily"


@cell_silo_model
class SeerWorkflowConfig(DefaultFieldsModel):
    """An automation's saved configuration.

    Repositories are not configured here. Execution uses the resolved projects' existing Seer
    project-repository associations.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    strategy = models.CharField(max_length=256, choices=SeerWorkflowStrategy.choices)
    enabled = models.BooleanField(default=False)
    schedule = models.CharField(
        max_length=256, choices=SeerWorkflowSchedule.choices, default=SeerWorkflowSchedule.DAILY
    )
    # Legacy free-form field.
    extras = models.JSONField(db_default={}, default=dict)
    strategy_version = BoundedPositiveIntegerField(default=1, db_default=1)
    version = BoundedPositiveIntegerField(default=1, db_default=1)
    # The JSON fields below hold settings the customer chose, not internal tuning. Each strategy
    # defines and validates their shape.
    # Which work it picks beyond projects and environments, such as {"min_event_count": 10}.
    # These are work filters, not access limits. The service account controls access.
    filters = models.JSONField(default=dict, db_default={})
    # Where results go and how they are delivered: destinations, notifications and review.
    output_policy = models.JSONField(default=dict, db_default={})
    # Spend caps in cents, so $1.00 is 100. Null means no limit.
    daily_spend_limit_cents = BoundedPositiveIntegerField(null=True)
    run_spend_limit_cents = BoundedPositiveIntegerField(null=True)
    investigation_spend_limit_cents = BoundedPositiveIntegerField(null=True)
    # False with no SeerWorkflowConfigProject rows means no selected projects remain, so a config
    # saved without a project selection never widens to all projects.
    is_all_projects = models.BooleanField(default=False, db_default=False)
    # An empty list means all environments.
    environments = ArrayField(models.TextField(), default=list, db_default=[])
    # Id from the service-account management API.
    service_account_id = BoundedBigIntegerField(null=True)

    class Meta:
        app_label = "seer"
        db_table = "seer_workflowconfig"
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "strategy"],
                condition=models.Q(
                    strategy__in=sorted(s.value for s in SEER_LEGACY_WORKFLOW_STRATEGIES)
                ),
                name="seer_legacy_org_strategy_unique",
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
    """One selected project of a config whose `is_all_projects` is False."""

    __relocation_scope__ = RelocationScope.Excluded

    config = FlexibleForeignKey("seer.SeerWorkflowConfig", on_delete=models.CASCADE)
    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)

    class Meta:
        app_label = "seer"
        db_table = "seer_workflowconfigproject"
        constraints = [
            models.UniqueConstraint(
                fields=["config", "project"], name="seer_workflowconfigproject_unique"
            ),
        ]

    __repr__ = sane_repr("config_id", "project_id")


@cell_silo_model
class SeerWorkflowRun(DefaultFieldsModel):
    """Records each workflow invocation for an organization.

    A run can split its work into multiple SeerWorkflowRunExecution records,
    each dispatched independently to Seer.
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
