from __future__ import annotations

import logging

from sentry.dynamic_sampling.per_org.tasks import cache as per_org_recalibration_cache
from sentry.dynamic_sampling.per_org.tasks.configuration import BaseDynamicSamplingConfiguration
from sentry.dynamic_sampling.per_org.tasks.diagnostics import should_log
from sentry.dynamic_sampling.tasks.common import OrganizationDataVolume
from sentry.dynamic_sampling.tasks.helpers import (
    recalibrate_orgs as legacy_recalibration_cache,
)

RECALIBRATION_FACTOR_DISCREPANCY_LOG_LOCATION = (
    "dynamic_sampling.per_org.recalibration_factor_discrepancy"
)

logger = logging.getLogger(__name__)


class DynamicSamplingInvalidOrgVolumes(Exception):
    pass


def calculate_recalibration_factor(
    config: BaseDynamicSamplingConfiguration,
    org_volume: OrganizationDataVolume | None,
) -> float | None:
    if not config.needs_recalibration or config.sample_rate is None:
        return None

    if org_volume is None or not org_volume.is_valid_for_recalibration():
        return None
    if org_volume.indexed is None or org_volume.total == 0:
        raise DynamicSamplingInvalidOrgVolumes

    effective_sample_rate = org_volume.indexed / org_volume.total
    old_pipeline_factor = legacy_recalibration_cache.get_adjusted_factor(config.organization.id)
    new_pipeline_factor = per_org_recalibration_cache.get_adjusted_factor(config.organization.id)
    adjusted_factor = legacy_recalibration_cache.compute_adjusted_factor(
        new_pipeline_factor,
        effective_sample_rate,
        config.sample_rate,
    )
    if should_log(RECALIBRATION_FACTOR_DISCREPANCY_LOG_LOCATION):
        logger.info(
            RECALIBRATION_FACTOR_DISCREPANCY_LOG_LOCATION,
            extra={
                "org_id": config.organization.id,
                "discrepancy": new_pipeline_factor - old_pipeline_factor,
            },
        )
    return adjusted_factor
