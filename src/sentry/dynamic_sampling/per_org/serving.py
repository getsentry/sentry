"""
The single place where rule generation picks between the legacy (generic metrics) caches and
the per-org (EAP) ones. Each getter returns the value the organization is served and emits
which pipeline supplied it. Callers get one value and never see the choice.

An organization switches over as a whole. It serves from the per-org caches only once a pass
has stored its project sample rates, and from that point every value comes from them, so that
its projects never mix rates the two pipelines computed against different budgets.
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


def _serving_source(org_id: int) -> ServingSource:
    """Which pipeline supplies every value of this organization.

    An organization inside the rollout that no pass has stored rates for yet reads the
    legacy caches, and is counted apart from one still on the legacy pipeline: it is a
    coverage gap rather than a steady state.
    """
    if not is_org_in_serving_rollout(org_id):
        return ServingSource.LEGACY
    if not cache.has_project_rates(org_id):
        return ServingSource.PER_ORG_FALLBACK
    return ServingSource.PER_ORG


def get_project_sample_rate(
    org_id: int, project_id: int, *, error_sample_rate_fallback: float
) -> float:
    """The balanced sample rate of a project, from whichever pipeline serves it."""
    source = _serving_source(org_id)
    if source is ServingSource.PER_ORG:
        sample_rate = cache.get_project_sample_rate(org_id, project_id)
        if sample_rate is None:
            # The organization has rates but this project has none, so it was created since
            # the last pass. The next one balances it; until then it is sampled in full,
            # which is what both pipelines give a project with no volume.
            emit_serving_source(ServedValue.PROJECT_SAMPLE_RATE, ServingSource.PER_ORG_UNBALANCED)
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
    """The named and implicit transaction sample rates of a project.

    An empty mapping means the project has no per-transaction rules, which is what both
    pipelines store for a project they did not balance.
    """
    source = _serving_source(org_id)
    emit_serving_source(ServedValue.TRANSACTION_SAMPLE_RATES, source)
    if source is ServingSource.PER_ORG:
        # A project the pass did not balance has no entry, which is the same answer as an
        # entry holding no named rates: every transaction samples at the project's rate.
        sample_rates = cache.get_transaction_sample_rates(org_id, project_id)
        return sample_rates if sample_rates is not None else ({}, default_rate)

    named_rates, implicit_rate = get_transactions_resampling_rates(
        org_id=org_id, proj_id=project_id, default_rate=default_rate
    )
    return named_rates, implicit_rate


def get_recalibration_factor(org_id: int) -> float:
    """The organization's recalibration factor, from whichever pipeline serves it.

    Unlike the sample rates, a missing per-org factor is not a coverage gap: the identity
    factor is stored by deleting the key, so there is nothing to fall back to.

    The factor also has a rollout of its own, so an organization whose factor the per-org
    pipeline does not compute keeps being recalibrated by the legacy one.
    """
    source = _serving_source(org_id)
    if source is ServingSource.PER_ORG and not is_org_in_recalibration_rollout(org_id):
        source = ServingSource.LEGACY

    emit_serving_source(ServedValue.RECALIBRATION_FACTOR, source)
    if source is ServingSource.PER_ORG:
        return cache.get_adjusted_factor(org_id, source="serving")

    return get_adjusted_factor(org_id, source="serving")
