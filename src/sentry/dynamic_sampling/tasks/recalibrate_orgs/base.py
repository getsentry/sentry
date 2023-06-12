import logging
from datetime import timedelta
from typing import Dict

from sentry.dynamic_sampling.recalibrate_transactions import fetch_org_volumes
from sentry.dynamic_sampling.rules.tasks.recalibrate_orgs.utils import rebalance_org
from sentry.dynamic_sampling.snuba_utils import get_active_orgs
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.recalibrate_orgs",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=2 * 60 * 60,  # 2hours
    time_limit=2 * 60 * 60 + 5,
)
def recalibrate_orgs() -> None:
    query_interval = timedelta(minutes=5)
    metrics.incr("sentry.tasks.dynamic_sampling.recalibrate_orgs.start", sample_rate=1.0)

    # use a dict instead of a list to easily pass it to the logger in the extra field
    errors: Dict[str, str] = {}

    with metrics.timer("sentry.tasks.dynamic_sampling.recalibrate_orgs", sample_rate=1.0):
        for orgs in get_active_orgs(1000, query_interval):
            for org_volume in fetch_org_volumes(orgs, query_interval):
                error = rebalance_org(org_volume)
                if error and len(errors) < 100:
                    error_message = f"organisation:{org_volume.org_id} with {org_volume.total} transactions from which {org_volume.indexed} indexed, generated error:{error}"
                    errors[str(org_volume.org_id)] = error_message

        if errors:
            logger.info("Dynamic sampling organization recalibration failed", extra=errors)
