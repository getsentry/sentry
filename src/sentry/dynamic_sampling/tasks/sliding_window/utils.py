import time
from collections import defaultdict
from datetime import datetime, timedelta
from typing import List, Mapping, Sequence, Tuple

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

from sentry.dynamic_sampling.rules.helpers.sliding_window import (
    SLIDING_WINDOW_CALCULATION_ERROR,
    generate_sliding_window_cache_key,
)
from sentry.dynamic_sampling.rules.utils import OrganizationId, ProjectId, get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.common import (
    are_equal_with_epsilon,
    compute_guarded_sliding_window_sample_rate,
    sample_rate_to_float,
)
from sentry.dynamic_sampling.tasks.constants import CACHE_KEY_TTL, CHUNK_SIZE, MAX_SECONDS
from sentry.dynamic_sampling.tasks.logging import log_query_timeout
from sentry.sentry_metrics import indexer
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.snuba.referrer import Referrer
from sentry.tasks.relay import schedule_invalidate_project_config
from sentry.utils.snuba import raw_snql_query


def adjust_base_sample_rates_of_projects(
    org_id: int, projects_with_total_root_count: Sequence[Tuple[ProjectId, int]], window_size: int
) -> None:
    """
    Adjusts the base sample rate per project by computing the sliding window sample rate, considering the total
    volume of root transactions started from each project in the org.
    """
    projects_with_rebalanced_sample_rate = []

    for project_id, total_root_count in projects_with_total_root_count:
        sample_rate = compute_guarded_sliding_window_sample_rate(
            org_id, project_id, total_root_count, window_size
        )

        # If the sample rate is None, we want to add a sentinel value into Redis, the goal being that when generating
        # rules we can distinguish between:
        # 1. Value in the cache
        # 2. No value in the cache
        # 3. Error happened
        projects_with_rebalanced_sample_rate.append(
            (
                project_id,
                str(sample_rate) if sample_rate is not None else SLIDING_WINDOW_CALCULATION_ERROR,
            )
        )

    redis_client = get_redis_client_for_ds()
    cache_key = generate_sliding_window_cache_key(org_id=org_id)

    # We want to get all the old sample rates in memory because we will remove the entire hash in the next step.
    old_sample_rates = redis_client.hgetall(cache_key)

    # For efficiency reasons, we start a pipeline that will apply a set of operations without multiple round trips.
    with redis_client.pipeline(transaction=False) as pipeline:
        # We want to delete the Redis hash before adding new sample rate since we don't back-fill projects that have no
        # root count metrics in the considered window.
        pipeline.delete(cache_key)

        # For each project we want to now save the new sample rate.
        for project_id, sample_rate in projects_with_rebalanced_sample_rate:  # type:ignore
            # We store the new updated sample rate.
            pipeline.hset(cache_key, project_id, sample_rate)
            pipeline.pexpire(cache_key, CACHE_KEY_TTL)

            # We want to get the old sample rate, which will be None in case it was not set.
            old_sample_rate = sample_rate_to_float(old_sample_rates.get(str(project_id), ""))
            # We also get the new sample rate, which will be None in case we stored a SLIDING_WINDOW_CALCULATION_ERROR.
            sample_rate = sample_rate_to_float(sample_rate)  # type:ignore
            # We invalidate the caches only if there was a change in the sample rate. This is to avoid flooding the
            # system with project config invalidations.
            if not are_equal_with_epsilon(old_sample_rate, sample_rate):
                schedule_invalidate_project_config(
                    project_id=project_id, trigger="dynamic_sampling_sliding_window"
                )

        pipeline.execute()


def fetch_projects_with_total_root_transactions_count(
    org_ids: List[int], window_size: int
) -> Mapping[OrganizationId, Sequence[Tuple[ProjectId, int]]]:
    """
    Fetches for each organization and project the total root transactions count.
    """
    query_interval = timedelta(hours=window_size)
    granularity = Granularity(3600)

    count_per_root_metric_id = indexer.resolve_shared_org(
        str(TransactionMRI.COUNT_PER_ROOT_PROJECT.value)
    )
    where = [
        Condition(Column("timestamp"), Op.GTE, datetime.utcnow() - query_interval),
        Condition(Column("timestamp"), Op.LT, datetime.utcnow()),
        Condition(Column("metric_id"), Op.EQ, count_per_root_metric_id),
        Condition(Column("org_id"), Op.IN, list(org_ids)),
    ]

    start_time = time.time()
    offset = 0
    aggregated_projects = defaultdict(list)
    while (time.time() - start_time) < MAX_SECONDS:
        query = (
            Query(
                match=Entity(EntityKey.GenericOrgMetricsCounters.value),
                select=[
                    Function("sum", [Column("value")], "root_count_value"),
                    Column("org_id"),
                    Column("project_id"),
                ],
                where=where,
                groupby=[Column("org_id"), Column("project_id")],
                orderby=[
                    OrderBy(Column("org_id"), Direction.ASC),
                    OrderBy(Column("project_id"), Direction.ASC),
                ],
                granularity=granularity,
            )
            .set_limit(CHUNK_SIZE + 1)
            .set_offset(offset)
        )

        request = Request(
            dataset=Dataset.PerformanceMetrics.value, app_id="dynamic_sampling", query=query
        )

        data = raw_snql_query(
            request,
            referrer=Referrer.DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_PROJECTS_WITH_COUNT_PER_ROOT.value,
        )["data"]

        count = len(data)
        more_results = count > CHUNK_SIZE
        offset += CHUNK_SIZE

        if more_results:
            data = data[:-1]

        for row in data:
            aggregated_projects[row["org_id"]].append((row["project_id"], row["root_count_value"]))

        if not more_results:
            break
    else:
        log_query_timeout(query="fetch_projects_with_total_root_transactions_count", offset=offset)

    return aggregated_projects
