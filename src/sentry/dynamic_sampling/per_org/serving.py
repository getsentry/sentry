"""
The single place where rule generation picks between the legacy (generic metrics) caches and
the per-org (EAP) ones. Each getter returns the value the organization is served, emits which
pipeline supplied it, and falls back to the legacy cache when the per-org pipeline has stored
nothing. Callers get one value and never see the choice.
"""

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


def get_project_sample_rate(
    org_id: int, project_id: int, *, error_sample_rate_fallback: float
) -> float:
    """The balanced sample rate of a project, from whichever pipeline serves it."""
    if is_org_in_serving_rollout(org_id):
        sample_rate = cache.get_project_sample_rate(org_id, project_id)
        if sample_rate is not None:
            emit_serving_source(ServedValue.PROJECT_SAMPLE_RATE, ServingSource.PER_ORG)
            return sample_rate
        emit_serving_source(ServedValue.PROJECT_SAMPLE_RATE, ServingSource.PER_ORG_FALLBACK)
    else:
        emit_serving_source(ServedValue.PROJECT_SAMPLE_RATE, ServingSource.LEGACY)

    legacy_sample_rate, _ = get_boost_low_volume_projects_sample_rate(
        org_id=org_id,
        project_id=project_id,
        error_sample_rate_fallback=error_sample_rate_fallback,
    )
    return legacy_sample_rate


def get_transaction_sample_rates(
    org_id: int, project_id: int, *, default_rate: float
) -> tuple[Mapping[str, float], float]:
    """The named and implicit transaction sample rates of a project.

    An empty mapping means the project has no per-transaction rules, which is what both
    pipelines store for a project they did not balance.
    """
    if is_org_in_serving_rollout(org_id):
        sample_rates = cache.get_transaction_sample_rates(org_id, project_id)
        if sample_rates is not None:
            emit_serving_source(ServedValue.TRANSACTION_SAMPLE_RATES, ServingSource.PER_ORG)
            return sample_rates
        emit_serving_source(ServedValue.TRANSACTION_SAMPLE_RATES, ServingSource.PER_ORG_FALLBACK)
    else:
        emit_serving_source(ServedValue.TRANSACTION_SAMPLE_RATES, ServingSource.LEGACY)

    named_rates, implicit_rate = get_transactions_resampling_rates(
        org_id=org_id, proj_id=project_id, default_rate=default_rate
    )
    return named_rates, implicit_rate


def get_recalibration_factor(org_id: int) -> float:
    """The organization's recalibration factor, from whichever pipeline serves it.

    Unlike the sample rates, a missing per-org factor is not a coverage gap: the identity
    factor is stored by deleting the key. The recalibration rollout gate therefore decides
    the source, so that an organization whose factor the per-org pipeline does not compute
    keeps being recalibrated by the legacy one.
    """
    if is_org_in_serving_rollout(org_id) and is_org_in_recalibration_rollout(org_id):
        emit_serving_source(ServedValue.RECALIBRATION_FACTOR, ServingSource.PER_ORG)
        return cache.get_adjusted_factor(org_id, source="serving")

    emit_serving_source(ServedValue.RECALIBRATION_FACTOR, ServingSource.LEGACY)
    return get_adjusted_factor(org_id, source="serving")
