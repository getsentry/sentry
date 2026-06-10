from __future__ import annotations

import logging
from collections.abc import Iterable
from typing import TYPE_CHECKING, cast

import orjson
import sentry_sdk

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
from sentry.dynamic_sampling.per_org.gate import project_balancing_debug_project_ids
from sentry.dynamic_sampling.per_org.queries import ProjectTransactionCounts, ProjectVolume
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.common import sample_rate_to_float
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_projects import (
    generate_boost_low_volume_projects_cache_key,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_transactions import (
    generate_boost_low_volume_transactions_cache_key,
)
from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.dynamic_sampling.per_org.configuration import BaseDynamicSamplingConfiguration

PROJECT_BALANCING_COMPARISON_RELATIVE_TOLERANCE = 0.05
TRANSACTION_BALANCING_COMPARISON_RELATIVE_TOLERANCE = 0.05
REBALANCE_INTENSITY = 0.8
PROJECT_BALANCING_DEBUG_METRIC_PREFIX = "dynamic_sampling.per_org.project_balancing_debug"
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
    project_volumes: list[ProjectVolume],
) -> None:
    rebalanced_projects_by_id = {int(project.id): project for project in rebalanced_projects}
    project_volumes_by_id = {
        project_volume.project_id: project_volume for project_volume in project_volumes
    }
    debug_project_ids = project_balancing_debug_project_ids()

    for project_id, rebalanced_project in sorted(rebalanced_projects_by_id.items()):
        eap_sample_rate = rebalanced_project.new_sample_rate
        generic_metrics_sample_rate = cached_sample_rates.get(project_id)
        project_volume = project_volumes_by_id.get(project_id)
        eap_volume_without_extrapolation = (
            project_volume.keep if project_volume is not None else None
        )
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
                "total_volume_eap": rebalanced_project.count,
                "total_volume_eap_without_extrapolation": eap_volume_without_extrapolation,
            },
        )
        if project_id in debug_project_ids:
            _emit_project_balancing_debug_metrics(
                org_id=config.organization.id,
                project_id=project_id,
                eap_sample_rate=eap_sample_rate,
                generic_metrics_sample_rate=generic_metrics_sample_rate,
                eap_volume=rebalanced_project.count,
                eap_volume_without_extrapolation=eap_volume_without_extrapolation,
            )


def _emit_project_balancing_debug_metrics(
    org_id: int,
    project_id: int,
    eap_sample_rate: float,
    generic_metrics_sample_rate: float | None,
    eap_volume: float,
    eap_volume_without_extrapolation: float | None,
) -> None:
    tags = {"org_id": str(org_id), "project_id": str(project_id)}
    metrics.gauge(
        f"{PROJECT_BALANCING_DEBUG_METRIC_PREFIX}.eap_sample_rate",
        eap_sample_rate,
        sample_rate=1.0,
        tags=tags,
    )
    if generic_metrics_sample_rate is not None:
        metrics.gauge(
            f"{PROJECT_BALANCING_DEBUG_METRIC_PREFIX}.generic_metrics_sample_rate",
            generic_metrics_sample_rate,
            sample_rate=1.0,
            tags=tags,
        )
    metrics.gauge(
        f"{PROJECT_BALANCING_DEBUG_METRIC_PREFIX}.eap_volume",
        eap_volume,
        sample_rate=1.0,
        tags=tags,
    )
    if eap_volume_without_extrapolation is not None:
        metrics.gauge(
            f"{PROJECT_BALANCING_DEBUG_METRIC_PREFIX}.eap_volume_without_extrapolation",
            eap_volume_without_extrapolation,
            sample_rate=1.0,
            tags=tags,
        )


def run_transaction_balancing(
    config: BaseDynamicSamplingConfiguration,
    project_volumes: list[ProjectVolume],
    transaction_volumes: list[ProjectTransactionCounts],
) -> dict[int, tuple[list[RebalancedItem], float]]:
    sample_rates = config.get_project_sample_rates()
    result: dict[int, tuple[list[RebalancedItem], float]] = {}
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
        named_rates, implicit_rate = TransactionsRebalancingModel().run(
            TransactionsRebalancingInput(
                classes=[
                    RebalancedItem(id=transaction_name, count=count)
                    for transaction_name, count in project_data.transaction_counts
                ],
                sample_rate=sample_rate,
                total_num_classes=project_volume.num_distinct_transactions,
                total=project_volume.total,
                intensity=REBALANCE_INTENSITY,
            )
        )

        if implicit_rate < sample_rate:
            named_rates, implicit_rate = _apply_implicit_sample_rate_floor(
                named_rates=named_rates,
                implicit_sample_rate=implicit_rate,
                floor_sample_rate=sample_rate,
                total_volume=project_volume.total,
            )

        result[project_id] = (named_rates, implicit_rate)
    return result


def _apply_implicit_sample_rate_floor(
    named_rates: list[RebalancedItem],
    implicit_sample_rate: float,
    floor_sample_rate: float,
    total_volume: int,
) -> tuple[list[RebalancedItem], float]:
    total_explicit_volume = sum(item.count for item in named_rates)
    total_implicit_volume = total_volume - total_explicit_volume
    if total_explicit_volume <= 0 or total_implicit_volume <= 0:
        return named_rates, floor_sample_rate

    additional_implicit_volume = (floor_sample_rate - implicit_sample_rate) * total_implicit_volume
    previously_used_explicit_volume = sum(item.count * item.new_sample_rate for item in named_rates)
    new_explicit_volume = previously_used_explicit_volume - additional_implicit_volume

    if new_explicit_volume <= 0:
        return [], floor_sample_rate

    new_explicit_sample_rate = new_explicit_volume / total_explicit_volume
    new_rates, _ = FullRebalancingModel().run(
        FullRebalancingInput(
            classes=[RebalancedItem(id=item.id, count=item.count) for item in named_rates],
            sample_rate=new_explicit_sample_rate,
            intensity=REBALANCE_INTENSITY,
        )
    )
    return new_rates, floor_sample_rate


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
