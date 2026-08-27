from __future__ import annotations

from collections.abc import Mapping

from sentry.dynamic_sampling.per_org import cache
from sentry.dynamic_sampling.per_org.gate import (
    is_org_in_recalibration_rollout,
    is_org_in_serving_rollout,
)
from sentry.dynamic_sampling.per_org.telemetry import (
    ServedValue,
    ServingSource,
    emit_serving_source,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_projects import (
    get_boost_low_volume_projects_sample_rate,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_transactions import (
    get_transactions_resampling_rates,
)
from sentry.dynamic_sampling.tasks.helpers.recalibrate_orgs import get_adjusted_factor


def _serving_source(org_id: int) -> ServingSource:
    if not is_org_in_serving_rollout(org_id):
        return ServingSource.LEGACY
    if not cache.has_project_rates(org_id):
        return ServingSource.PER_ORG_FALLBACK
    return ServingSource.PER_ORG


def get_project_sample_rate(
    org_id: int, project_id: int, *, error_sample_rate_fallback: float
) -> float:
    source = _serving_source(org_id)
    if source is ServingSource.PER_ORG:
        sample_rate = cache.get_project_sample_rate(org_id, project_id)
        if sample_rate is None:
            emit_serving_source(ServedValue.PROJECT_SAMPLE_RATE, ServingSource.PER_ORG_NO_DATA)
            return 1.0

        emit_serving_source(ServedValue.PROJECT_SAMPLE_RATE, source)
        return sample_rate

    emit_serving_source(ServedValue.PROJECT_SAMPLE_RATE, source)
    legacy_sample_rate, _ = get_boost_low_volume_projects_sample_rate(
        org_id=org_id,
        project_id=project_id,
        error_sample_rate_fallback=error_sample_rate_fallback,
    )
    return legacy_sample_rate


def get_transaction_sample_rates(
    org_id: int, project_id: int, *, default_rate: float
) -> tuple[Mapping[str, float], float]:
    source = _serving_source(org_id)
    emit_serving_source(ServedValue.TRANSACTION_SAMPLE_RATES, source)
    if source is ServingSource.PER_ORG:
        sample_rates = cache.get_transaction_sample_rates(org_id, project_id)
        return sample_rates if sample_rates is not None else ({}, default_rate)

    named_rates, implicit_rate = get_transactions_resampling_rates(
        org_id=org_id, proj_id=project_id, default_rate=default_rate
    )
    return named_rates, implicit_rate


def get_recalibration_factor(org_id: int) -> float:
    source = _serving_source(org_id)
    if source is ServingSource.PER_ORG and not is_org_in_recalibration_rollout(org_id):
        source = ServingSource.LEGACY

    emit_serving_source(ServedValue.RECALIBRATION_FACTOR, source)
    if source is ServingSource.PER_ORG:
        return cache.get_adjusted_factor(org_id, source="serving")

    return get_adjusted_factor(org_id, source="serving")
