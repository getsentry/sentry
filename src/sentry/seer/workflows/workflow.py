from __future__ import annotations

from dataclasses import dataclass
from typing import assert_never

from django.db import router, transaction

from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowConfigExtras,
    SeerWorkflowConfigProject,
    SeerWorkflowFilters,
    SeerWorkflowStrategy,
)
from sentry.service_accounts.models import ServiceAccountReplica

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

    def get_project_ids(self) -> list[int]:
        """Return active project IDs matching this workflow's filters, in ascending order."""
        projects = Project.objects.filter(
            organization_id=self.config.organization_id, status=ObjectStatus.ACTIVE
        )
        if not self.filters.all_projects:
            projects = projects.filter(
                id__in=SeerWorkflowConfigProject.objects.filter(config=self.config).values(
                    "project_id"
                )
            )
        return list(projects.order_by("id").values_list("id", flat=True))

    def set_service_account(self, service_account_id: int | None) -> None:
        """Assign by control account ID, storing the corresponding cell replica's PK."""
        with transaction.atomic(router.db_for_write(SeerWorkflowConfig)):
            config = SeerWorkflowConfig.objects.select_for_update().get(
                id=self.config.id, organization_id=self.config.organization_id
            )
            replica = None
            if service_account_id is not None:
                replica = ServiceAccountReplica.objects.filter(
                    service_account_id=service_account_id, organization_id=config.organization_id
                ).first()
                if replica is None:
                    raise ValueError(
                        "Service account is unavailable in the workflow's organization"
                    )
                if not replica.is_active:
                    raise ValueError("Service account is inactive")

            replica_id = replica.id if replica is not None else None
            if config.service_account_id != replica_id:
                config.service_account = replica
                config.version += 1
                config.save(update_fields=["service_account", "version", "date_updated"])

        self.config = config

    def resolve_service_account(self) -> ServiceAccountReplica:
        """Read current cell state without reusing Django's related-object cache."""
        if self.config.service_account_id is None:
            raise ValueError("Workflow has no service account")
        replica = ServiceAccountReplica.objects.filter(
            id=self.config.service_account_id, organization_id=self.config.organization_id
        ).first()
        if replica is None:
            raise ValueError("Service account is unavailable in the workflow's organization")
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
