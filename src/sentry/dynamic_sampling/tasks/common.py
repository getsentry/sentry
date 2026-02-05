from __future__ import annotations

import math
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import timedelta

import sentry_sdk
from snuba_sdk import Granularity

from sentry import quotas
from sentry.dynamic_sampling.tasks.constants import MAX_ORGS_PER_QUERY
from sentry.dynamic_sampling.tasks.helpers.sliding_window import extrapolate_monthly_volume
from sentry.dynamic_sampling.tasks.query_builder import (
    MEASURE_CONFIGS,
    BaseBatchFetcher,
    DynamicSamplingMetricsQuery,
    GroupBy,
    MeasureConfig,
    QueryResult,
)
from sentry.dynamic_sampling.types import SamplingMeasure
from sentry.snuba.referrer import Referrer

# Re-export for backwards compatibility
__all__ = [
    "MEASURE_CONFIGS",
    "MeasureConfig",
    "GetActiveOrgs",
    "GetActiveOrgsVolumes",
    "OrganizationDataVolume",
    "get_organization_volume",
    "sample_rate_to_float",
    "are_equal_with_epsilon",
    "compute_guarded_sliding_window_sample_rate",
    "compute_sliding_window_sample_rate",
]

ACTIVE_ORGS_DEFAULT_TIME_INTERVAL = timedelta(hours=1)
ACTIVE_ORGS_DEFAULT_GRANULARITY = Granularity(3600)

ACTIVE_ORGS_VOLUMES_DEFAULT_TIME_INTERVAL = timedelta(minutes=5)
ACTIVE_ORGS_VOLUMES_DEFAULT_GRANULARITY = Granularity(60)


class GetActiveOrgs(BaseBatchFetcher[tuple[int, int], list[int]]):
    """
    Fetch organizations in batches.
    A batch will return at max max_orgs elements
    It will accumulate org ids in the list until either it accumulates max_orgs or the
    number of projects in the already accumulated orgs is more than max_projects or there
    are no more orgs
    """

    def __init__(
        self,
        max_orgs: int = MAX_ORGS_PER_QUERY,
        max_projects: int | None = None,
        time_interval: timedelta = ACTIVE_ORGS_DEFAULT_TIME_INTERVAL,
        granularity: Granularity = ACTIVE_ORGS_DEFAULT_GRANULARITY,
        measure: SamplingMeasure = SamplingMeasure.TRANSACTIONS,
    ) -> None:
        super().__init__()
        self.max_orgs = max_orgs
        self.max_projects = max_projects
        self._time_interval = time_interval
        self._granularity = granularity
        self._measure = measure
        self._initialize_query()

    def _create_query_iterator(self) -> Iterator[list[QueryResult]]:
        query = DynamicSamplingMetricsQuery(
            measure=self._measure,
            time_interval=self._time_interval,
            granularity=self._granularity,
            group_by=GroupBy.ORG,
            include_project_count=True,
            referrer=Referrer.DYNAMIC_SAMPLING_COUNTERS_FETCH_PROJECTS_WITH_COUNT_PER_TRANSACTION,
        )
        return query.execute()

    def _transform_result(self, result: QueryResult) -> tuple[int, int]:
        return (result.org_id, result.project_count or 0)

    def _enough_results_cached(self) -> bool:
        """
        Return true if we have enough data to return a full batch in the cache
        """
        if len(self._cache) >= self.max_orgs:
            return True

        if self.max_projects is not None:
            total_projects = 0
            for _, num_projects in self._cache:
                total_projects += num_projects
                if total_projects >= self.max_projects:
                    return True
        return False

    def _extract_batch(self) -> list[int]:
        """
        Returns a batch from cache and removes the elements returned from the cache
        """
        count_projects = 0
        for idx, (_, num_projects) in enumerate(self._cache):
            count_projects += num_projects
            if idx >= (self.max_orgs - 1) or (
                self.max_projects is not None and count_projects >= self.max_projects
            ):
                ret_val = [org for org, _ in self._cache[: idx + 1]]
                self._cache = self._cache[idx + 1 :]
                return ret_val

        # Return everything if we haven't reached our max limit
        ret_val = [org for org, _ in self._cache]
        self._cache = []
        return ret_val


@dataclass(frozen=True)
class OrganizationDataVolume:
    """
    Represents the total and indexed number of transactions received by an organization
    (in a particular interval of time).
    """

    org_id: int
    total: int
    indexed: int | None

    def is_valid_for_recalibration(self) -> bool:
        return self.total > 0 and self.indexed is not None and self.indexed > 0


