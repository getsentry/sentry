from __future__ import annotations

import logging

from sentry.dynamic_sampling.per_org.calculations import (
    PROJECT_BALANCING_COMPARISON_RELATIVE_TOLERANCE,
    RECALIBRATION_FACTOR_COMPARISON_RELATIVE_TOLERANCE,
    TRANSACTION_BALANCING_COMPARISON_RELATIVE_TOLERANCE,
    PerOrgCalculations,
    get_relative_deviation,
    is_within_relative_tolerance,
)
from sentry.dynamic_sampling.per_org.gate import project_balancing_debug_project_ids
from sentry.utils import metrics

PROJECT_BALANCING_DEBUG_METRIC_PREFIX = "dynamic_sampling.per_org.project_balancing_debug"

logger = logging.getLogger(__name__)


def log_comparison_with_legacy_pipeline(calculations: PerOrgCalculations) -> None:
    """
    Reports what a per-org run computed next to what the legacy (generic metrics) pipeline
    cached for the same organization, while both pipelines run side by side.

    This is the only place the per-org pipeline logs from. It reads a finished run and emits,
    so a run behaves the same with or without it and the whole module can go away with the
    legacy pipeline.
    """
    _log_project_balancing(calculations)
    _log_transaction_volume_debug(calculations)
    _log_transaction_balancing(calculations)
    if calculations.summary_log_enabled:
        _log_sample_rates_summary(calculations)
    if calculations.recalibration_ran:
        _log_recalibration_factor(calculations)


def _log_project_balancing(calculations: PerOrgCalculations) -> None:
    org_id = calculations.config.organization.id
    rebalanced_projects_by_id = {
        int(project.id): project for project in calculations.rebalanced_projects
    }
    project_volumes_by_id = {
        project_volume.project_id: project_volume for project_volume in calculations.project_volumes
    }
    debug_project_ids = project_balancing_debug_project_ids()

    for project_id, rebalanced_project in sorted(rebalanced_projects_by_id.items()):
        eap_sample_rate = rebalanced_project.new_sample_rate
        generic_metrics_sample_rate = calculations.cached_project_sample_rates.get(project_id)
        project_volume = project_volumes_by_id.get(project_id)
        eap_volume_without_extrapolation = (
            project_volume.keep if project_volume is not None else None
        )
        logger.info(
            "dynamic_sampling.per_org.project_balancing_comparison",
            extra={
                "org_id": org_id,
                "ds_proj_id": project_id,
                "generic_metrics_sample_rate": generic_metrics_sample_rate,
                "eap_sample_rate": eap_sample_rate,
                "relative_deviation": get_relative_deviation(
                    generic_metrics_sample_rate, eap_sample_rate
                ),
                "is_equal": is_within_relative_tolerance(
                    generic_metrics_sample_rate,
                    eap_sample_rate,
                    PROJECT_BALANCING_COMPARISON_RELATIVE_TOLERANCE,
                ),
                "total_volume_eap": rebalanced_project.count,
                "total_volume_eap_without_extrapolation": eap_volume_without_extrapolation,
            },
        )
        if project_id in debug_project_ids:
            _emit_project_balancing_debug_metrics(
                org_id=org_id,
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


def _log_transaction_volume_debug(calculations: PerOrgCalculations) -> None:
    for debug in calculations.transaction_volume_debug:
        logger.info(
            "dynamic_sampling.per_org.transaction_volume_debug",
            extra={
                "org_id": calculations.config.organization.id,
                "ds_proj_id": debug.project_id,
                "transactions": {
                    transaction: {
                        "eap_volume": debug.eap_volumes.get(transaction),
                        "generic_metrics_volume": debug.generic_metrics_volumes.get(transaction),
                    }
                    for transaction in debug.eap_volumes.keys()
                    | debug.generic_metrics_volumes.keys()
                },
            },
        )


def _log_transaction_balancing(calculations: PerOrgCalculations) -> None:
    org_id = calculations.config.organization.id

    for project_id, (named_rates, eap_implicit_rate) in sorted(
        calculations.rebalanced_transactions.items()
    ):
        cached = calculations.cached_transaction_sample_rates.get(project_id)
        generic_metrics_named_rates: dict[str, float] = {} if cached is None else cached[0]
        generic_metrics_implicit_rate = None if cached is None else cached[1]

        logger.info(
            "dynamic_sampling.per_org.transaction_balancing_implicit_comparison",
            extra={
                "org_id": org_id,
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
                    "org_id": org_id,
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


def _log_recalibration_factor(calculations: PerOrgCalculations) -> None:
    calculated_factor = calculations.recalibration_factor
    cached_factor = calculations.cached_recalibration_factor
    logger.info(
        "dynamic_sampling.per_org.recalibration_factor_comparison",
        extra={
            "org_id": calculations.config.organization.id,
            "sample_rate": calculations.config.get_sample_rate(),
            "generic_metrics_factor": cached_factor,
            "eap_factor": calculated_factor,
            "relative_deviation": (
                None
                if calculated_factor is None
                else get_relative_deviation(cached_factor, calculated_factor)
            ),
            "is_equal": calculated_factor is not None
            and is_within_relative_tolerance(
                cached_factor,
                calculated_factor,
                RECALIBRATION_FACTOR_COMPARISON_RELATIVE_TOLERANCE,
            ),
        },
    )


def _log_sample_rates_summary(calculations: PerOrgCalculations) -> None:
    """
    One line per org per cycle with the org, project and transaction sample rates of both
    the EAP and the generic metrics (legacy) pipeline, for side-by-side comparison without
    having to join the per-project and per-transaction comparison logs.
    """
    config = calculations.config
    project_sample_rates = calculations.project_sample_rates
    projects_summary = {}
    for project in config.projects:
        project_id = project.id
        eap_named_rates, eap_implicit_rate = calculations.rebalanced_transactions.get(
            project_id, ([], None)
        )
        cached_transactions = calculations.cached_transaction_sample_rates.get(project_id)
        generic_metrics_named_rates, generic_metrics_implicit_rate = (
            ({}, None) if cached_transactions is None else cached_transactions
        )
        projects_summary[str(project_id)] = {
            "eap_sample_rate": project_sample_rates.get(project_id),
            "generic_metrics_sample_rate": calculations.cached_project_sample_rates.get(project_id),
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
            "generic_metrics_org_sample_rate": calculations.cached_organization_sample_rate,
            "projects": projects_summary,
        },
    )
