from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import TypedDict

import sentry_sdk
from snuba_sdk import (
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Granularity,
    Op,
    OrderBy,
    Query,
    Request,
)

from sentry import quotas
from sentry.dynamic_sampling.tasks.constants import CHUNK_SIZE, MAX_ORGS_PER_QUERY
from sentry.dynamic_sampling.tasks.helpers.sliding_window import extrapolate_monthly_volume
from sentry.dynamic_sampling.types import SamplingMeasure
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.naming_layer.mri import SpanMRI, TransactionMRI
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query

ACTIVE_ORGS_DEFAULT_TIME_INTERVAL = timedelta(hours=1)
ACTIVE_ORGS_DEFAULT_GRANULARITY = Granularity(3600)

ACTIVE_ORGS_VOLUMES_DEFAULT_TIME_INTERVAL = timedelta(minutes=5)
ACTIVE_ORGS_VOLUMES_DEFAULT_GRANULARITY = Granularity(60)


class MeasureConfig(TypedDict):
    """Configuration for a sampling measure query."""

    mri: str
    use_case_id: UseCaseID
    tags: dict[str, str]


# Configuration for each sampling measure type
MEASURE_CONFIGS: dict[SamplingMeasure, MeasureConfig] = {
    # SEGMENTS: SpanMRI with is_segment=true filter (replacement for transactions)
    SamplingMeasure.SEGMENTS: {
        "mri": SpanMRI.COUNT_PER_ROOT_PROJECT.value,
        "use_case_id": UseCaseID.SPANS,
        "tags": {"is_segment": "true"},
    },
    # SPANS: SpanMRI without is_segment filter (AM3/project mode - counts all spans)
    SamplingMeasure.SPANS: {
        "mri": SpanMRI.COUNT_PER_ROOT_PROJECT.value,
        "use_case_id": UseCaseID.SPANS,
        "tags": {},
    },
    # TRANSACTIONS: TransactionMRI without tag filters (legacy)
    SamplingMeasure.TRANSACTIONS: {
        "mri": TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
        "use_case_id": UseCaseID.TRANSACTIONS,
        "tags": {},
    },
}


class GetActiveOrgs:
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
        config = MEASURE_CONFIGS[measure]
        self.metric_id = indexer.resolve_shared_org(str(config["mri"]))
        self.use_case_id = config["use_case_id"]
        self.tag_filters = config["tags"]

        self.offset = 0
        self.last_result: list[tuple[int, int]] = []
        self.has_more_results = True
        self.max_orgs = max_orgs
        self.max_projects = max_projects
        self.time_interval = time_interval
        self.granularity = granularity

    def __iter__(self) -> GetActiveOrgs:
        return self

    def __next__(self) -> list[int]:
        if self._enough_results_cached():
            # we have enough in the cache to satisfy the current iteration
            return self._get_from_cache()

        if self.has_more_results:
            # not enough for the current iteration and data still in the db top it up from db
            where_conditions = [
                Condition(
                    Column("timestamp"),
                    Op.GTE,
                    datetime.utcnow() - self.time_interval,
                ),
                Condition(Column("timestamp"), Op.LT, datetime.utcnow()),
                Condition(Column("metric_id"), Op.EQ, self.metric_id),
            ]
            for tag_name, tag_value in self.tag_filters.items():
                tag_string_id = indexer.resolve_shared_org(tag_name)
                tag_column = f"tags_raw[{tag_string_id}]"
                where_conditions.append(Condition(Column(tag_column), Op.EQ, tag_value))

            query = (
                Query(
                    match=Entity(EntityKey.GenericOrgMetricsCounters.value),
                    select=[
                        Function("uniq", [Column("project_id")], "num_projects"),
                        Column("org_id"),
                    ],
                    groupby=[
                        Column("org_id"),
                    ],
                    where=where_conditions,
                    orderby=[
                        OrderBy(Column("org_id"), Direction.ASC),
                    ],
                    granularity=self.granularity,
                )
                .set_limit(CHUNK_SIZE + 1)
                .set_offset(self.offset)
            )
            request = Request(
                dataset=Dataset.PerformanceMetrics.value,
                app_id="dynamic_sampling",
                query=query,
                tenant_ids={
                    "use_case_id": self.use_case_id.value,
                    "cross_org_query": 1,
                },
            )
            data = raw_snql_query(
                request,
                referrer=Referrer.DYNAMIC_SAMPLING_COUNTERS_FETCH_PROJECTS_WITH_COUNT_PER_TRANSACTION.value,
            )["data"]
            count = len(data)

            self.has_more_results = count > CHUNK_SIZE
            self.offset += CHUNK_SIZE
            if self.has_more_results:
                data = data[:-1]
            for row in data:
                self.last_result.append((row["org_id"], row["num_projects"]))

        if len(self.last_result) > 0:
            # we have some data left return up to the max amount
            return self._get_from_cache()  # we still have something left in cache
        else:
            # nothing left in the DB or cache
            raise StopIteration()

    def _enough_results_cached(self) -> bool:
        """
        Return true if we have enough data to return a full batch in the cache (i.e. last_result)
        """
        if len(self.last_result) >= self.max_orgs:
            return True

        if self.max_projects is not None:
            total_projects = 0
            for _, num_projects in self.last_result:
                total_projects += num_projects
                if num_projects >= self.max_projects:
                    return True
        return False

    def _get_orgs(self, orgs_and_counts: list[tuple[int, int]]) -> list[int]:
        """
        Extracts the orgs from last_result
        """
        return [org for org, _ in orgs_and_counts]

    def _get_from_cache(self) -> list[int]:
        """
        Returns a batch from cache and removes the elements returned from the cache
        """
        count_projects = 0
        for idx, (org_id, num_projects) in enumerate(self.last_result):
            count_projects += num_projects
            if idx >= (self.max_orgs - 1) or (
                self.max_projects is not None and count_projects >= self.max_projects
            ):
                # we got to the number of elements desired
                ret_val = self._get_orgs(self.last_result[: idx + 1])
                self.last_result = self.last_result[idx + 1 :]
                return ret_val
        # if we are here we haven't reached our max limit, return everything
        ret_val = self._get_orgs(self.last_result)
        self.last_result = []
        return ret_val


