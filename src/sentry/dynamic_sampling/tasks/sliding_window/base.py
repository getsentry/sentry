from sentry.dynamic_sampling.rules.helpers.sliding_window import (
    get_sliding_window_size,
    mark_sliding_window_executed,
)
from sentry.dynamic_sampling.tasks.common import get_active_orgs_with_projects_counts
from sentry.dynamic_sampling.tasks.sliding_window.utils import (
    adjust_base_sample_rates_of_projects,
    fetch_projects_with_total_root_transactions_count,
)
from sentry.dynamic_sampling.tasks.utils import dynamic_sampling_task
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.sliding_window",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=2 * 60 * 60,  # 2 hours
    time_limit=2 * 60 * 60 + 5,
)
@dynamic_sampling_task()
def sliding_window() -> None:
    window_size = get_sliding_window_size()
    # In case the size is None it means that we disabled the sliding window entirely.
    if window_size is not None:
        # It is important to note that this query will return orgs that in the last hour have had at least 1
        # transaction.
        for orgs in get_active_orgs_with_projects_counts():
            # This query on the other hand, fetches with a dynamic window size because we care about being able
            # to extrapolate monthly volume with a bigger window than the hour used in the orgs query. Thus, it can
            # be that an org is not detected because it didn't have traffic for this hour but its projects have
            # traffic in the last window_size, however this isn't a big deal since we cache the sample rate and if
            # not found we fall back to 100% (only if the sliding window has run).
            for (
                org_id,
                projects_with_total_root_count,
            ) in fetch_projects_with_total_root_transactions_count(
                org_ids=orgs, window_size=window_size
            ).items():
                with metrics.timer(
                    "sentry.dynamic_sampling.tasks.sliding_window.adjust_base_sample_rate_per_project"
                ):
                    adjust_base_sample_rates_of_projects(
                        org_id, projects_with_total_root_count, window_size
                    )

        # Due to the synchronous nature of the sliding window, when we arrived here, we can confidently say that the
        # execution of the sliding window was successful. We will keep this state for 1 hour.
        mark_sliding_window_executed()
