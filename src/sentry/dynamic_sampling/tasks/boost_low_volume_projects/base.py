from typing import Sequence, Tuple

from sentry.dynamic_sampling.rules.utils import (
    DecisionDropCount,
    DecisionKeepCount,
    OrganizationId,
    ProjectId,
)
from sentry.dynamic_sampling.tasks.boost_low_volume_projects.utils import (
    adjust_sample_rates_of_projects,
    fetch_projects_with_total_root_transaction_count_and_rates,
)
from sentry.dynamic_sampling.tasks.common import get_active_orgs_with_projects_counts
from sentry.dynamic_sampling.tasks.utils import dynamic_sampling_task
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.boost_low_volume_projects",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=2 * 60 * 60,
    time_limit=2 * 60 * 60 + 5,
)
@dynamic_sampling_task()
def boost_low_volume_projects() -> None:
    for orgs in get_active_orgs_with_projects_counts():
        for (
            org_id,
            projects_with_tx_count_and_rates,
        ) in fetch_projects_with_total_root_transaction_count_and_rates(org_ids=orgs).items():
            boost_low_volume_projects_of_org.delay(org_id, projects_with_tx_count_and_rates)


@instrumented_task(
    name="sentry.dynamic_sampling.boost_low_volume_projects_of_org",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=25 * 60,
    time_limit=2 * 60 + 5,
)
@dynamic_sampling_task()
def boost_low_volume_projects_of_org(
    org_id: OrganizationId,
    projects_with_tx_count_and_rates: Sequence[
        Tuple[ProjectId, int, DecisionKeepCount, DecisionDropCount]
    ],
) -> None:
    adjust_sample_rates_of_projects(org_id, projects_with_tx_count_and_rates)
