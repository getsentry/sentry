import time

import sentry_sdk
from snuba_sdk import Granularity

from sentry.dynamic_sampling.tasks.common import (
    GetActiveOrgsVolumes,
    OrganizationDataVolume,
    TimedIterator,
    TimeoutException,
)
from sentry.dynamic_sampling.tasks.constants import (
    CHUNK_SIZE,
    MAX_REBALANCE_FACTOR,
    MAX_TASK_SECONDS,
    MIN_REBALANCE_FACTOR,
    RECALIBRATE_ORGS_QUERY_INTERVAL,
)
from sentry.dynamic_sampling.tasks.helpers.recalibrate_orgs import (
    compute_adjusted_factor,
    delete_adjusted_factor,
    get_adjusted_factor,
    set_guarded_adjusted_factor,
)
from sentry.dynamic_sampling.tasks.helpers.sliding_window import get_sliding_window_org_sample_rate
from sentry.dynamic_sampling.tasks.logging import (
    log_recalibrate_org_error,
    log_recalibrate_org_state,
    log_sample_rate_source,
)
from sentry.dynamic_sampling.tasks.task_context import TaskContext
from sentry.dynamic_sampling.tasks.utils import dynamic_sampling_task_with_context
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task

# Since we are using a granularity of 60 (minute granularity), we want to have a higher time upper limit for executing
# multiple queries on Snuba.
RECALIBRATE_ORGS_MAX_SECONDS = 600


class RecalibrationError(Exception):
    def __init__(self, org_id, message):
        final_message = f"Error during recalibration of org {org_id}: {message}"
        self.message = final_message
        super().__init__(self.message)


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.recalibrate_orgs",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=2 * 60 * 60,  # 2hours
    time_limit=2 * 60 * 60 + 5,
    silo_mode=SiloMode.REGION,
)
@dynamic_sampling_task_with_context(max_task_execution=MAX_TASK_SECONDS)
def recalibrate_orgs(context: TaskContext) -> None:
    for org_volumes in TimedIterator(
        context,
        GetActiveOrgsVolumes(
            max_orgs=CHUNK_SIZE,
            time_interval=RECALIBRATE_ORGS_QUERY_INTERVAL,
            granularity=Granularity(60),
        ),
    ):
        for org_volume in org_volumes:
            try:
                recalibrate_org(org_volume, context)
            except RecalibrationError as e:
                sentry_sdk.set_extra("context-data", context.to_dict())
                log_recalibrate_org_error(org_volume.org_id, str(e))


def recalibrate_org(org_volume: OrganizationDataVolume, context: TaskContext) -> None:
    if time.monotonic() > context.expiration_time:
        raise TimeoutException(context)

    func_name = recalibrate_org.__name__
    timer = context.get_timer(func_name)
    with timer:
        # We check if the organization volume is valid for recalibration, otherwise it doesn't make sense to run the
        # recalibration.
        if not org_volume.is_valid_for_recalibration():
            raise RecalibrationError(
                org_id=org_volume.org_id, message="invalid data for recalibration"
            )

        assert org_volume.indexed is not None

        target_sample_rate = get_sliding_window_org_sample_rate(org_volume.org_id)
        log_sample_rate_source(
            org_volume.org_id, None, "recalibrate_orgs", "sliding_window_org", target_sample_rate
        )
        if target_sample_rate is None:
            raise RecalibrationError(
                org_id=org_volume.org_id,
                message="couldn't get target sample rate for recalibration",
            )

        # We compute the effective sample rate that we had in the last considered time window.
        effective_sample_rate = org_volume.indexed / org_volume.total
        # We get the previous factor that was used for the recalibration.
        previous_factor = get_adjusted_factor(org_volume.org_id)

        log_recalibrate_org_state(
            org_volume.org_id, previous_factor, effective_sample_rate, target_sample_rate
        )

        # We want to compute the new adjusted factor.
        adjusted_factor = compute_adjusted_factor(
            previous_factor, effective_sample_rate, target_sample_rate
        )
        if adjusted_factor is None:
            raise RecalibrationError(
                org_id=org_volume.org_id, message="adjusted factor can't be computed"
            )

        if adjusted_factor < MIN_REBALANCE_FACTOR or adjusted_factor > MAX_REBALANCE_FACTOR:
            # In case the new factor would result into too much recalibration, we want to remove it from cache,
            # effectively removing the generated rule.
            delete_adjusted_factor(org_volume.org_id)
            raise RecalibrationError(
                org_id=org_volume.org_id,
                message=f"factor {adjusted_factor} outside of the acceptable range [{MIN_REBALANCE_FACTOR}.."
                f"{MAX_REBALANCE_FACTOR}]",
            )

        # At the end we set the adjusted factor.
        set_guarded_adjusted_factor(org_volume.org_id, adjusted_factor)

    context.incr_function_state(function_id=func_name, num_orgs=1, num_iterations=1)
