from __future__ import annotations

from dataclasses import dataclass
from functools import cached_property

from django.db import router, transaction

from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowConfigProject,
    SeerWorkflowFilters,
    SeerWorkflowStrategy,
)

# Strategies every organization gets one Sentry-seeded automation for.
SEER_DEFAULT_AUTOMATION_STRATEGIES = (SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,)


@dataclass
class SeerAutomation:
    """Business logic for a Seer automation, over its stored SeerWorkflowConfig."""

    config: SeerWorkflowConfig

    @classmethod
    def ensure_defaults(cls, organization_id: int) -> None:
        """Create any missing default automations for the organization.

        A default is missing only when the organization has no config at all with that strategy,
        so customer-created, edited and disabled configs are never overwritten or re-seeded.
        """
        if not _missing_default_strategies(organization_id):
            return

        with transaction.atomic(router.db_for_write(SeerWorkflowConfig)):
            # Serializes concurrent seeding for the organization, since configurable strategies
            # have no uniqueness constraint to deduplicate on.
            list(Organization.objects.select_for_update().filter(id=organization_id))
            for strategy in _missing_default_strategies(organization_id):
                SeerWorkflowConfig.objects.create(
                    organization_id=organization_id,
                    strategy=strategy.value,
                    filters={"all_projects": True},
                    extras={"seeded_default": strategy.value},
                )

    @cached_property
    def filters(self) -> SeerWorkflowFilters:
        return SeerWorkflowFilters.parse_obj(self.config.filters)

    def get_project_ids(self) -> list[int]:
        """Active projects this config covers now, in ascending order.

        All projects covers every active project of the organization, including ones created
        later. Selected projects cover only those still active, so the list is empty once none
        remain. It never widens to all projects. Check the all_projects filter to tell an empty
        selection from an organization without active projects.
        """
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


def _missing_default_strategies(organization_id: int) -> list[SeerWorkflowStrategy]:
    existing = set(
        SeerWorkflowConfig.objects.filter(
            organization_id=organization_id,
            strategy__in=[s.value for s in SEER_DEFAULT_AUTOMATION_STRATEGIES],
        ).values_list("strategy", flat=True)
    )
    return [s for s in SEER_DEFAULT_AUTOMATION_STRATEGIES if s.value not in existing]
