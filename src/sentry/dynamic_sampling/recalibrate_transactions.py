import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List

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

from sentry.sentry_metrics import indexer
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)


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


def fetch_org_volumes(
    org_ids: List[int], query_interval: timedelta
) -> List[OrganizationDataVolume]:
    """
    Returns the number of total and indexed transactions received by all organisations in the
    specified interval
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
