from __future__ import annotations

import logging
from collections.abc import Iterable
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, cast

import orjson
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
from sentry.dynamic_sampling.per_org.gate import project_balancing_debug_project_ids
from sentry.dynamic_sampling.per_org.queries import (
    ProjectTransactionCounts,
    ProjectVolume,
    get_eap_organization_volume,
    get_generic_metrics_organization_volume,
    get_generic_metrics_transaction_volumes,
    get_outcomes_organization_volume,
)
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.sample_rate_override import get_sample_rate_overrides
from sentry.dynamic_sampling.tasks.common import (
    OrganizationDataVolume,
    compute_sliding_window_sample_rate,
    sample_rate_to_float,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_projects import (
    generate_boost_low_volume_projects_cache_key,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_transactions import (
    generate_boost_low_volume_transactions_cache_key,
)
from sentry.dynamic_sampling.tasks.helpers.sample_rate import get_org_sample_rate
from sentry.dynamic_sampling.tasks.helpers.sliding_window import FALLBACK_SLIDING_WINDOW_SIZE
from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.dynamic_sampling.per_org.configuration import (
        AutomaticDynamicSamplingConfiguration,
        BaseDynamicSamplingConfiguration,
    )

PROJECT_BALANCING_COMPARISON_RELATIVE_TOLERANCE = 0.05
TRANSACTION_BALANCING_COMPARISON_RELATIVE_TOLERANCE = 0.05
REBALANCE_INTENSITY = 0.8
PROJECT_BALANCING_DEBUG_METRIC_PREFIX = "dynamic_sampling.per_org.project_balancing_debug"
SLIDING_WINDOW_METRIC_PREFIX = "dynamic_sampling.per_org.sliding_window"
logger = logging.getLogger(__name__)


def compare_organization_sliding_window_sample_rates(
    config: AutomaticDynamicSamplingConfiguration,
    window: timedelta = timedelta(hours=24),
) -> None:
    end = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
    eap_volume = get_eap_organization_volume(config, time_interval=window, end=end)
    outcomes_volume = get_outcomes_organization_volume(config, time_interval=window, end=end)
    generic_metrics_volume = get_generic_metrics_organization_volume(
        config.organization.id, time_interval=window, end=end
    )

    def sample_rate_for(volume: OrganizationDataVolume | None) -> float | None:
        if volume is None:
            return None
        return compute_sliding_window_sample_rate(
            org_id=config.organization.id,
            project_id=None,
            total_root_count=volume.total,
            window_size=FALLBACK_SLIDING_WINDOW_SIZE,
        )

    eap_sample_rate = sample_rate_for(eap_volume)
    outcomes_sample_rate = sample_rate_for(outcomes_volume)
    generic_metrics_sample_rate = sample_rate_for(generic_metrics_volume)

    tags = {"ds_org": str(config.organization.id)}
    if eap_sample_rate is not None:
        metrics.distribution(
            f"{SLIDING_WINDOW_METRIC_PREFIX}.eap_sample_rate",
            eap_sample_rate,
            sample_rate=1.0,
            tags=tags,
        )
    if outcomes_sample_rate is not None:
        metrics.distribution(
            f"{SLIDING_WINDOW_METRIC_PREFIX}.outcomes_sample_rate",
            outcomes_sample_rate,
            sample_rate=1.0,
            tags=tags,
        )
    if generic_metrics_sample_rate is not None:
        metrics.distribution(
            f"{SLIDING_WINDOW_METRIC_PREFIX}.generic_metrics_sample_rate",
            generic_metrics_sample_rate,
            sample_rate=1.0,
            tags=tags,
        )
    if eap_volume is not None:
        metrics.distribution(
            f"{SLIDING_WINDOW_METRIC_PREFIX}.eap_volume",
            eap_volume.total,
            sample_rate=1.0,
            tags=tags,
        )
        if eap_volume.indexed is not None:
            metrics.distribution(
                f"{SLIDING_WINDOW_METRIC_PREFIX}.eap_volume_without_extrapolation",
                eap_volume.indexed,
                sample_rate=1.0,
                tags=tags,
            )
    if outcomes_volume is not None:
        metrics.distribution(
            f"{SLIDING_WINDOW_METRIC_PREFIX}.outcomes_volume",
            outcomes_volume.total,
            sample_rate=1.0,
            tags=tags,
        )
    if generic_metrics_volume is not None:
        metrics.distribution(
            f"{SLIDING_WINDOW_METRIC_PREFIX}.generic_metrics_volume",
            generic_metrics_volume.total,
            sample_rate=1.0,
            tags=tags,
        )


def run_project_balancing(
    config: BaseDynamicSamplingConfiguration, project_volumes: list[ProjectVolume]
) -> list[RebalancedItem]:
    sample_rate = cast(float, config.get_sample_rate())
    project_ids = {project.id for project in config.projects}
    counts_by_project: dict[int, int] = {}
    for project_volume in project_volumes:
        if project_volume.project_id in project_ids and project_volume.total > 0:
            counts_by_project[project_volume.project_id] = project_volume.total

    # Mirror the legacy serving path (get_guarded_project_sample_rate): a 100% org sample
    # rate means every project is sampled at 100% and the balanced ("boost low volume
    # projects") rate is never applied. Reproduced intentionally to match the legacy pipeline.
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
    # divide by zero on all-zero counts. Matches the legacy pipeline, which returns early.
    if not counts_by_project:
        return []

    # Include every project, defaulting those without volume to a count of 0. The model
    # assigns zero-count projects a 100% sample rate, and their presence keeps the
    # per-project ideal budget identical to the legacy calculation.
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


def get_cached_organization_sample_rate(org_id: int) -> float | None:
    """
    The organization sample rate the legacy (generic metrics) pipeline would serve: the
    cached sliding-window rate, or the target sample rate option for custom sampling orgs.
    Returns None on a cache miss instead of falling back to the blended rate, so the
    comparison logging can distinguish "no cached value" from "cached value equals blended".
    """
    sample_rate, _ = get_org_sample_rate(org_id=org_id, default_sample_rate=None)
    return sample_rate


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
                "ds_proj_id": project_id,
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
                seconds_since_last_item=(
                    project_volume.seconds_since_last_item if project_volume is not None else None
                ),
            )


def _emit_project_balancing_debug_metrics(
    org_id: int,
    project_id: int,
    eap_sample_rate: float,
    generic_metrics_sample_rate: float | None,
    eap_volume: float,
    eap_volume_without_extrapolation: float | None,
    seconds_since_last_item: float | None,
) -> None:
    tags = {"org": str(org_id), "ds_project": str(project_id)}
    metrics.distribution(
        f"{PROJECT_BALANCING_DEBUG_METRIC_PREFIX}.eap_sample_rate",
        eap_sample_rate,
        sample_rate=1.0,
        tags=tags,
    )
    if seconds_since_last_item is not None:
        metrics.distribution(
            f"{PROJECT_BALANCING_DEBUG_METRIC_PREFIX}.eap_seconds_since_last_item",
            seconds_since_last_item,
            sample_rate=1.0,
            tags=tags,
        )
    if generic_metrics_sample_rate is not None:
        metrics.distribution(
            f"{PROJECT_BALANCING_DEBUG_METRIC_PREFIX}.generic_metrics_sample_rate",
            generic_metrics_sample_rate,
            sample_rate=1.0,
            tags=tags,
        )
    metrics.distribution(
        f"{PROJECT_BALANCING_DEBUG_METRIC_PREFIX}.eap_volume",
        eap_volume,
        sample_rate=1.0,
        tags=tags,
    )
    if eap_volume_without_extrapolation is not None:
        metrics.distribution(
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
    min_sample_rate = options.get("dynamic-sampling.prioritise_transactions.min_sample_rate")
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
        # Mirror the legacy pipeline (boost_low_volume_transactions_of_project): at a 100%
        # project rate every transaction is kept anyway, so the legacy task skips the model
        # and writes no cache entry. Skipping here keeps parity and avoids comparison log
        # lines that would only ever hit cache misses.
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
                intensity=REBALANCE_INTENSITY,  # this should use the option like in the old pipeline
                min_sample_rate=min_sample_rate,
            )
        )

        result[project_id] = (named_rates, implicit_rate)
    return result


