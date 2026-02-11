from __future__ import annotations

from collections.abc import Sequence
from datetime import timedelta

from sentry import options
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.common import (
    GetActiveOrgsVolumes,
    OrganizationDataVolume,
    compute_guarded_sliding_window_sample_rate,
)
from sentry.dynamic_sampling.tasks.constants import CHUNK_SIZE, DEFAULT_REDIS_CACHE_KEY_TTL
from sentry.dynamic_sampling.tasks.helpers.sliding_window import (
    generate_sliding_window_org_cache_key,
    get_sliding_window_size,
    mark_sliding_window_org_executed,
)
from sentry.dynamic_sampling.tasks.utils import dynamic_sampling_task
from sentry.dynamic_sampling.types import SamplingMeasure
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import telemetry_experience_tasks
from sentry.taskworker.retry import Retry


def _get_segments_org_ids() -> set[int]:
    """
    Returns the set of organization IDs that should use SEGMENTS measure.
    """
    return set(options.get("dynamic-sampling.sliding_window_org.segment-metric-orgs") or [])


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
    if window_size is None:
        return

    segments_org_ids = _get_segments_org_ids()

    # Process orgs using segment metrics (opted-in via option)
    if segments_org_ids:
        for segment_volumes in GetActiveOrgsVolumes(
            max_orgs=CHUNK_SIZE,
            time_interval=timedelta(hours=window_size),
            include_keep=False,
            measure=SamplingMeasure.SEGMENTS,
            orgs=list(segments_org_ids),
        ):
            _process_org_volumes(segment_volumes, window_size)

    # Process orgs using transaction metrics (default)
    for transaction_volumes in GetActiveOrgsVolumes(
        max_orgs=CHUNK_SIZE,
        time_interval=timedelta(hours=window_size),
        include_keep=False,
        measure=SamplingMeasure.TRANSACTIONS,
    ):
        filtered_volumes = [v for v in transaction_volumes if v.org_id not in segments_org_ids]
        _process_org_volumes(filtered_volumes, window_size)

    # Due to the synchronous nature of the sliding window org, when we arrived here, we can confidently say
    # that the execution of the sliding window org was successful. We will keep this state for 1 hour.
    mark_sliding_window_org_executed()


def _process_org_volumes(org_volumes: Sequence[OrganizationDataVolume], window_size: int) -> None:
    """
    Process sliding window calculations for the given organization volumes.

    Args:
        org_volumes: The organization volumes to process.
        window_size: The sliding window size in hours.
    """
    for org_volume in org_volumes:
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
