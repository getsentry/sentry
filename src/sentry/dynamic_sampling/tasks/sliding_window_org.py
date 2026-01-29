from __future__ import annotations

from datetime import timedelta

from sentry import options
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.common import (
    GetActiveOrgsVolumes,
    compute_guarded_sliding_window_sample_rate,
)
from sentry.dynamic_sampling.tasks.constants import CHUNK_SIZE, DEFAULT_REDIS_CACHE_KEY_TTL
from sentry.dynamic_sampling.tasks.helpers.sliding_window import (
    generate_sliding_window_org_cache_key,
    get_sliding_window_size,
    mark_sliding_window_org_executed,
)
from sentry.dynamic_sampling.tasks.utils import dynamic_sampling_task
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import telemetry_experience_tasks
from sentry.taskworker.retry import Retry


def _partition_orgs_by_span_metric_option(
    org_ids: list[int],
) -> tuple[list[int], list[int]]:
    """
    Partitions organization IDs based on the span metric option.

    Returns:
        A tuple of (span_metric_orgs, transaction_metric_orgs)
    """
    span_metric_org_ids = set(
        options.get("dynamic-sampling.sliding_window_org.span-metric-orgs") or []
    )
    span_orgs = [org_id for org_id in org_ids if org_id in span_metric_org_ids]
    transaction_orgs = [org_id for org_id in org_ids if org_id not in span_metric_org_ids]
    return span_orgs, transaction_orgs


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.sliding_window_org",
    namespace=telemetry_experience_tasks,
    processing_deadline_duration=15 * 60 + 5,
    retry=Retry(times=5, delay=5),
    silo_mode=SiloMode.REGION,
)
@dynamic_sampling_task
def sliding_window_org() -> None:
    window_size = get_sliding_window_size()
    # In case the size is None it means that we disabled the sliding window entirely.
    if window_size is not None:
        # Process orgs using transaction metrics (default)
        _process_orgs_volumes(window_size, use_span_metric=False)
        # Process orgs using span metrics (opted-in via option)
        _process_orgs_volumes(window_size, use_span_metric=True)

        # Due to the synchronous nature of the sliding window org, when we arrived here, we can confidently say
        # that the execution of the sliding window org was successful. We will keep this state for 1 hour.
        mark_sliding_window_org_executed()


def _process_orgs_volumes(window_size: int, use_span_metric: bool) -> None:
    """
    Process organization volumes for sliding window calculation.

    Args:
        window_size: The size of the sliding window in hours.
        use_span_metric: Whether to use span metrics instead of transaction metrics.
    """
    orgs_volumes_iterator = GetActiveOrgsVolumes(
        max_orgs=CHUNK_SIZE,
        time_interval=timedelta(hours=window_size),
        include_keep=False,
        use_span_metric=use_span_metric,
    )

    for orgs_volume in orgs_volumes_iterator:
        # Filter to only orgs that match the metric type based on option
        org_ids = [v.org_id for v in orgs_volume]
        span_orgs, transaction_orgs = _partition_orgs_by_span_metric_option(org_ids)
        target_orgs = set(span_orgs if use_span_metric else transaction_orgs)

        for org_volume in orgs_volume:
            if org_volume.org_id not in target_orgs:
                continue
            adjust_base_sample_rate_of_org(
                org_id=org_volume.org_id,
                total_root_count=org_volume.total,
                window_size=window_size,
            )


def adjust_base_sample_rate_of_org(org_id: int, total_root_count: int, window_size: int) -> None:
    """
    Adjusts the base sample rate per org by considering its volume and how it fits w.r.t. to the sampling tiers.
    """
    sample_rate = compute_guarded_sliding_window_sample_rate(
        org_id,
        None,
        total_root_count,
        window_size,
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
