from __future__ import annotations

from dataclasses import dataclass, field

from sentry.dynamic_sampling.models.common import RebalancedItem

TransactionSampleRates = dict[int, tuple[list[RebalancedItem], float]]


@dataclass
class DynamicSamplingResults:
    """The sample rates one pass of the per-org pipeline computed for an organization.

    Each stage records its output here instead of handing it back to the caller, so that
    the steps which run at the end of the pass — the cache writes and the summary log — read
    one object rather than a chain of arguments. A field left at its default means the stage
    that fills it did not run.
    """

    rebalanced_projects: list[RebalancedItem] = field(default_factory=list)
    rebalanced_transactions: TransactionSampleRates = field(default_factory=dict)
    recalibration_factor: float | None = None
