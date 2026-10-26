from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, assert_never

from django.db import router, transaction
from django.db.models import QuerySet
from pydantic import BaseModel

from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowConfigExtras,
    SeerWorkflowConfigProject,
    SeerWorkflowFilters,
    SeerWorkflowRun,
    SeerWorkflowRunExtras,
    SeerWorkflowRunStatus,
    SeerWorkflowStrategy,
    WorkflowRunSnapshot,
)
from sentry.seer.workflows.runs import WorkflowRun
from sentry.utils import json

SEER_DEFAULT_WORKFLOW_STRATEGIES = (SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,)


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
    ) -> tuple[WorkflowRun, bool]:
        """Record an invocation once; retries keep its original snapshot and admission."""
        if not trigger_key or len(trigger_key) > 256:
            raise ValueError("Trigger keys must contain between 1 and 256 characters")

        with transaction.atomic(router.db_for_write(SeerWorkflowRun)):
            self.config = SeerWorkflowConfig.objects.select_for_update().get(
                id=self.config.id, organization_id=self.config.organization_id
            )
            existing = self.get_runs().filter(trigger_key=trigger_key).first()
            if existing is not None:
                return WorkflowRun(existing), False

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
        return WorkflowRun(run), True

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
