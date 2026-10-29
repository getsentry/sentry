from __future__ import annotations

from collections.abc import Collection, Mapping, Sequence
from dataclasses import dataclass
from typing import Any, assert_never

from django.db import router, transaction
from django.db.models import QuerySet
from pydantic import BaseModel

from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.models.workflow import (
    MAX_CONFIGURABLE_WORKFLOWS_PER_ORGANIZATION,
    SEER_CONFIGURABLE_WORKFLOW_STRATEGIES,
    SeerWorkflowConfig,
    SeerWorkflowConfigExtras,
    SeerWorkflowConfigProject,
    SeerWorkflowFilters,
    SeerWorkflowRun,
    SeerWorkflowRunExtras,
    SeerWorkflowRunStatus,
    SeerWorkflowSchedule,
    SeerWorkflowStrategy,
    WorkflowRunSnapshot,
)
from sentry.seer.workflows.runs import SeerWorkflowRunLifecycle
from sentry.service_accounts.models import ServiceAccountReplica
from sentry.utils import json

SEER_DEFAULT_WORKFLOW_STRATEGIES = (SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,)


class SeerWorkflowConfigError(ValueError):
    """A config validation failure with a message safe to show to the user."""


@dataclass(frozen=True)
class AllProjects:
    pass


@dataclass(frozen=True)
class SelectedProjects:
    project_ids: tuple[int, ...]


type ProjectSelection = AllProjects | SelectedProjects


