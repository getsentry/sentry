from __future__ import annotations

from collections.abc import Mapping

from sentry.constants import TARGET_SAMPLE_RATE_DEFAULT
from sentry.dynamic_sampling.per_org import cache
from sentry.dynamic_sampling.per_org.telemetry import (
    ServedValue,
    ServingSource,
    emit_serving_source,
)
from sentry.dynamic_sampling.utils import has_custom_dynamic_sampling
from sentry.models.organization import Organization


def get_project_sample_rate(
    org_id: int, project_id: int, *, error_sample_rate_fallback: float
) -> float:
    """The balanced sample rate of a project.

    A project the last pass did not reach had no volume, so it is sampled in full. An
    organization without any stored project rates has not been through a pass yet, so its
    projects serve the fallback rate.
    """
    sample_rate = cache.get_project_sample_rate(org_id, project_id)
    if sample_rate is not None:
        emit_serving_source(ServedValue.PROJECT_SAMPLE_RATE, ServingSource.PER_ORG)
        return sample_rate

    if cache.has_project_rates(org_id):
        emit_serving_source(ServedValue.PROJECT_SAMPLE_RATE, ServingSource.PER_ORG_NO_DATA)
        return 1.0

    emit_serving_source(ServedValue.PROJECT_SAMPLE_RATE, ServingSource.PER_ORG_FALLBACK)
    return error_sample_rate_fallback


def get_transaction_sample_rates(
    org_id: int, project_id: int, *, default_rate: float
) -> tuple[Mapping[str, float], float]:
    """The named and implicit transaction sample rates of a project.

    A project without stored rates samples every transaction at the default rate.
    """
    sample_rates = cache.get_transaction_sample_rates(org_id, project_id)
    if sample_rates is None:
        emit_serving_source(ServedValue.TRANSACTION_SAMPLE_RATES, ServingSource.PER_ORG_NO_DATA)
        return {}, default_rate

    emit_serving_source(ServedValue.TRANSACTION_SAMPLE_RATES, ServingSource.PER_ORG)
    return sample_rates


def get_recalibration_factor(org_id: int) -> float:
    return cache.get_adjusted_factor(org_id, source="serving")


def get_previous_recalibration_factor(org_id: int) -> float:
    """The factor a recalibration pass applies its correction on top of."""
    return cache.get_adjusted_factor(org_id, source="task")


def get_organization_sample_rate(
    org_id: int, default_sample_rate: float | None
) -> tuple[float | None, bool]:
    """The sample rate an organization targets, and whether that rate is its own.

    An organization with custom dynamic sampling targets its ``sentry:target_sample_rate``
    option. Any other organization targets the rate the last pass derived from its volume.
    Without either, the default is returned and the flag is False.
    """
    try:
        organization = Organization.objects.get_from_cache(id=org_id)
    except Organization.DoesNotExist:
        organization = None

    if organization is not None and has_custom_dynamic_sampling(organization):
        target_sample_rate = organization.get_option("sentry:target_sample_rate")
        if target_sample_rate is not None:
            return float(target_sample_rate), True
        if default_sample_rate is not None:
            return default_sample_rate, False
        return TARGET_SAMPLE_RATE_DEFAULT, False

    sample_rate = cache.get_organization_sample_rate(org_id)
    if sample_rate is None:
        return default_sample_rate, False
    return sample_rate, True
