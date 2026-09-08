from __future__ import annotations

from dataclasses import replace
from typing import TYPE_CHECKING, cast

import sentry_sdk

from sentry import options
from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.models.projects_rebalancing import (
    ProjectsRebalancingInput,
    ProjectsRebalancingModel,
)
from sentry.dynamic_sampling.models.transactions_rebalancing import (
    TransactionsRebalancingInput,
    TransactionsRebalancingModel,
)
from sentry.dynamic_sampling.per_org.queries import ProjectTransactionCounts, ProjectVolume
from sentry.dynamic_sampling.per_org.results import TransactionSampleRates
from sentry.dynamic_sampling.sample_rate_override import get_sample_rate_overrides
from sentry.dynamic_sampling.types import OrganizationDataVolume

if TYPE_CHECKING:
    from sentry.dynamic_sampling.per_org.configuration import BaseDynamicSamplingConfiguration


def calculate_recalibration_factor(
    data_volume: OrganizationDataVolume | None,
    previous_factor: float,
    target_sample_rate: float | None,
) -> float | None:
    if (
        target_sample_rate is None
        or target_sample_rate == 0.0
        or data_volume is None
        or not data_volume.is_valid_for_recalibration()
        or previous_factor == 0.0
        or data_volume.indexed is None
        or data_volume.indexed == 0
    ):
        return None

    # This formula aims at scaling the factor proportionally to the ratio of the sample rate we are targeting compared
    # to the effective sample rate of that org. An imbalance in the ratio can be introduced by many factors, including
    # biases that oversample or down sample irrespectively of the incoming volume.
    #
    # Both sides come from the same EAP query, so the stored count cannot exceed the
    # extrapolated total. The clamp keeps a rounded ratio from raising the factor.
    effective_sample_rate = min(1.0, data_volume.indexed / data_volume.total)
    new_factor = previous_factor * (target_sample_rate / effective_sample_rate)
    return new_factor


def run_project_balancing(
    config: BaseDynamicSamplingConfiguration, project_volumes: list[ProjectVolume]
) -> list[RebalancedItem]:
    sample_rate = cast(float, config.get_sample_rate())
    project_ids = {project.id for project in config.projects}
    counts_by_project: dict[int, int] = {}
    for project_volume in project_volumes:
        if project_volume.project_id in project_ids and project_volume.total > 0:
            counts_by_project[project_volume.project_id] = project_volume.total

    # Rule generation serves a 100% org sample rate as-is (get_guarded_project_sample_rate),
    # so every project is sampled in full and a balanced rate would never apply.
    if sample_rate == 1.0:
        return [
            RebalancedItem(
                id=project.id,
                count=counts_by_project.get(project.id, 0),
                new_sample_rate=1.0,
            )
            for project in config.projects
        ]

    # When no project has any volume there is nothing to rebalance, and the model would
    # divide by zero on all-zero counts.
    if not counts_by_project:
        return []

    # Include every project, defaulting those without volume to a count of 0. The model
    # assigns zero-count projects a 100% sample rate, and their presence counts them into
    # the per-project ideal budget.
    return ProjectsRebalancingModel().run(
        ProjectsRebalancingInput(
            classes=[
                RebalancedItem(id=project.id, count=counts_by_project.get(project.id, 0))
                for project in config.projects
            ],
            sample_rate=sample_rate,
        )
    )


def apply_project_sample_rate_overrides(
    rebalanced_projects: list[RebalancedItem],
) -> list[RebalancedItem]:
    """
    Hard-replace the balanced sample rate of any project that has a per-project override
    configured via the ``dynamic-sampling.sample-rate-override-per-project`` option.

    Applied as an explicit step in the scheduler (rather than inside the balancing model)
    so the override is surfaced in the pipeline. The result feeds the cached project
    sample rates and the downstream transaction balancing.
    """
    overrides = get_sample_rate_overrides()
    if not overrides:
        return rebalanced_projects

    return [
        replace(item, new_sample_rate=overrides[int(item.id)])
        if int(item.id) in overrides
        else item
        for item in rebalanced_projects
    ]


def run_transaction_balancing(
    config: BaseDynamicSamplingConfiguration,
    project_volumes: list[ProjectVolume],
    transaction_volumes: list[ProjectTransactionCounts],
) -> TransactionSampleRates:
    sample_rates = config.get_project_sample_rates()
    min_sample_rate = options.get("dynamic-sampling.prioritise_transactions.min_sample_rate")
    intensity = options.get("dynamic-sampling.prioritise_transactions.rebalance_intensity")
    result: TransactionSampleRates = {}
    project_volume_by_id = {
        project_volume.project_id: project_volume for project_volume in project_volumes
    }
    for project_data in transaction_volumes:
        project_id = project_data.project_id
        project_volume = project_volume_by_id.get(project_id)
        if project_volume is None:
            sentry_sdk.capture_message(
                "Project volume not found when trying to adjust the sample rates of "
                "its transactions"
            )
            continue
        sample_rate = sample_rates.get(project_id)
        if sample_rate is None:
            sentry_sdk.capture_message(
                "Sample rate of project not found when trying to adjust the sample rates of "
                "its transactions"
            )
            continue
        # At a 100% project rate every transaction is kept anyway, so there is nothing to
        # balance and no cache entry to write.
        if sample_rate == 1.0:
            continue
        named_rates, implicit_rate = TransactionsRebalancingModel().run(
            TransactionsRebalancingInput(
                classes=[
                    RebalancedItem(id=transaction_name, count=count)
                    for transaction_name, count in project_data.transaction_counts
                ],
                sample_rate=sample_rate,
                total_num_classes=project_volume.num_distinct_transactions,
                total=project_volume.total,
                intensity=intensity,
                min_sample_rate=min_sample_rate,
            )
        )

        result[project_id] = (named_rates, implicit_rate)
    return result
