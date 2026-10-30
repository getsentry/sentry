from __future__ import annotations

from collections.abc import Iterator, Mapping
from contextlib import contextmanager
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
from sentry.seer.workflows.runs import SeerWorkflowRunLifecycle
from sentry.service_accounts.models import ServiceAccountReplica
from sentry.utils import json

SEER_DEFAULT_WORKFLOW_STRATEGIES = (SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,)


@dataclass(frozen=True)
class AllProjects:
    pass


@dataclass(frozen=True)
class SelectedProjects:
    project_ids: tuple[int, ...]


type ProjectSelection = AllProjects | SelectedProjects


@dataclass(frozen=True, kw_only=True)
class SeerWorkflow:
    """Apply each change to fresh state under the workflow config's row lock.

    Returned models do not carry a lock or refresh automatically. Configuration
    changes, including project selection, should go through these methods.
    """

    config_id: int
    organization_id: int

    @classmethod
    def ensure_defaults(cls, organization_id: int) -> None:
        """Seed defaults for strategies with no config; disabled configs count as existing."""
        database = router.db_for_write(SeerWorkflowConfig)
        configs = SeerWorkflowConfig.objects.using(database).filter(
            organization_id=organization_id,
            strategy__in=[s.value for s in SEER_DEFAULT_WORKFLOW_STRATEGIES],
        )
        existing = set(configs.values_list("strategy", flat=True))
        if all(s.value in existing for s in SEER_DEFAULT_WORKFLOW_STRATEGIES):
            return

        with transaction.atomic(database):
            # Prevent duplicate seeds without a uniqueness constraint on configurable strategies.
            list(
                Organization.objects.using(database).select_for_update().filter(id=organization_id)
            )
            existing = set(configs.values_list("strategy", flat=True))
            SeerWorkflowConfig.objects.using(database).bulk_create(
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

    def get_config(self) -> SeerWorkflowConfig:
        """Fetch the config without acquiring a lock."""
        return self._config_queryset().get()

    @property
    def extras(self) -> SeerWorkflowConfigExtras:
        return SeerWorkflowConfigExtras.parse_obj(self.get_config().extras)

    @property
    def filters(self) -> SeerWorkflowFilters:
        return SeerWorkflowFilters.parse_obj(self.get_config().filters)

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

        with self._lock_config() as config:
            existing = self.get_runs().filter(trigger_key=trigger_key).first()
            if existing is not None:
                return WorkflowRunCreationResult(
                    lifecycle=SeerWorkflowRunLifecycle(
                        run_id=existing.id, organization_id=existing.organization_id
                    ),
                    created=False,
                )

            snapshot = WorkflowRunSnapshot(
                config_version=config.version,
                strategy=SeerWorkflowStrategy(config.strategy),
                filters=config.filters,
                project_ids=tuple(self._get_project_ids(config)),
                output_policy=config.output_policy,
                inputs=json.loads(inputs.json()),
            )
            run_extras = SeerWorkflowRunExtras.parse_obj({**(extras or {}), "snapshot": snapshot})
            run = SeerWorkflowRun.objects.create(
                organization_id=config.organization_id,
                workflow_config=config,
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
        return (
            SeerWorkflowRun.objects.using(router.db_for_write(SeerWorkflowRun))
            .filter(organization_id=self.organization_id, workflow_config_id=self.config_id)
            .order_by("-date_added", "-id")
        )

    def matches_scope(self, project_id: int, environment: str | None) -> bool:
        """Check the automation's scope before recording an admission decision."""
        return self._matches_scope(self.get_config(), project_id, environment)

    def has_quota_available(self) -> bool:
        """Allow runs until automation quota enforcement is implemented."""
        # TODO(telkins): Enforce automation quota before accepting a new run.
        return True

    def get_project_ids(self) -> list[int]:
        """Return active project IDs matching this workflow's filters, in ascending order."""
        return self._get_project_ids(self.get_config())

    def set_service_account(self, service_account_id: int | None) -> None:
        """Store the control account ID after validating its current cell replica."""
        with self._lock_config() as config:
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

    def resolve_service_account(self) -> ServiceAccountReplica:
        """Resolve authoritative identity against current cell state on every call."""
        config = self.get_config()
        if config.service_account_id is None:
            raise ValueError("Workflow has no service account")
        try:
            replica = ServiceAccountReplica.objects.get(
                service_account_id=config.service_account_id,
                organization_id=config.organization_id,
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

        with self._lock_config() as config:
            if config.strategy == SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION:
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

    @contextmanager
    def _lock_config(self) -> Iterator[SeerWorkflowConfig]:
        with transaction.atomic(router.db_for_write(SeerWorkflowConfig)):
            yield self._config_queryset().select_for_update().get()

    def _config_queryset(self) -> QuerySet[SeerWorkflowConfig]:
        return SeerWorkflowConfig.objects.using(router.db_for_write(SeerWorkflowConfig)).filter(
            id=self.config_id, organization_id=self.organization_id
        )

    def _matches_scope(
        self, config: SeerWorkflowConfig, project_id: int, environment: str | None
    ) -> bool:
        """Check scope using a config snapshot without modifying it or acquiring a lock."""
        filters = SeerWorkflowFilters.parse_obj(config.filters)
        return (
            config.enabled
            and (not filters.environments or environment in filters.environments)
            and self._get_projects(config).filter(id=project_id).exists()
        )

    def _get_project_ids(self, config: SeerWorkflowConfig) -> list[int]:
        return list(self._get_projects(config).order_by("id").values_list("id", flat=True))

    def _get_projects(self, config: SeerWorkflowConfig) -> QuerySet[Project]:
        """Return active projects in the config's scope; strategies may derive it differently."""
        projects = Project.objects.filter(
            organization_id=config.organization_id, status=ObjectStatus.ACTIVE
        )
        if not SeerWorkflowFilters.parse_obj(config.filters).all_projects:
            projects = projects.filter(
                id__in=SeerWorkflowConfigProject.objects.filter(config=config).values("project_id")
            )
        return projects


@dataclass(frozen=True)
class WorkflowRunCreationResult:
    lifecycle: SeerWorkflowRunLifecycle
    created: bool
