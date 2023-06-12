from datetime import timedelta
from typing import Dict

from sentry.dynamic_sampling.tasks.logging import log_recalibrate_orgs_errors
from sentry.dynamic_sampling.tasks.recalibrate_orgs.utils import (
    fetch_org_volumes,
    get_active_orgs,
    rebalance_org,
)
from sentry.dynamic_sampling.tasks.utils import dynamic_sampling_task
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.recalibrate_orgs",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=2 * 60 * 60,  # 2hours
    time_limit=2 * 60 * 60 + 5,
)
@dynamic_sampling_task()
def recalibrate_orgs() -> None:
    query_interval = timedelta(minutes=5)

    # use a dict instead of a list to easily pass it to the logger in the extra field
    errors: Dict[str, str] = {}
    for orgs in get_active_orgs(1000, query_interval):
        for org_volume in fetch_org_volumes(orgs, query_interval):
            error = rebalance_org(org_volume)
            if error and len(errors) < 100:
                error_message = f"organisation:{org_volume.org_id} with {org_volume.total} transactions from which {org_volume.indexed} indexed, generated error:{error}"
                errors[str(org_volume.org_id)] = error_message

    if errors:
        log_recalibrate_orgs_errors(errors=errors)
