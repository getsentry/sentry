from __future__ import annotations

import logging
from collections.abc import Iterable
from typing import cast

import orjson
import sentry_sdk

from sentry import options
from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.models.full_rebalancing import (
    FullRebalancingInput,
    FullRebalancingModel,
)
from sentry.dynamic_sampling.models.projects_rebalancing import (
    ProjectsRebalancingInput,
    ProjectsRebalancingModel,
)
from sentry.dynamic_sampling.models.transactions_rebalancing import (
    TransactionsRebalancingInput,
    TransactionsRebalancingModel,
)
from sentry.dynamic_sampling.per_org.configuration import BaseDynamicSamplingConfiguration
from sentry.dynamic_sampling.per_org.queries import ProjectTransactionCounts, ProjectVolume
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.common import sample_rate_to_float
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_projects import (
    generate_boost_low_volume_projects_cache_key,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_transactions import (
    generate_boost_low_volume_transactions_cache_key,
)

PROJECT_BALANCING_COMPARISON_RELATIVE_TOLERANCE = 0.05
TRANSACTION_BALANCING_COMPARISON_RELATIVE_TOLERANCE = 0.05
logger = logging.getLogger(__name__)


def run_project_balancing(
    config: BaseDynamicSamplingConfiguration, project_volumes: list[ProjectVolume]
) -> list[RebalancedItem]:
    sample_rate = cast(float, config.get_sample_rate())
    project_ids = {project.id for project in config.projects}
    counts_by_project: dict[int, int] = {}
    for project_volume in project_volumes:
        if project_volume.project_id in project_ids and project_volume.total > 0:
            counts_by_project[project_volume.project_id] = project_volume.total
    return ProjectsRebalancingModel().run(
        ProjectsRebalancingInput(
            classes=[
                RebalancedItem(id=project.id, count=counts_by_project[project.id])
                for project in config.projects
                if project.id in counts_by_project
            ],
            sample_rate=sample_rate,
        )
    )


def get_cached_rebalanced_project_sample_rates(org_id: int) -> dict[int, float | None]:
    redis_client = get_redis_client_for_ds()
    cache_key = generate_boost_low_volume_projects_cache_key(org_id=org_id)
    return {
        int(project_id): sample_rate_to_float(sample_rate)
        for project_id, sample_rate in redis_client.hgetall(cache_key).items()
    }


def is_within_relative_tolerance(
    cached_sample_rate: float | None,
    calculated_sample_rate: float,
    relative_tolerance: float = PROJECT_BALANCING_COMPARISON_RELATIVE_TOLERANCE,
) -> bool:
    relative_deviation = get_relative_deviation(cached_sample_rate, calculated_sample_rate)
    if relative_deviation is None:
        return False
    return relative_deviation <= relative_tolerance + 1e-12


def get_relative_deviation(
    cached_sample_rate: float | None, calculated_sample_rate: float
) -> float | None:
    if cached_sample_rate is None:
        return None
    if calculated_sample_rate == 0:
        return 0.0 if abs(cached_sample_rate) <= 1e-12 else None
    return abs(cached_sample_rate - calculated_sample_rate) / abs(calculated_sample_rate)


def compare_rebalanced_projects_with_cache(
    config: BaseDynamicSamplingConfiguration,
    rebalanced_projects: list[RebalancedItem],
    cached_sample_rates: dict[int, float | None],
) -> None:
    calculated_sample_rates = {
        int(project.id): project.new_sample_rate for project in rebalanced_projects
    }

    for project_id, eap_sample_rate in sorted(calculated_sample_rates.items()):
        generic_metrics_sample_rate = cached_sample_rates.get(project_id)
        logger.info(
            "dynamic_sampling.per_org.project_balancing_comparison",
            extra={
                "org_id": config.organization.id,
                "project_id": project_id,
                "generic_metrics_sample_rate": generic_metrics_sample_rate,
                "eap_sample_rate": eap_sample_rate,
                "relative_deviation": get_relative_deviation(
                    generic_metrics_sample_rate, eap_sample_rate
                ),
                "is_equal": is_within_relative_tolerance(
                    generic_metrics_sample_rate, eap_sample_rate
                ),
            },
        )


def run_transaction_balancing(
    config: BaseDynamicSamplingConfiguration,
    project_volumes: list[ProjectVolume],
    transaction_volumes: list[ProjectTransactionCounts],
) -> dict[int, tuple[list[RebalancedItem], float]]:
    intensity = options.get("dynamic-sampling.prioritise_transactions.rebalance_intensity")
    min_implicit_factor = config.min_implicit_factor
    sample_rates = config.get_project_sample_rates()
    result: dict[int, tuple[list[RebalancedItem], float]] = {}
    project_volume_by_id = {
        project_volume.project_id: project_volume for project_volume in project_volumes
    }
    for project_data in transaction_volumes:
        project_id = project_data.project_id
        project_volume = project_volume_by_id[project_data.project_id]
        sample_rate = sample_rates.get(project_id)
        if sample_rate is None:
            sentry_sdk.capture_message(
                "Sample rate of project not found when trying to adjust the sample rates of "
                "its transactions"
            )
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
            )
        )
        named_rates, implicit_rate = _apply_implicit_factor_floor(
            named_rates=named_rates,
            implicit_rate=implicit_rate,
            base_sample_rate=sample_rate,
            total=project_volume.total,
            min_implicit_factor=min_implicit_factor,
            intensity=intensity,
        )
        result[project_id] = (named_rates, implicit_rate)
    return result


