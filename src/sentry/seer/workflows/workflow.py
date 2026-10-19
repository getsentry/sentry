from __future__ import annotations

from dataclasses import dataclass
from functools import cached_property

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

SEER_DEFAULT_WORKFLOW_STRATEGIES = (SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,)


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
            for strategy in SEER_DEFAULT_WORKFLOW_STRATEGIES:
                if strategy.value in existing:
                    continue
                SeerWorkflowConfig.objects.create(
                    organization_id=organization_id,
                    strategy=strategy.value,
                    filters={"all_projects": True},
                    extras=SeerWorkflowConfigExtras(seeded_default=strategy).dict(
                        exclude_none=True
                    ),
                )

    @cached_property
    def extras(self) -> SeerWorkflowConfigExtras:
        return SeerWorkflowConfigExtras.parse_obj(self.config.extras)

    @cached_property
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
