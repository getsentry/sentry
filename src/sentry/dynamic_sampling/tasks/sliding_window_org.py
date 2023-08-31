import time
from datetime import timedelta

from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.common import (
    GetActiveOrgsVolumes,
    TimedIterator,
    TimeoutException,
    compute_guarded_sliding_window_sample_rate,
)
from sentry.dynamic_sampling.tasks.constants import (
    CHUNK_SIZE,
    DEFAULT_REDIS_CACHE_KEY_TTL,
    MAX_TASK_SECONDS,
)
from sentry.dynamic_sampling.tasks.helpers.sliding_window import (
    generate_sliding_window_org_cache_key,
    get_sliding_window_size,
    mark_sliding_window_org_executed,
)
from sentry.dynamic_sampling.tasks.task_context import TaskContext
from sentry.dynamic_sampling.tasks.utils import dynamic_sampling_task_with_context
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.sliding_window_org",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=2 * 60 * 60,  # 2 hours
    time_limit=2 * 60 * 60 + 5,
    silo_mode=SiloMode.REGION,
)
@dynamic_sampling_task_with_context(max_task_execution=MAX_TASK_SECONDS)
def sliding_window_org(context: TaskContext) -> None:
    window_size = get_sliding_window_size()
    # In case the size is None it means that we disabled the sliding window entirely.
    if window_size is not None:
        orgs_volumes_iterator = TimedIterator(
            context,
            GetActiveOrgsVolumes(
                max_orgs=CHUNK_SIZE,
                time_interval=timedelta(hours=window_size),
                include_keep=False,
            ),
        )

        for orgs_volume in orgs_volumes_iterator:
            for org_volume in orgs_volume:
                adjust_base_sample_rate_of_org(
                    org_id=org_volume.org_id,
                    total_root_count=org_volume.total,
                    window_size=window_size,
                    context=context,
                )

        # Due to the synchronous nature of the sliding window org, when we arrived here, we can confidently say
        # that the execution of the sliding window org was successful. We will keep this state for 1 hour.
        mark_sliding_window_org_executed()


def adjust_base_sample_rate_of_org(
    org_id: int, total_root_count: int, window_size: int, context: TaskContext
) -> None:
    """
    Adjusts the base sample rate per org by considering its volume and how it fits w.r.t. to the sampling tiers.
    """
    if time.monotonic() > context.expiration_time:
        raise TimeoutException(context)

    func_name = adjust_base_sample_rate_of_org.__name__
    timer = context.get_timer(func_name)
    with timer:
        guarded_sliding_window_name = compute_guarded_sliding_window_sample_rate.__name__
        with context.get_timer(guarded_sliding_window_name):
            sample_rate = compute_guarded_sliding_window_sample_rate(
                org_id,
                None,
                total_root_count,
                window_size,
                context,
            )

            context.incr_function_state(guarded_sliding_window_name, num_iterations=1)

        # If the sample rate is None, we don't want to store a value into Redis, but we prefer to keep the system
        # with the old value.
        if sample_rate is None:
            return

        redis_update_name = "redis_updates"
        with context.get_timer(redis_update_name):
            redis_client = get_redis_client_for_ds()
            with redis_client.pipeline(transaction=False) as pipeline:
                cache_key = generate_sliding_window_org_cache_key(org_id=org_id)
                pipeline.set(cache_key, sample_rate)
                pipeline.pexpire(cache_key, DEFAULT_REDIS_CACHE_KEY_TTL)
                pipeline.execute()

            context.incr_function_state(function_id=redis_update_name, num_iterations=1)

    context.incr_function_state(function_id=func_name, num_orgs=1, num_iterations=1)
