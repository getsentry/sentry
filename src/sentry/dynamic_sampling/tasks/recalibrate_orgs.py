import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Generator, List

from snuba_sdk import (
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Granularity,
    Op,
    OrderBy,
    Query,
    Request,
)

from sentry.dynamic_sampling.tasks.common import get_adjusted_base_rate_from_cache_or_compute
from sentry.dynamic_sampling.tasks.constants import (
    MAX_REBALANCE_FACTOR,
    MAX_SECONDS,
    MIN_REBALANCE_FACTOR,
    RECALIBRATE_ORGS_QUERY_INTERVAL,
)
from sentry.dynamic_sampling.tasks.helpers.recalibrate_orgs import (
    compute_adjusted_factor,
    delete_adjusted_factor,
    get_adjusted_factor,
    set_guarded_adjusted_factor,
)
from sentry.dynamic_sampling.tasks.logging import (
    log_action_if,
    log_recalibrate_org_error,
    log_recalibrate_org_state,
    log_sample_rate_source,
)
from sentry.dynamic_sampling.tasks.utils import dynamic_sampling_task
from sentry.sentry_metrics import indexer
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.snuba.referrer import Referrer
from sentry.tasks.base import instrumented_task
from sentry.utils.snuba import raw_snql_query


class RecalibrationError(Exception):
    def __init__(self, org_id, message):
        final_message = f"Error during recalibration of org {org_id}: {message}"
        self.message = final_message
        super().__init__(self.message)


@dataclass(frozen=True)
class OrganizationDataVolume:
    """
    Represents the total and indexed number of transactions received by an organisation
    (in a particular interval of time).
    """

    # organisation id
    org_id: int
    # total number of transactions
    total: int
    # number of transactions indexed (i.e. stored)
    indexed: int

    def is_valid_for_recalibration(self):
        return self.total > 0 and self.indexed > 0


def orgs_to_check(org_volume: OrganizationDataVolume):
    return lambda: org_volume.org_id in [1, 1407395]


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.recalibrate_orgs",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=2 * 60 * 60,  # 2hours
    time_limit=2 * 60 * 60 + 5,
)
@dynamic_sampling_task
def recalibrate_orgs() -> None:
    for orgs in get_active_orgs(1000):
        for org_volume in fetch_org_volumes(orgs):
            try:
                log_action_if("starting_recalibration", {}, orgs_to_check(org_volume))

                recalibrate_org(org_volume)
            except Exception as e:
                log_recalibrate_org_error(org_volume.org_id, str(e))


def recalibrate_org(org_volume: OrganizationDataVolume) -> None:
    # We check if the organization volume is valid for recalibration, otherwise it doesn't make sense to run the
    # recalibration.
    if not org_volume.is_valid_for_recalibration():
        raise RecalibrationError(org_id=org_volume.org_id, message="invalid data for recalibration")

    log_action_if("ready_for_recalibration", {}, orgs_to_check(org_volume))

    target_sample_rate = get_adjusted_base_rate_from_cache_or_compute(org_volume.org_id)
    log_sample_rate_source(
        org_volume.org_id, None, "recalibrate_orgs", "sliding_window_org", target_sample_rate
    )
    if target_sample_rate is None:
        raise RecalibrationError(
            org_id=org_volume.org_id, message="couldn't get target sample rate for recalibration"
        )

    log_action_if("target_sample_rate_determined", {}, orgs_to_check(org_volume))

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
        # In case the new factor would result into too much recalibration, we want to remove it from cache, effectively
        # removing the generated rule.
        delete_adjusted_factor(org_volume.org_id)
        raise RecalibrationError(
            org_id=org_volume.org_id,
            message=f"factor {adjusted_factor} outside of the acceptable range [{MIN_REBALANCE_FACTOR}..{MAX_REBALANCE_FACTOR}]",
        )

    # At the end we set the adjusted factor.
    set_guarded_adjusted_factor(org_volume.org_id, adjusted_factor)

    log_action_if("set_adjusted_factor", {}, orgs_to_check(org_volume))