@dataclass(frozen=True)
class OrganizationDataVolume:
    """
    Represents the total and indexed number of transactions received by an organization
    (in a particular interval of time).
    """

    # organization id
    org_id: int
    # total number of transactions
    total: int
    # number of transactions indexed (i.e. stored)
    indexed: int | None

    def is_valid_for_recalibration(self) -> bool:
        return self.total > 0 and self.indexed is not None and self.indexed > 0


class GetActiveOrgsVolumes:
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
        self.include_keep = include_keep
        self.orgs = orgs

        config = MEASURE_CONFIGS[measure]
        self.metric_id = indexer.resolve_shared_org(str(config["mri"]))
        self.use_case_id = config["use_case_id"]
        self.tag_filters = config["tags"]

        if self.include_keep:
            decision_string_id = indexer.resolve_shared_org("decision")
            decision_tag = f"tags_raw[{decision_string_id}]"

            self.keep_count_column = Function(
                "sumIf",
                [
                    Column("value"),
                    Function(
                        "equals",
                        [Column(decision_tag), "keep"],
                    ),
                ],
                alias="keep_count",
            )
        else:
            self.keep_count_column = None

        self.offset = 0
        self.last_result: list[OrganizationDataVolume] = []
        self.has_more_results = True
        self.max_orgs = max_orgs
        self.granularity = granularity
        self.time_interval = time_interval

    def __iter__(self) -> GetActiveOrgsVolumes:
        return self

    def __next__(self) -> list[OrganizationDataVolume]:
        if self._enough_results_cached():
            # we have enough in the cache to satisfy the current iteration
            return self._get_from_cache()

        select = [
            Function("sum", [Column("value")], "total_count"),
            Column("org_id"),
        ]

        where = [
            Condition(Column("timestamp"), Op.GTE, datetime.utcnow() - self.time_interval),
            Condition(Column("timestamp"), Op.LT, datetime.utcnow()),
            Condition(Column("metric_id"), Op.EQ, self.metric_id),
        ]

        for tag_name, tag_value in self.tag_filters.items():
            tag_string_id = indexer.resolve_shared_org(tag_name)
            tag_column = f"tags_raw[{tag_string_id}]"
            where.append(Condition(Column(tag_column), Op.EQ, tag_value))

        if self.orgs:
            where.append(Condition(Column("org_id"), Op.IN, self.orgs))

        if self.include_keep:
            select.append(self.keep_count_column)

        if self.has_more_results:
            # not enough for the current iteration and data still in the db top it up from db
            query = (
                Query(
                    match=Entity(EntityKey.GenericOrgMetricsCounters.value),
                    select=select,
                    groupby=[
                        Column("org_id"),
                    ],
                    where=where,
                    granularity=self.granularity,
                )
                .set_limit(CHUNK_SIZE + 1)
                .set_offset(self.offset)
            )
            request = Request(
                dataset=Dataset.PerformanceMetrics.value,
                app_id="dynamic_sampling",
                query=query,
                tenant_ids={
                    "use_case_id": self.use_case_id.value,
                    "cross_org_query": 1,
                },
            )

            data = raw_snql_query(
                request,
                referrer=Referrer.DYNAMIC_SAMPLING_COUNTERS_GET_ORG_TRANSACTION_VOLUMES.value,
            )["data"]
            count = len(data)

            self.has_more_results = count > CHUNK_SIZE
            self.offset += CHUNK_SIZE
            if self.has_more_results:
                data = data[:-1]
            for row in data:
                keep_count = row["keep_count"] if self.include_keep else None
                self.last_result.append(
                    OrganizationDataVolume(
                        org_id=row["org_id"],
                        total=row["total_count"],
                        indexed=keep_count,
                    )
                )

        if len(self.last_result) > 0:
            # we have some data left return up to the max amount
            return self._get_from_cache()  # we still have something left in cache
        else:
            # nothing left in the DB or cache
            raise StopIteration()

    def _enough_results_cached(self) -> bool:
        """
        Return true if we have enough data to return a full batch in the cache (i.e. last_result)
        """
        return len(self.last_result) >= self.max_orgs

    def _get_from_cache(self) -> list[OrganizationDataVolume]:
        """
        Returns a batch from cache and removes the elements returned from the cache
        """
        if len(self.last_result) >= self.max_orgs:
            ret_val = self.last_result[: self.max_orgs]
            self.last_result = self.last_result[self.max_orgs :]
        else:
            ret_val = self.last_result
            self.last_result = []
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
        # We want to compute the sliding window sample rate by considering a window of time.
        # This piece of code is very delicate, thus we want to guard it properly and capture any errors.
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

    The org_id is used only because it is required on the quotas side to determine whether dynamic sampling is
    enabled in the first place for that project.
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
