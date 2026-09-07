from __future__ import annotations

from dataclasses import dataclass, field

from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.per_org.queries import ProjectTransactionCounts, ProjectVolume
from sentry.dynamic_sampling.tasks.common import OrganizationDataVolume
from sentry.models.project import Project

TransactionSampleRates = dict[int, tuple[list[RebalancedItem], float]]


@dataclass
class DynamicSamplingResults:
    """Everything one pass of the per-org pipeline computed for an organization.

    Each stage records its output here instead of handing it back to the caller, so that
    the steps which run at the end of the pass — the comparison logging today, the cache
    writes that will replace it — read one object rather than a chain of arguments. A
    field left at its default means the stage that fills it did not run.
    """

    organization_volume: OrganizationDataVolume | None = None
    project_volumes: list[ProjectVolume] = field(default_factory=list)
    transaction_volumes: list[ProjectTransactionCounts] = field(default_factory=list)
    rebalanced_projects: list[RebalancedItem] = field(default_factory=list)
    projects_to_balance: list[Project] = field(default_factory=list)
    rebalanced_transactions: TransactionSampleRates = field(default_factory=dict)
    previous_recalibration_factor: float = 1.0
    recalibration_factor: float | None = None