def _apply_implicit_factor_floor(
    named_rates: list[RebalancedItem],
    implicit_rate: float,
    base_sample_rate: float,
    total: float | None,
    min_implicit_factor: float,
    intensity: float,
) -> tuple[list[RebalancedItem], float]:
    """Clamp the implicit factor to at least ``min_implicit_factor`` by reducing
    the explicit pool's budget by the same amount the implicit pool gains.

    The floor expressed as a *factor* is ``min_implicit_factor`` — i.e. the
    floor on ``implicit_rate / base_sample_rate``. Setting it to 1.0 guarantees
    that the long-tail bucket is sampled at least at the project's base rate.

    Conservation holds when ``min_implicit_factor * total_implicit <= total``
    (always true when ``min_implicit_factor <= 1``). In the pathological case
    where the requested floor would consume more than the total budget, the
    explicit pool drops to rate 0 and some overshoot remains; callers should
    rely on the recalibration loop to absorb the residual.
    """
    if min_implicit_factor <= 0.0:
        return named_rates, implicit_rate

    floor = min_implicit_factor * base_sample_rate
    if implicit_rate >= floor or total is None:
        return named_rates, implicit_rate

    total_explicit = sum(item.count for item in named_rates)
    total_implicit = total - total_explicit
    if total_explicit <= 0 or total_implicit <= 0:
        return named_rates, floor

    # Budget the implicit pool would consume at the floor, minus what the model
    # had already allocated to it. The explicit pool pays the difference.
    additional_implicit = (floor - implicit_rate) * total_implicit
    original_explicit_used = sum(item.count * item.new_sample_rate for item in named_rates)
    new_explicit_budget = original_explicit_used - additional_implicit

    if new_explicit_budget <= 0:
        zeroed = [
            RebalancedItem(id=item.id, count=item.count, new_sample_rate=0.0)
            for item in named_rates
        ]
        return zeroed, floor

    new_explicit_rate = new_explicit_budget / total_explicit
    new_rates, _ = FullRebalancingModel().run(
        FullRebalancingInput(
            classes=[RebalancedItem(id=item.id, count=item.count) for item in named_rates],
            sample_rate=new_explicit_rate,
            intensity=intensity,
        )
    )
    return new_rates, floor


def get_cached_rebalanced_transaction_sample_rates(
    org_id: int, project_ids: Iterable[int]
) -> dict[int, tuple[dict[str, float], float] | None]:
    redis_client = get_redis_client_for_ds()
    result: dict[int, tuple[dict[str, float], float] | None] = {}
    for project_id in project_ids:
        cache_key = generate_boost_low_volume_transactions_cache_key(
            org_id=org_id, proj_id=project_id
        )
        serialized = redis_client.get(cache_key)
        if serialized is None:
            result[project_id] = None
            continue
        try:
            named_rates, implicit_rate = orjson.loads(serialized)
        except (TypeError, ValueError) as e:
            sentry_sdk.capture_exception(e)
            result[project_id] = None
            continue
        result[project_id] = (named_rates, float(implicit_rate))
    return result


def compare_rebalanced_transactions_with_cache(
    config: BaseDynamicSamplingConfiguration,
    rebalanced_transactions: dict[int, tuple[list[RebalancedItem], float]],
    cached_sample_rates: dict[int, tuple[dict[str, float], float] | None],
) -> None:
    for project_id, (named_rates, eap_implicit_rate) in sorted(rebalanced_transactions.items()):
        cached = cached_sample_rates.get(project_id)
        generic_metrics_named_rates: dict[str, float] = {} if cached is None else cached[0]
        generic_metrics_implicit_rate = None if cached is None else cached[1]

        logger.info(
            "dynamic_sampling.per_org.transaction_balancing_implicit_comparison",
            extra={
                "org_id": config.organization.id,
                "project_id": project_id,
                "generic_metrics_implicit_rate": generic_metrics_implicit_rate,
                "eap_implicit_rate": eap_implicit_rate,
                "relative_deviation": get_relative_deviation(
                    generic_metrics_implicit_rate, eap_implicit_rate
                ),
                "is_equal": is_within_relative_tolerance(
                    generic_metrics_implicit_rate,
                    eap_implicit_rate,
                    TRANSACTION_BALANCING_COMPARISON_RELATIVE_TOLERANCE,
                ),
            },
        )

        for item in named_rates:
            transaction = str(item.id)
            generic_metrics_rate = generic_metrics_named_rates.get(transaction)
            logger.info(
                "dynamic_sampling.per_org.transaction_balancing_comparison",
                extra={
                    "org_id": config.organization.id,
                    "project_id": project_id,
                    "transaction": transaction,
                    "generic_metrics_sample_rate": generic_metrics_rate,
                    "eap_sample_rate": item.new_sample_rate,
                    "relative_deviation": get_relative_deviation(
                        generic_metrics_rate, item.new_sample_rate
                    ),
                    "is_equal": is_within_relative_tolerance(
                        generic_metrics_rate,
                        item.new_sample_rate,
                        TRANSACTION_BALANCING_COMPARISON_RELATIVE_TOLERANCE,
                    ),
                },
            )
