from __future__ import annotations

from collections.abc import Mapping

from sentry.dynamic_sampling.per_org import cache
from sentry.dynamic_sampling.per_org.gate import is_org_in_serving_rollout
from sentry.dynamic_sampling.per_org.telemetry import (
    ServedValue,
    ServingSource,
    emit_serving_source,
)
from sentry.dynamic_sampling.tasks.helpers import recalibrate_orgs as legacy_cache
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_projects import (
    get_boost_low_volume_projects_sample_rate,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_transactions import (
    get_transactions_resampling_rates,
)


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


def is_recalibration_factor_served_per_org(org_id: int) -> bool:
    return _serving_source(org_id) is ServingSource.PER_ORG


# Tags the read of the factor an organization was served by the other pipeline.
CARRY_OVER_SOURCE = "carry_over"


def _recalibration_factor(org_id: int, source: ServingSource, *, read_by: str) -> float:
    """The recalibration factor in effect for an organization.

    Since the TTL is 15 minutes, if we are switching from old to new pipeline, we can
    assume that the old factor is still valid. So we can carry over the factor from
    the old pipeline and the other way around. Since we stop computing whichever pipeline
    is not active, we only ever have the factor from the active pipeline or the carry over.
    """
    if source is ServingSource.PER_ORG:
        factor = cache.read_adjusted_factor(org_id, read_by)
        if factor is None:
            factor = legacy_cache.read_adjusted_factor(org_id, CARRY_OVER_SOURCE)
    else:
        factor = legacy_cache.read_adjusted_factor(org_id, read_by)
        if factor is None:
            factor = cache.read_adjusted_factor(org_id, CARRY_OVER_SOURCE)

    return 1.0 if factor is None else factor


def get_recalibration_factor(org_id: int) -> float:
    source = _serving_source(org_id)
    emit_serving_source(ServedValue.RECALIBRATION_FACTOR, source)
    return _recalibration_factor(org_id, source, read_by="serving")


def get_previous_recalibration_factor(org_id: int) -> float:
    """The factor a recalibration pass applies its correction on top of."""
    return _recalibration_factor(org_id, _serving_source(org_id), read_by="task")
