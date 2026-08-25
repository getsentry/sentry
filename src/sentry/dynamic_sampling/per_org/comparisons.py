from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import sentry_sdk

from sentry.constants import SAMPLING_MODE_DEFAULT
from sentry.dynamic_sampling.per_org.cache import (
    get_cached_organization_sample_rate,
    get_cached_rebalanced_project_sample_rates,
    get_cached_rebalanced_transaction_sample_rates,
    get_cached_recalibration_factor,
)
from sentry.dynamic_sampling.per_org.calculations import calculate_recalibration_factor
from sentry.dynamic_sampling.per_org.configuration import (
    AutomaticDynamicSamplingConfiguration,
    BaseDynamicSamplingConfiguration,
)
from sentry.dynamic_sampling.per_org.gate import (
    is_org_in_recalibration_rollout,
    is_org_in_sample_rates_summary_log_rollout,
    project_balancing_debug_project_ids,
    sliding_window_comparison_org_ids,
    transaction_volume_debug_project_ids,
)
from sentry.dynamic_sampling.per_org.queries import (
    RECALIBRATION_TIME_INTERVAL,
    get_eap_organization_volume,
    get_generic_metrics_organization_volume,
    get_generic_metrics_transaction_volumes,
    get_outcomes_organization_volume,
)
from sentry.dynamic_sampling.tasks.common import (
    OrganizationDataVolume,
    compute_sliding_window_sample_rate,
    get_organization_volume,
)
from sentry.dynamic_sampling.tasks.helpers.sliding_window import FALLBACK_SLIDING_WINDOW_SIZE
from sentry.utils import metrics

PROJECT_BALANCING_COMPARISON_RELATIVE_TOLERANCE = 0.05
TRANSACTION_BALANCING_COMPARISON_RELATIVE_TOLERANCE = 0.05
RECALIBRATION_FACTOR_COMPARISON_RELATIVE_TOLERANCE = 0.05
PROJECT_BALANCING_DEBUG_METRIC_PREFIX = "dynamic_sampling.per_org.project_balancing_debug"
SLIDING_WINDOW_METRIC_PREFIX = "dynamic_sampling.per_org.sliding_window"

logger = logging.getLogger(__name__)


def emit_comparisons(config: BaseDynamicSamplingConfiguration) -> None:
    results = config.results
    comparisons: list[Callable[[], None]] = []

    if results.rebalanced_projects:
        comparisons.append(lambda: compare_rebalanced_projects_with_cache(config))
    if config.organization.id in sliding_window_comparison_org_ids() and isinstance(
        config, AutomaticDynamicSamplingConfiguration
    ):
        comparisons.append(lambda: compare_organization_sliding_window_sample_rates(config))
    if results.transaction_volumes:
        comparisons.append(lambda: log_transaction_volume_debug(config))
    if results.rebalanced_transactions:
        comparisons.append(lambda: compare_rebalanced_transactions_with_cache(config))
    if results.project_volumes and is_org_in_sample_rates_summary_log_rollout(
        config.organization.id
    ):
        comparisons.append(lambda: log_sample_rates_summary(config))
    if (
        is_org_in_recalibration_rollout(config.organization.id)
        and config.get_sample_rate() is not None
    ):
        comparisons.append(lambda: compare_recalibration_factor_with_cache(config))

    for comparison in comparisons:
        try:
            comparison()
        except Exception as exc:
            sentry_sdk.capture_exception(exc)


def is_within_relative_tolerance(
    cached_sample_rate: float | None,
    calculated_sample_rate: float,
    relative_tolerance: float = PROJECT_BALANCING_COMPARISON_RELATIVE_TOLERANCE,
) -> bool:
    relative_deviation = get_relative_deviation(cached_sample_rate, calculated_sample_rate)
    if relative_deviation is None:
        return False
    return relative_deviation <= relative_tolerance


def get_relative_deviation(
    cached_sample_rate: float | None, calculated_sample_rate: float
) -> float | None:
    if cached_sample_rate is None:
        return None
    if calculated_sample_rate == 0:
        return 0.0 if cached_sample_rate == 0 else None
    return abs(cached_sample_rate - calculated_sample_rate) / abs(calculated_sample_rate)


def get_effective_sample_rate(volume: OrganizationDataVolume | None) -> float | None:
    if volume is None or volume.indexed is None or volume.total <= 0:
        return None
    return volume.indexed / volume.total


