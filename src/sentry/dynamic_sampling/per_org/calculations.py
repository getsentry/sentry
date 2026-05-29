from __future__ import annotations

import logging
from typing import cast

from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.models.projects_rebalancing import (
    ProjectsRebalancingInput,
    ProjectsRebalancingModel,
)
from sentry.dynamic_sampling.per_org import cache as per_org_recalibration_cache
from sentry.dynamic_sampling.per_org.configuration import BaseDynamicSamplingConfiguration
from sentry.dynamic_sampling.per_org.queries import ProjectVolume
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.common import OrganizationDataVolume, sample_rate_to_float
from sentry.dynamic_sampling.tasks.helpers import (
    recalibrate_orgs as legacy_recalibration_cache,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_projects import (
    generate_boost_low_volume_projects_cache_key,
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
    logger.info(
        RECALIBRATION_FACTOR_DISCREPANCY_LOG_LOCATION,
        extra={
            "org_id": config.organization.id,
            "discrepancy": new_pipeline_factor - old_pipeline_factor,
        },
    )
    return adjusted_factor


PROJECT_BALANCING_COMPARISON_RELATIVE_TOLERANCE = 0.05


def run_project_balancing(
    config: BaseDynamicSamplingConfiguration, project_volumes: list[ProjectVolume]
) -> list[RebalancedItem]:
    sample_rate = cast(float, config.get_sample_rate())
    counts_by_project = {project.id: 0 for project in config.projects}
    for project_volume in project_volumes:
        if project_volume.project_id in counts_by_project:
            counts_by_project[project_volume.project_id] = project_volume.total
    return ProjectsRebalancingModel().run(
        ProjectsRebalancingInput(
            classes=[
                RebalancedItem(id=project_id, count=count)
                for project_id, count in counts_by_project.items()
            ],
            sample_rate=sample_rate,
        )
    )


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
) -> None:
    calculated_sample_rates = {
        int(project.id): project.new_sample_rate for project in rebalanced_projects
    }

    for project_id, eap_sample_rate in sorted(calculated_sample_rates.items()):
        generic_metrics_sample_rate = cached_sample_rates.get(project_id)
        logger.info(
            "dynamic_sampling.per_org.project_balancing_comparison",
            extra={
                "org_id": config.organization.id,
                "project_id": project_id,
                "generic_metrics_sample_rate": generic_metrics_sample_rate,
                "eap_sample_rate": eap_sample_rate,
                "relative_deviation": get_relative_deviation(
                    generic_metrics_sample_rate, eap_sample_rate
                ),
                "is_equal": is_within_relative_tolerance(
                    generic_metrics_sample_rate, eap_sample_rate
                ),
            },
        )
