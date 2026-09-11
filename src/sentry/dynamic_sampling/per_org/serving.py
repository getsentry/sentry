from __future__ import annotations

from collections.abc import Mapping

from sentry.dynamic_sampling.per_org import cache
from sentry.dynamic_sampling.per_org.telemetry import (
    ServedValue,
    ServingSource,
    emit_serving_source,
)


def get_project_sample_rate(org_id: int, project_id: int) -> float:
    """The balanced sample rate of a project, or 1.0 while no pass has stored one."""
    sample_rate = cache.get_project_sample_rate(org_id, project_id)
    if sample_rate is None:
        emit_serving_source(ServedValue.PROJECT_SAMPLE_RATE, ServingSource.PER_ORG_NO_DATA)
        return 1.0

    emit_serving_source(ServedValue.PROJECT_SAMPLE_RATE, ServingSource.PER_ORG)
    return sample_rate


def get_transaction_sample_rates(
    org_id: int, project_id: int, *, default_rate: float
) -> tuple[Mapping[str, float], float]:
    emit_serving_source(ServedValue.TRANSACTION_SAMPLE_RATES, ServingSource.PER_ORG)
    sample_rates = cache.get_transaction_sample_rates(org_id, project_id)
    return sample_rates if sample_rates is not None else ({}, default_rate)


def get_recalibration_factor(org_id: int) -> float:
    emit_serving_source(ServedValue.RECALIBRATION_FACTOR, ServingSource.PER_ORG)
    return cache.get_adjusted_factor(org_id, "serving")


def get_previous_recalibration_factor(org_id: int) -> float:
    """The factor a recalibration pass applies its correction on top of."""
    return cache.get_adjusted_factor(org_id, "task")
