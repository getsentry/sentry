from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.common import (
    compute_guarded_sliding_window_sample_rate,
    fetch_orgs_with_total_root_transactions_count,
    get_active_orgs_with_projects_counts,
)
from sentry.dynamic_sampling.tasks.constants import DEFAULT_REDIS_CACHE_KEY_TTL
from sentry.dynamic_sampling.tasks.helpers.sliding_window import (
    generate_sliding_window_org_cache_key,
    get_sliding_window_size,
    mark_sliding_window_org_executed,
)
from sentry.dynamic_sampling.tasks.utils import dynamic_sampling_task
from sentry.tasks.base import instrumented_task


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
        pipeline.pexpire(cache_key, DEFAULT_REDIS_CACHE_KEY_TTL)
        pipeline.execute()
