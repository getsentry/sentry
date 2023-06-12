from sentry.dynamic_sampling.rules.helpers.sliding_window import (
    get_sliding_window_size,
    mark_sliding_window_org_executed,
)
from sentry.dynamic_sampling.tasks.common import get_active_orgs_with_projects_counts
from sentry.dynamic_sampling.tasks.sliding_window_org.utils import (
    adjust_base_sample_rate_of_org,
    fetch_orgs_with_total_root_transactions_count,
)
from sentry.dynamic_sampling.tasks.utils import dynamic_sampling_task
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.sliding_window_org",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=2 * 60 * 60,  # 2 hours
    time_limit=2 * 60 * 60 + 5,
)
@dynamic_sampling_task()
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
