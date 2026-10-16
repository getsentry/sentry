from __future__ import annotations

from collections.abc import Collection, Sequence
from enum import Enum

from django.contrib.postgres.fields.array import ArrayField
from django.core.exceptions import ValidationError
from django.db import models, router, transaction

from sentry.backup.scopes import RelocationScope
from sentry.constants import ObjectStatus
from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    cell_silo_model,
    sane_repr,
)
from sentry.db.models.base import DefaultFieldsModel
from sentry.models.environment import Environment
from sentry.models.project import Project


class SeerWorkflowStrategy(models.TextChoices):
    AGENTIC_TRIAGE = "agentic_triage"
    DUPLICATE_MONITORS = "duplicate_monitors"
    AGENTIC_TRIAGE_V2 = "agentic_triage_v2"


class SeerWorkflowSelection(Enum):
    """Selects every project or environment, where a collection selects only its members."""

    ALL = "all"


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

    @classmethod
    def create_configurable(
        cls,
        organization_id: int,
        strategy: SeerWorkflowStrategy,
        *,
        projects: SeerWorkflowSelection | Collection[int],
        environments: SeerWorkflowSelection | Sequence[str],
    ) -> SeerWorkflowConfig:
        """Create a config at version 1. An organization may have many per strategy.

        Raises ValueError for a legacy strategy and ValidationError for an invalid scope, as
        set_scope does.
        """
        if strategy not in SEER_CONFIGURABLE_WORKFLOW_STRATEGIES:
            raise ValueError(f"{strategy} configs are managed with get_or_create_for_strategy")
        selected, environment_names = cls._validate_scope(organization_id, projects, environments)
        with transaction.atomic(router.db_for_write(cls)):
            config = cls.objects.create(
                organization_id=organization_id,
                strategy=strategy.value,
                is_all_projects=projects is SeerWorkflowSelection.ALL,
                environments=environment_names,
            )
            config._select_projects(selected)
        return config

    def set_scope(
        self,
        *,
        projects: SeerWorkflowSelection | Collection[int],
        environments: SeerWorkflowSelection | Sequence[str],
    ) -> None:
        """Replace the projects and environments and bump the version.

        Each argument is `SeerWorkflowSelection.ALL` or a non-empty collection. Projects must be
        active projects of this organization. Environment names are kept as saved and are not
        checked against Environment rows.

        Raises ValueError for a legacy config. Raises ValidationError keyed "projects" and
        "environments" before writing anything.
        """
        if self.strategy not in SEER_CONFIGURABLE_WORKFLOW_STRATEGIES:
            raise ValueError(f"{self.strategy} configs have no scope")
        selected, environment_names = self._validate_scope(
            self.organization_id, projects, environments
        )
        with transaction.atomic(router.db_for_write(type(self))):
            locked_version = (
                type(self)
                .objects.select_for_update()
                .values_list("version", flat=True)
                .get(id=self.id)
            )
            self.is_all_projects = projects is SeerWorkflowSelection.ALL
            self.environments = environment_names
            self.version = locked_version + 1
            self.save(update_fields=["is_all_projects", "environments", "version", "date_updated"])
            self._select_projects(selected)

    def get_project_ids(self) -> list[int]:
        """Active projects this config covers now, in ascending order.

        All projects covers every active project of the organization, including ones created
        later. Selected projects cover only those still active, so the list is empty once none
        remain. It never widens to all projects. Check `is_all_projects` to tell an empty
        selection from an organization without active projects.
        """
        projects = Project.objects.filter(
            organization_id=self.organization_id, status=ObjectStatus.ACTIVE
        )
        if not self.is_all_projects:
            projects = projects.filter(
                id__in=SeerWorkflowConfigProject.objects.filter(config=self).values("project_id")
            )
        return list(projects.order_by("id").values_list("id", flat=True))

    @staticmethod
    def _validate_scope(
        organization_id: int,
        projects: SeerWorkflowSelection | Collection[int],
        environments: SeerWorkflowSelection | Sequence[str],
    ) -> tuple[list[int], list[str]]:
        errors: dict[str, list[str]] = {}
        selected: list[int] = []
        if projects is not SeerWorkflowSelection.ALL:
            selected = sorted(set(projects))
            if not selected:
                errors["projects"] = ["Select at least one project."]
            else:
                active_ids = set(
                    Project.objects.filter(
                        organization_id=organization_id,
                        id__in=selected,
                        status=ObjectStatus.ACTIVE,
                    ).values_list("id", flat=True)
                )
                invalid_ids = [pid for pid in selected if pid not in active_ids]
                if invalid_ids:
                    # One message for other-organization and nonexistent ids so neither can be
                    # probed.
                    errors["projects"] = [
                        f"Invalid project ids: {', '.join(str(pid) for pid in invalid_ids)}."
                    ]

        if isinstance(environments, str):
            raise TypeError("environments must be a sequence of names, not a single string")
        environment_names: list[str] = []
        if environments is not SeerWorkflowSelection.ALL:
            environment_names = list(dict.fromkeys(environments))
            invalid_names = [
                name for name in environment_names if not Environment.is_valid_name(name)
            ]
            if not environment_names:
                errors["environments"] = ["Select at least one environment."]
            elif invalid_names:
                errors["environments"] = [f"Invalid environment names: {', '.join(invalid_names)}."]

        if errors:
            raise ValidationError(errors)
        return selected, environment_names

    def _select_projects(self, project_ids: list[int]) -> None:
        SeerWorkflowConfigProject.objects.filter(config=self).exclude(
            project_id__in=project_ids
        ).delete()
        SeerWorkflowConfigProject.objects.bulk_create(
            [SeerWorkflowConfigProject(config=self, project_id=pid) for pid in project_ids],
            ignore_conflicts=True,
        )


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
