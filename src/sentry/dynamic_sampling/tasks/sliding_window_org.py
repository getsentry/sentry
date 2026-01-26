from __future__ import annotations

from datetime import timedelta

from sentry import options
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.common import (
    GetActiveOrgs,
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
    Partition organizations by whether they are in the span-metric-orgs option.
    Returns (span_metric_orgs, transaction_metric_orgs).
    """
    span_metric_org_ids = set(
        options.get("dynamic-sampling.sliding_window_org.span-metric-orgs") or []
    )

    span_metric_orgs = []
    transaction_metric_orgs = []

    for org_id in org_ids:
        if org_id in span_metric_org_ids:
            span_metric_orgs.append(org_id)
        else:
            transaction_metric_orgs.append(org_id)

    return span_metric_orgs, transaction_metric_orgs


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
        # First get all active org IDs, then partition by feature flag
        for orgs in GetActiveOrgs(max_orgs=CHUNK_SIZE):
            span_metric_orgs, transaction_metric_orgs = _partition_orgs_by_span_metric_option(orgs)

            # Process span metric orgs
            _process_orgs_volumes(
                org_ids=span_metric_orgs,
                window_size=window_size,
                use_span_metric=True,
            )

            # Process transaction metric orgs
            _process_orgs_volumes(
                org_ids=transaction_metric_orgs,
                window_size=window_size,
                use_span_metric=False,
            )

        # Due to the synchronous nature of the sliding window org, when we arrived here, we can confidently say
        # that the execution of the sliding window org was successful. We will keep this state for 1 hour.
        mark_sliding_window_org_executed()


def _process_orgs_volumes(
    org_ids: list[int],
    window_size: int,
    use_span_metric: bool,
) -> None:
    """Process org volumes for a batch of organizations."""
    if not org_ids:
        return

    for orgs_volume in GetActiveOrgsVolumes(
        max_orgs=CHUNK_SIZE,
        time_interval=timedelta(hours=window_size),
        include_keep=False,
        orgs=org_ids,
        use_span_metric=use_span_metric,
    ):
        for org_volume in orgs_volume:
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