def get_active_orgs(
    max_orgs: int, time_interval: timedelta = RECALIBRATE_ORGS_QUERY_INTERVAL
) -> Generator[List[int], None, None]:
    """
    Fetch organisations in batches.
    A batch will return at max max_orgs elements
    """
    start_time = time.time()
    metric_id = indexer.resolve_shared_org(str(TransactionMRI.COUNT_PER_ROOT_PROJECT.value))
    offset = 0

    while (time.time() - start_time) < MAX_SECONDS:
        query = (
            Query(
                match=Entity(EntityKey.GenericOrgMetricsCounters.value),
                select=[
                    Function("uniq", [Column("project_id")], "num_projects"),
                    Column("org_id"),
                ],
                groupby=[
                    Column("org_id"),
                ],
                where=[
                    Condition(Column("timestamp"), Op.GTE, datetime.utcnow() - time_interval),
                    Condition(Column("timestamp"), Op.LT, datetime.utcnow()),
                    Condition(Column("metric_id"), Op.EQ, metric_id),
                ],
                granularity=Granularity(60),
                orderby=[
                    OrderBy(Column("org_id"), Direction.ASC),
                ],
            )
            .set_limit(max_orgs + 1)
            .set_offset(offset)
        )
        request = Request(
            dataset=Dataset.PerformanceMetrics.value, app_id="dynamic_sampling", query=query
        )
        data = raw_snql_query(
            request,
            referrer=Referrer.DYNAMIC_SAMPLING_COUNTERS_GET_ACTIVE_ORGS.value,
        )["data"]
        count = len(data)
        more_results = count > max_orgs
        offset += max_orgs
        if more_results:
            data = data[:-1]

        ret_val = []

        for row in data:
            ret_val.append(row["org_id"])

        yield ret_val

        if not more_results:
            return


def fetch_org_volumes(
    org_ids: List[int], query_interval: timedelta = RECALIBRATE_ORGS_QUERY_INTERVAL
) -> List[OrganizationDataVolume]:
    """
    Returns the number of total and indexed transactions received by all organisations in the
    specified interval.
    """
    transaction_string_id = indexer.resolve_shared_org("decision")
    transaction_tag = f"tags_raw[{transaction_string_id}]"
    metric_id = indexer.resolve_shared_org(str(TransactionMRI.COUNT_PER_ROOT_PROJECT.value))
    where = [
        Condition(Column("timestamp"), Op.GTE, datetime.utcnow() - query_interval),
        Condition(Column("timestamp"), Op.LT, datetime.utcnow()),
        Condition(Column("metric_id"), Op.EQ, metric_id),
        Condition(Column("org_id"), Op.IN, org_ids),
    ]

    keep_count = Function(
        "sumIf",
        [
            Column("value"),
            Function(
                "equals",
                [Column(transaction_tag), "keep"],
            ),
        ],
        alias="keep_count",
    )

    ret_val: List[OrganizationDataVolume] = []

    query = Query(
        match=Entity(EntityKey.GenericOrgMetricsCounters.value),
        select=[
            Function("sum", [Column("value")], "total_count"),
            Column("org_id"),
            keep_count,
        ],
        groupby=[Column("org_id")],
        where=where,
        granularity=Granularity(60),
        orderby=[
            OrderBy(Column("org_id"), Direction.ASC),
        ],
    )
    request = Request(
        dataset=Dataset.PerformanceMetrics.value, app_id="dynamic_sampling", query=query
    )
    data = raw_snql_query(
        request,
        referrer=Referrer.DYNAMIC_SAMPLING_COUNTERS_GET_ORG_TRANSACTION_VOLUMES.value,
    )["data"]

    for row in data:
        ret_val.append(
            OrganizationDataVolume(
                org_id=row["org_id"], total=row["total_count"], indexed=row["keep_count"]
            )
        )

    return ret_val
