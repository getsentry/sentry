import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, Generator, List, Optional

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

from sentry import quotas
from sentry.dynamic_sampling.rules.utils import (
    adjusted_factor,
    generate_cache_key_rebalance_factor,
    get_redis_client_for_ds,
)
from sentry.dynamic_sampling.tasks.constants import (
    MAX_REBALANCE_FACTOR,
    MAX_SECONDS,
    MIN_REBALANCE_FACTOR,
)
from sentry.dynamic_sampling.tasks.logging import log_recalibrate_orgs_errors
from sentry.dynamic_sampling.tasks.utils import dynamic_sampling_task
from sentry.sentry_metrics import indexer
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.snuba.referrer import Referrer
from sentry.tasks.base import instrumented_task
from sentry.utils.snuba import raw_snql_query


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
    # number of transactions indexed ( i.e. kept)
    indexed: int


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


def rebalance_org(org_volume: OrganizationDataVolume) -> Optional[str]:
    """
    Calculates the rebalancing factor for an org

    It takes the last interval total number of transactions and kept transactions, and
    it figures out how far it is from the desired rate ( i.e. the blended rate)
    """
    redis_client = get_redis_client_for_ds()
    factor_key = generate_cache_key_rebalance_factor(org_volume.org_id)

    desired_sample_rate = quotas.get_blended_sample_rate(  # type:ignore
        organization_id=org_volume.org_id
    )
    if desired_sample_rate is None:
        return f"Organisation with desired_sample_rate==None org_id={org_volume.org_id}"

    if org_volume.total == 0 or org_volume.indexed == 0:
        # not enough info to make adjustments ( we don't consider this an error)
        return None

    previous_interval_sample_rate = org_volume.indexed / org_volume.total
    try:
        previous_factor = float(redis_client.get(factor_key))
    except (TypeError, ValueError):
        previous_factor = 1.0

    new_factor = adjusted_factor(
        previous_factor, previous_interval_sample_rate, desired_sample_rate
    )

    if new_factor < MIN_REBALANCE_FACTOR or new_factor > MAX_REBALANCE_FACTOR:
        # whatever we did before didn't help, give up
        redis_client.delete(factor_key)
        return f"factor:{new_factor} outside of the acceptable range [{MIN_REBALANCE_FACTOR}..{MAX_REBALANCE_FACTOR}]"

    if new_factor != 1.0:
        # Finally got a good key, save it to be used in rule generation
        redis_client.set(factor_key, new_factor)
    else:
        # we are either at 1.0 no point creating an adjustment rule
        redis_client.delete(factor_key)

    return None


def get_active_orgs(max_orgs: int, time_interval: timedelta) -> Generator[List[int], None, None]:
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
    org_ids: List[int], query_interval: timedelta
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