class GetActiveOrgsVolumes(BaseBatchFetcher[OrganizationDataVolume, list[OrganizationDataVolume]]):
    """
    Fetch organizations volumes in batches.
    A batch will return at max max_orgs elements
    """

    def __init__(
        self,
        max_orgs: int = MAX_ORGS_PER_QUERY,
        time_interval: timedelta = ACTIVE_ORGS_VOLUMES_DEFAULT_TIME_INTERVAL,
        granularity: Granularity = ACTIVE_ORGS_VOLUMES_DEFAULT_GRANULARITY,
        include_keep: bool = True,
        orgs: list[int] | None = None,
        measure: SamplingMeasure = SamplingMeasure.TRANSACTIONS,
    ) -> None:
        super().__init__()
        self.max_orgs = max_orgs
        self.include_keep = include_keep
        self._time_interval = time_interval
        self._granularity = granularity
        self._orgs = orgs
        self._measure = measure
        self._initialize_query()

    def _create_query_iterator(self) -> Iterator[list[QueryResult]]:
        query = DynamicSamplingMetricsQuery(
            measure=self._measure,
            time_interval=self._time_interval,
            granularity=self._granularity,
            group_by=GroupBy.ORG,
            org_ids=self._orgs,
            include_keep_count=self.include_keep,
            referrer=Referrer.DYNAMIC_SAMPLING_COUNTERS_GET_ORG_TRANSACTION_VOLUMES,
        )
        return query.execute()

    def _transform_result(self, result: QueryResult) -> OrganizationDataVolume:
        return OrganizationDataVolume(
            org_id=result.org_id,
            total=int(result.total),
            indexed=int(result.keep_count) if result.keep_count is not None else None,
        )

    def _enough_results_cached(self) -> bool:
        """
        Return true if we have enough data to return a full batch in the cache
        """
        return len(self._cache) >= self.max_orgs

    def _extract_batch(self) -> list[OrganizationDataVolume]:
        """
        Returns a batch from cache and removes the elements returned from the cache
        """
        if len(self._cache) >= self.max_orgs:
            ret_val = self._cache[: self.max_orgs]
            self._cache = self._cache[self.max_orgs :]
        else:
            ret_val = self._cache
            self._cache = []
        return ret_val


def get_organization_volume(
    org_id: int,
    time_interval: timedelta = ACTIVE_ORGS_VOLUMES_DEFAULT_TIME_INTERVAL,
    granularity: Granularity = ACTIVE_ORGS_VOLUMES_DEFAULT_GRANULARITY,
) -> OrganizationDataVolume | None:
    """
    Specialized version of GetActiveOrgsVolumes that returns a single org
    """
    for org_volumes in GetActiveOrgsVolumes(
        max_orgs=1,
        time_interval=time_interval,
        granularity=granularity,
        orgs=[org_id],
    ):
        if org_volumes:
            return org_volumes[0]
    return None


def sample_rate_to_float(sample_rate: str | None) -> float | None:
    """
    Converts a sample rate to a float or returns None in case the conversion failed.
    """
    if sample_rate is None:
        return None

    try:
        return float(sample_rate)
    except (TypeError, ValueError):
        return None


def are_equal_with_epsilon(a: float | None, b: float | None) -> bool:
    """
    Checks if two floating point numbers are equal within an error boundary.
    """
    if a is None and b is None:
        return True

    if a is None or b is None:
        return False

    return math.isclose(a, b)


def compute_guarded_sliding_window_sample_rate(
    org_id: int,
    project_id: int | None,
    total_root_count: int,
    window_size: int,
) -> float | None:
    """
    Computes the actual sliding window sample rate by guarding any exceptions and returning None in case
    any problem would arise.
    """
    try:
        return compute_sliding_window_sample_rate(org_id, project_id, total_root_count, window_size)
    except Exception as e:
        sentry_sdk.capture_exception(
            e,
            extras={
                "org_id": org_id,
                "project_id": project_id,
                "total_root_count": total_root_count,
                "window_size": window_size,
            },
        )
        return None


def compute_sliding_window_sample_rate(
    org_id: int,
    project_id: int | None,
    total_root_count: int,
    window_size: int,
) -> float | None:
    """
    Computes the actual sample rate for the sliding window given the total root count and the size of the
    window that was used for computing the root count.
    """
    extrapolated_volume = extrapolate_monthly_volume(volume=total_root_count, hours=window_size)
    if extrapolated_volume is None:
        with sentry_sdk.isolation_scope() as scope:
            scope.set_extra("org_id", org_id)
            scope.set_extra("window_size", window_size)
            sentry_sdk.capture_message("The volume of the current month can't be extrapolated.")

        return None

    sampling_tier = quotas.backend.get_transaction_sampling_tier_for_volume(
        org_id, extrapolated_volume
    )
    if sampling_tier is None:
        return None

    _, sample_rate = sampling_tier
    return float(sample_rate)