def compare_rebalanced_projects_with_cache(config: BaseDynamicSamplingConfiguration) -> None:
    cached_sample_rates = get_cached_rebalanced_project_sample_rates(config.organization.id)
    rebalanced_projects_by_id = {
        int(project.id): project for project in config.results.rebalanced_projects
    }
    project_volumes_by_id = {
        project_volume.project_id: project_volume
        for project_volume in config.results.project_volumes
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


def compare_rebalanced_transactions_with_cache(config: BaseDynamicSamplingConfiguration) -> None:
    rebalanced_transactions = config.results.rebalanced_transactions
    cached_sample_rates = get_cached_rebalanced_transaction_sample_rates(
        org_id=config.organization.id, project_ids=rebalanced_transactions.keys()
    )

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


def compare_recalibration_factor_with_cache(config: BaseDynamicSamplingConfiguration) -> None:
    results = config.results
    org_volume = results.recalibration_volume
    calculated_factor = results.recalibration_factor
    cached_factor = get_cached_recalibration_factor(config.organization.id)
    legacy_volume = get_organization_volume(
        config.organization.id, time_interval=RECALIBRATION_TIME_INTERVAL
    )
    target_sample_rate = config.get_sample_rate()
    eap_extrapolated_total = (
        None if results.organization_volume is None else results.organization_volume.total
    )

    def same_seed_factor(volume: OrganizationDataVolume | None) -> float | None:
        return calculate_recalibration_factor(volume, cached_factor, target_sample_rate)

    eap_factor_same_seed = same_seed_factor(org_volume)
    generic_metrics_factor_same_seed = same_seed_factor(legacy_volume)

    if calculated_factor is None:
        outcome = "no_eap_factor"
    elif is_within_relative_tolerance(
        cached_factor, calculated_factor, RECALIBRATION_FACTOR_COMPARISON_RELATIVE_TOLERANCE
    ):
        outcome = "equal"
    else:
        outcome = "differs"

    logger.info(
        "dynamic_sampling.per_org.recalibration_factor_comparison",
        extra={
            "org_id": config.organization.id,
            "sampling_mode": config.organization.get_option(
                "sentry:sampling_mode", SAMPLING_MODE_DEFAULT
            ),
            "sample_rate": target_sample_rate,
            "generic_metrics_factor": cached_factor,
            "eap_factor": calculated_factor,
            "previous_eap_factor": results.previous_recalibration_factor,
            "total_transactions": None if org_volume is None else org_volume.total,
            "stored_segments": None if org_volume is None else org_volume.indexed,
            "eap_effective_sample_rate": get_effective_sample_rate(org_volume),
            "eap_extrapolated_total": eap_extrapolated_total,
            "extrapolated_total_relative_deviation": (
                None
                if eap_extrapolated_total is None or org_volume is None
                else get_relative_deviation(eap_extrapolated_total, org_volume.total)
            ),
            "generic_metrics_total": None if legacy_volume is None else legacy_volume.total,
            "generic_metrics_indexed": None if legacy_volume is None else legacy_volume.indexed,
            "generic_metrics_effective_sample_rate": get_effective_sample_rate(legacy_volume),
            "relative_deviation": (
                None
                if calculated_factor is None
                else get_relative_deviation(cached_factor, calculated_factor)
            ),
            "is_equal": outcome == "equal",
            "comparison_outcome": outcome,
            "eap_factor_same_seed": eap_factor_same_seed,
            "generic_metrics_factor_same_seed": generic_metrics_factor_same_seed,
            "same_seed_relative_deviation": (
                None
                if eap_factor_same_seed is None
                else get_relative_deviation(generic_metrics_factor_same_seed, eap_factor_same_seed)
            ),
            "same_seed_is_equal": eap_factor_same_seed is not None
            and is_within_relative_tolerance(
                generic_metrics_factor_same_seed,
                eap_factor_same_seed,
                RECALIBRATION_FACTOR_COMPARISON_RELATIVE_TOLERANCE,
            ),
        },
    )


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


def log_transaction_volume_debug(config: BaseDynamicSamplingConfiguration) -> None:
    debug_project_ids = transaction_volume_debug_project_ids() & {
        project.id for project in config.results.projects_to_balance
    }
    if not debug_project_ids:
        return

    eap_counts_by_project = {
        project_data.project_id: dict(project_data.transaction_counts)
        for project_data in config.results.transaction_volumes
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


def log_sample_rates_summary(config: BaseDynamicSamplingConfiguration) -> None:
    project_sample_rates = config.get_project_sample_rates()
    cached_project_sample_rates = get_cached_rebalanced_project_sample_rates(config.organization.id)
    cached_transaction_sample_rates = get_cached_rebalanced_transaction_sample_rates(
        org_id=config.organization.id,
        project_ids=[project.id for project in config.projects],
    )

    projects_summary = {}
    for project in config.projects:
        project_id = project.id
        eap_named_rates, eap_implicit_rate = config.results.rebalanced_transactions.get(
            project_id, ([], None)
        )
        cached_transactions = cached_transaction_sample_rates.get(project_id)
        generic_metrics_named_rates, generic_metrics_implicit_rate = (
            ({}, None) if cached_transactions is None else cached_transactions
        )
        projects_summary[str(project_id)] = {
            "eap_sample_rate": project_sample_rates.get(project_id),
            "generic_metrics_sample_rate": cached_project_sample_rates.get(project_id),
            "eap_transaction_implicit_sample_rate": eap_implicit_rate,
            "generic_metrics_transaction_implicit_sample_rate": generic_metrics_implicit_rate,
            "eap_transaction_sample_rates": {
                str(item.id): item.new_sample_rate for item in eap_named_rates
            },
            "generic_metrics_transaction_sample_rates": generic_metrics_named_rates,
        }

    logger.info(
        "dynamic_sampling.per_org.sample_rates_summary",
        extra={
            "org_id": config.organization.id,
            "eap_org_sample_rate": config.get_sample_rate(),
            "eap_org_serving_sample_rate": config.get_serving_sample_rate(),
            "generic_metrics_org_sample_rate": get_cached_organization_sample_rate(
                config.organization.id
            ),
            "projects": projects_summary,
        },
    )
