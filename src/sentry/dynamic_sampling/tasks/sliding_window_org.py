import time
from datetime import datetime, timedelta
from typing import List, Mapping

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

from sentry.dynamic_sampling.rules.utils import OrganizationId, get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.common import (
    compute_guarded_sliding_window_sample_rate,
    get_active_orgs_with_projects_counts,
)
from sentry.dynamic_sampling.tasks.constants import CACHE_KEY_TTL, CHUNK_SIZE, MAX_SECONDS
from sentry.dynamic_sampling.tasks.helpers.sliding_window import (
    generate_sliding_window_org_cache_key,
    get_sliding_window_size,
    mark_sliding_window_org_executed,
)
from sentry.dynamic_sampling.tasks.logging import log_query_timeout
from sentry.dynamic_sampling.tasks.utils import dynamic_sampling_task
from sentry.sentry_metrics import indexer
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.snuba.referrer import Referrer
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.snuba import raw_snql_query


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.sliding_window_org",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=2 * 60 * 60,  # 2 hours
    time_limit=2 * 60 * 60 + 5,
)
@dynamic_sampling_task
def sliding_window_org() -> None:
    window_size = get_sliding_window_size()
    # In case the size is None it means that we disabled the sliding window entirely.
    if window_size is not None:
        metrics.incr("sentry.dynamic_sampling.tasks.sliding_window_org.start", sample_rate=1.0)
        with metrics.timer("sentry.dynamic_sampling.tasks.sliding_window_org", sample_rate=1.0):
            for orgs in get_active_orgs_with_projects_counts():
                for (org_id, total_root_count,) in fetch_orgs_with_total_root_transactions_count(
                    org_ids=orgs, window_size=window_size
                ).items():
                    adjust_base_sample_rate_of_org(org_id, total_root_count, window_size)

            # Due to the synchronous nature of the sliding window org, when we arrived here, we can confidently say
            # that the execution of the sliding window org was successful. We will keep this state for 1 hour.
            mark_sliding_window_org_executed()


def adjust_base_sample_rate_of_org(org_id: int, total_root_count: int, window_size: int) -> None:
    """
    Adjusts the base sample rate per org by considering its volume and how it fits w.r.t. to the sampling tiers.
    """
    sample_rate = compute_guarded_sliding_window_sample_rate(
        org_id, None, total_root_count, window_size
    )
    # If the sample rate is None, we don't want to store a value into Redis, but we prefer to keep the system
    # with the old value.
    if sample_rate is None:
        return

    redis_client = get_redis_client_for_ds()
    with redis_client.pipeline(transaction=False) as pipeline:
        cache_key = generate_sliding_window_org_cache_key(org_id=org_id)
        pipeline.set(cache_key, sample_rate)
        pipeline.pexpire(cache_key, CACHE_KEY_TTL)
        pipeline.execute()


def fetch_orgs_with_total_root_transactions_count(
    org_ids: List[int], window_size: int
) -> Mapping[OrganizationId, int]:
    """
    Fetches for each org the total root transaction count.
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
    aggregated_projects = {}
    while (time.time() - start_time) < MAX_SECONDS:
        query = (
            Query(
                match=Entity(EntityKey.GenericOrgMetricsCounters.value),
                select=[
                    Function("sum", [Column("value")], "root_count_value"),
                    Column("org_id"),
                ],
                where=where,
                groupby=[Column("org_id")],
                orderby=[
                    OrderBy(Column("org_id"), Direction.ASC),
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
            referrer=Referrer.DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_ORGS_WITH_COUNT_PER_ROOT.value,  # type:ignore
        )["data"]

        count = len(data)
        more_results = count > CHUNK_SIZE
        offset += CHUNK_SIZE

        if more_results:
            data = data[:-1]

        for row in data:
            aggregated_projects[row["org_id"]] = row["root_count_value"]

        if not more_results:
            break
    else:
        log_query_timeout(query="fetch_orgs_with_total_root_transactions_count", offset=offset)

    return aggregated_projects