@dataclass
class SeerWorkflow:
    """A Seer automation backed by a saved workflow configuration."""

    config: SeerWorkflowConfig

    @classmethod
    def ensure_defaults(cls, organization_id: int) -> None:
        """Seed defaults for strategies with no config; disabled configs count as existing."""
        configs = SeerWorkflowConfig.objects.filter(
            organization_id=organization_id,
            strategy__in=[s.value for s in SEER_DEFAULT_WORKFLOW_STRATEGIES],
        )
        existing = set(configs.values_list("strategy", flat=True))
        if all(s.value in existing for s in SEER_DEFAULT_WORKFLOW_STRATEGIES):
            return

        with transaction.atomic(router.db_for_write(SeerWorkflowConfig)):
            # Prevent duplicate seeds without a uniqueness constraint on configurable strategies.
            list(Organization.objects.select_for_update().filter(id=organization_id))
            existing = set(configs.values_list("strategy", flat=True))
            SeerWorkflowConfig.objects.bulk_create(
                [
                    SeerWorkflowConfig(
                        organization_id=organization_id,
                        strategy=strategy.value,
                        filters=SeerWorkflowFilters(all_projects=True).dict(),
                        extras=SeerWorkflowConfigExtras(seeded_default=strategy).dict(
                            exclude_none=True
                        ),
                    )
                    for strategy in SEER_DEFAULT_WORKFLOW_STRATEGIES
                    if strategy.value not in existing
                ]
            )

    @classmethod
    def create(
        cls,
        organization_id: int,
        *,
        strategy: SeerWorkflowStrategy,
        enabled: bool = False,
        schedule: SeerWorkflowSchedule = SeerWorkflowSchedule.DAILY,
        environments: Sequence[str] = (),
        project_ids: Collection[int] | None,
    ) -> SeerWorkflow:
        """Create a user-defined automation. ``project_ids=None`` selects all projects."""
        if strategy not in SEER_CONFIGURABLE_WORKFLOW_STRATEGIES:
            raise SeerWorkflowConfigError(f"{strategy} configs cannot be created")
        if (
            strategy == SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
            and project_ids is not None
        ):
            raise SeerWorkflowConfigError(
                "Breached metric projects are selected by connecting monitors"
            )
        requested = set(project_ids or ())

        with transaction.atomic(router.db_for_write(SeerWorkflowConfig)):
            # Serialize creation per organization so concurrent requests can't exceed the cap.
            list(Organization.objects.select_for_update().filter(id=organization_id))
            existing = SeerWorkflowConfig.objects.filter(
                organization_id=organization_id,
                strategy__in=SEER_CONFIGURABLE_WORKFLOW_STRATEGIES,
            ).count()
            if existing >= MAX_CONFIGURABLE_WORKFLOWS_PER_ORGANIZATION:
                raise SeerWorkflowConfigError(
                    "Organizations can have at most "
                    f"{MAX_CONFIGURABLE_WORKFLOWS_PER_ORGANIZATION} automations"
                )
            valid_project_ids = set(
                Project.objects.filter(
                    organization_id=organization_id, id__in=requested
                ).values_list("id", flat=True)
            )
            if requested != valid_project_ids:
                raise SeerWorkflowConfigError(
                    "Selected projects must exist in the workflow's organization"
                )

            config = SeerWorkflowConfig.objects.create(
                organization_id=organization_id,
                strategy=strategy,
                enabled=enabled,
                schedule=schedule,
                filters=SeerWorkflowFilters(
                    all_projects=project_ids is None, environments=list(environments)
                ).dict(),
            )
            SeerWorkflowConfigProject.objects.bulk_create(
                [
                    SeerWorkflowConfigProject(config=config, project_id=project_id)
                    for project_id in sorted(requested)
                ]
            )
        return cls(config)

    @property
    def extras(self) -> SeerWorkflowConfigExtras:
        return SeerWorkflowConfigExtras.parse_obj(self.config.extras)

    @property
    def filters(self) -> SeerWorkflowFilters:
        return SeerWorkflowFilters.parse_obj(self.config.filters)

    def get_or_create_run(
        self,
        *,
        trigger_key: str,
        inputs: BaseModel,
        extras: Mapping[str, Any] | None = None,
    ) -> WorkflowRunCreationResult:
        """Retries preserve the original configuration and inputs."""
        if not trigger_key or len(trigger_key) > 256:
            raise ValueError("Trigger keys must contain between 1 and 256 characters")

        with transaction.atomic(router.db_for_write(SeerWorkflowRun)):
            self.config = SeerWorkflowConfig.objects.select_for_update().get(
                id=self.config.id, organization_id=self.config.organization_id
            )
            existing = self.get_runs().filter(trigger_key=trigger_key).first()
            if existing is not None:
                return WorkflowRunCreationResult(
                    lifecycle=SeerWorkflowRunLifecycle(
                        run_id=existing.id, organization_id=existing.organization_id
                    ),
                    created=False,
                )

            snapshot = WorkflowRunSnapshot(
                config_version=self.config.version,
                strategy=SeerWorkflowStrategy(self.config.strategy),
                filters=self.config.filters,
                project_ids=tuple(self.get_project_ids()),
                output_policy=self.config.output_policy,
                inputs=json.loads(inputs.json()),
            )
            run_extras = SeerWorkflowRunExtras.parse_obj({**(extras or {}), "snapshot": snapshot})
            run = SeerWorkflowRun.objects.create(
                organization_id=self.config.organization_id,
                workflow_config=self.config,
                trigger_key=trigger_key,
                status=SeerWorkflowRunStatus.QUEUED,
                extras=json.loads(run_extras.json()),
            )
            return WorkflowRunCreationResult(
                lifecycle=SeerWorkflowRunLifecycle(
                    run_id=run.id, organization_id=run.organization_id
                ),
                created=True,
            )

    def get_runs(self) -> QuerySet[SeerWorkflowRun]:
        return SeerWorkflowRun.objects.filter(
            organization_id=self.config.organization_id, workflow_config_id=self.config.id
        ).order_by("-date_added", "-id")

    def matches_scope(self, project_id: int, environment: str | None) -> bool:
        """Check the automation's scope before recording an admission decision."""
        return (
            self.config.enabled
            and (not self.filters.environments or environment in self.filters.environments)
            and self._get_projects().filter(id=project_id).exists()
        )

    def has_quota_available(self) -> bool:
        """Allow runs until automation quota enforcement is implemented."""
        # TODO(telkins): Enforce automation quota before accepting a new run.
        return True

    def get_project_ids(self) -> list[int]:
        """Return active project IDs matching this workflow's filters, in ascending order."""
        return list(self._get_projects().order_by("id").values_list("id", flat=True))

    def set_service_account(self, service_account_id: int | None) -> None:
        """Store the control account ID after validating its current cell replica."""
        with transaction.atomic(router.db_for_write(SeerWorkflowConfig)):
            config = SeerWorkflowConfig.objects.select_for_update().get(
                id=self.config.id, organization_id=self.config.organization_id
            )
            if service_account_id is not None:
                try:
                    replica = ServiceAccountReplica.objects.get(
                        service_account_id=service_account_id,
                        organization_id=config.organization_id,
                    )
                except ServiceAccountReplica.DoesNotExist as exc:
                    raise ValueError(
                        "Service account is unavailable in the workflow's organization"
                    ) from exc
                if not replica.is_active:
                    raise ValueError("Service account is inactive")

            if config.service_account_id != service_account_id:
                config.service_account_id = service_account_id
                config.version += 1
                config.save(update_fields=["service_account_id", "version", "date_updated"])

        self.config = config

    def resolve_service_account(self) -> ServiceAccountReplica:
        """Resolve authoritative identity against current cell state on every call."""
        if self.config.service_account_id is None:
            raise ValueError("Workflow has no service account")
        try:
            replica = ServiceAccountReplica.objects.get(
                service_account_id=self.config.service_account_id,
                organization_id=self.config.organization_id,
            )
        except ServiceAccountReplica.DoesNotExist as exc:
            raise ValueError(
                "Service account is unavailable in the workflow's organization"
            ) from exc
        if not replica.is_active:
            raise ValueError("Service account is inactive")
        return replica

    def set_project_selection(self, selection: ProjectSelection) -> None:
        match selection:
            case AllProjects():
                all_projects = True
                project_ids: set[int] = set()
            case SelectedProjects(project_ids=selected):
                all_projects = False
                project_ids = set(selected)
            case _:
                assert_never(selection)

        with transaction.atomic(router.db_for_write(SeerWorkflowConfig)):
            config = SeerWorkflowConfig.objects.select_for_update().get(
                id=self.config.id, organization_id=self.config.organization_id
            )
            if (
                config.strategy == SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
                and not all_projects
            ):
                raise ValueError("Breached metric projects are selected by connecting monitors")
            valid_project_ids = set(
                Project.objects.filter(
                    organization_id=config.organization_id, id__in=project_ids
                ).values_list("id", flat=True)
            )
            if project_ids != valid_project_ids:
                raise ValueError("Selected projects must exist in the workflow's organization")

            SeerWorkflowConfigProject.objects.filter(config=config).delete()
            SeerWorkflowConfigProject.objects.bulk_create(
                [
                    SeerWorkflowConfigProject(config=config, project_id=project_id)
                    for project_id in sorted(project_ids)
                ]
            )
            filters = SeerWorkflowFilters.parse_obj(config.filters)
            filters.all_projects = all_projects
            config.filters = config.filters | filters.dict()
            config.version += 1
            config.save(update_fields=["filters", "version", "date_updated"])

        self.config = config

    def replace_projects(
        self, project_ids: Collection[int], *, editable_project_ids: Collection[int]
    ) -> None:
        """Replace the editable part of the selection, keeping other selected projects."""
        requested = set(project_ids)
        editable = set(editable_project_ids)
        if not requested <= editable:
            raise ValueError("Selected projects must be editable")
        with transaction.atomic(router.db_for_write(SeerWorkflowConfig)):
            config = SeerWorkflowConfig.objects.select_for_update().get(
                id=self.config.id, organization_id=self.config.organization_id
            )
            if config.strategy == SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION:
                raise SeerWorkflowConfigError(
                    "Breached metric projects are selected by connecting monitors"
                )
            if SeerWorkflowFilters.parse_obj(config.filters).all_projects:
                raise SeerWorkflowConfigError("Workflow already includes all projects")
            valid_project_ids = set(
                Project.objects.filter(
                    organization_id=config.organization_id, id__in=requested
                ).values_list("id", flat=True)
            )
            if requested != valid_project_ids:
                raise SeerWorkflowConfigError(
                    "Selected projects must exist in the workflow's organization"
                )

            existing = set(
                SeerWorkflowConfigProject.objects.filter(config=config).values_list(
                    "project_id", flat=True
                )
            )
            selected = (existing - editable) | requested
            removed = existing - selected
            added = selected - existing
            if removed:
                SeerWorkflowConfigProject.objects.filter(
                    config=config, project_id__in=removed
                ).delete()
            if added:
                SeerWorkflowConfigProject.objects.bulk_create(
                    [
                        SeerWorkflowConfigProject(config=config, project_id=project_id)
                        for project_id in sorted(added)
                    ]
                )
            if removed or added:
                config.version += 1
                config.save(update_fields=["version", "date_updated"])

        self.config = config

    def _get_projects(self) -> QuerySet[Project]:
        projects = Project.objects.filter(
            organization_id=self.config.organization_id, status=ObjectStatus.ACTIVE
        )
        if not self.filters.all_projects:
            projects = projects.filter(
                id__in=SeerWorkflowConfigProject.objects.filter(config=self.config).values(
                    "project_id"
                )
            )
        return projects


@dataclass(frozen=True)
class WorkflowRunCreationResult:
    lifecycle: SeerWorkflowRunLifecycle
    created: bool