def get_cached_rebalanced_transaction_sample_rates(
    org_id: int, project_ids: Iterable[int]
) -> dict[int, tuple[dict[str, float], float] | None]:
    redis_client = get_redis_client_for_ds()
    ordered_project_ids = list(project_ids)
    if not ordered_project_ids:
        return {}

    with redis_client.pipeline(transaction=False) as pipeline:
        for project_id in ordered_project_ids:
            pipeline.get(
                generate_boost_low_volume_transactions_cache_key(org_id=org_id, proj_id=project_id)
            )
        serialized_values = pipeline.execute()

    result: dict[int, tuple[dict[str, float], float] | None] = {}
    for project_id, serialized in zip(ordered_project_ids, serialized_values):
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
                "ds_proj_id": project_id,
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
                    "ds_proj_id": project_id,
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


def log_transaction_volume_debug(
    config: BaseDynamicSamplingConfiguration,
    transaction_volumes: list[ProjectTransactionCounts],
    debug_project_ids: set[int],
) -> None:
    """
    Logs the raw per-transaction volumes EAP fed into balancing next to the legacy
    generic-metrics volumes for the same window, for every transaction on either side —
    not just the ones that survived the top-N cutoff and rebalancing model. Used to debug
    discrepancies between the two pipelines' transaction counts directly, since
    ``compare_rebalanced_transactions_with_cache`` only ever sees post-rebalancing sample
    rates for the transactions EAP kept.
    """
    eap_counts_by_project = {
        project_data.project_id: dict(project_data.transaction_counts)
        for project_data in transaction_volumes
        if project_data.project_id in debug_project_ids
    }
    generic_metrics_counts_by_project = get_generic_metrics_transaction_volumes(
        config.organization.id, debug_project_ids
    )

    for project_id in sorted(debug_project_ids):
        eap_counts = eap_counts_by_project.get(project_id, {})
        generic_metrics_counts = dict(generic_metrics_counts_by_project.get(project_id, []))

        transactions = {
            transaction: {
                "eap_volume": eap_counts.get(transaction),
                "generic_metrics_volume": generic_metrics_counts.get(transaction),
            }
            for transaction in eap_counts.keys() | generic_metrics_counts.keys()
        }

        logger.info(
            "dynamic_sampling.per_org.transaction_volume_debug",
            extra={
                "org_id": config.organization.id,
                "ds_proj_id": project_id,
                "transactions": transactions,
            },
        )
