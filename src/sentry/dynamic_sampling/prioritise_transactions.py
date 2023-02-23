import logging
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Generator, List, Tuple

from snuba_sdk import (
    AliasedExpression,
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

from sentry.sentry_metrics.indexer.strings import SHARED_STRINGS, TRANSACTION_METRICS_NAMES
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)
MAX_SECONDS = 60
CHUNK_SIZE = 1000


@dataclass(frozen=True)
class ProjectTransactions:
    project_id: int
    org_id: int
    transaction_counts: List[Tuple[str, int]]

    @staticmethod
    def from_dict(val: dict) -> "ProjectTransactions":
        # let it raise if there are missing keys
        project_id = val["project_id"]
        org_id = val["org_id"]
        tc = val["transaction_counts"]
        # change list to tuple for internal elements
        transaction_counts = [(name, count) for name, count in tc]

        return ProjectTransactions(
            project_id=project_id, org_id=org_id, transaction_counts=transaction_counts
        )


def fetch_transactions_with_total_volumes() -> Generator[ProjectTransactions, None, None]:
    """
    Fetch transactions for all orgs and all projects  with pagination orgs and projects with count per root project
    """
    start_time = time.time()
    offset = 0
    transaction_tag = f"tags_raw[{SHARED_STRINGS['transaction']}]"
    current_org_id = None
    current_proj_id = None
    transaction_counts: List[Tuple[str, int]] = []
    while (time.time() - start_time) < MAX_SECONDS:
        query = (
            Query(
                match=Entity(EntityKey.GenericOrgMetricsCounters.value),
                select=[
                    Function("sum", [Column("value")], "num_transactions"),
                    Column("org_id"),
                    Column("project_id"),
                    AliasedExpression(Column(transaction_tag), "transaction_name"),
                ],
                groupby=[
                    Column("org_id"),
                    Column("project_id"),
                    AliasedExpression(Column(transaction_tag), "transaction_name"),
                ],
                where=[
                    Condition(Column("timestamp"), Op.GTE, datetime.utcnow() - timedelta(hours=6)),
                    Condition(Column("timestamp"), Op.LT, datetime.utcnow()),
                    Condition(
                        Column("metric_id"),
                        Op.EQ,
                        TRANSACTION_METRICS_NAMES[TransactionMRI.COUNT_PER_ROOT_PROJECT.value],
                    ),
                ],
                granularity=Granularity(3600),
                orderby=[
                    OrderBy(Column("org_id"), Direction.ASC),
                    OrderBy(Column("project_id"), Direction.ASC),
                    OrderBy(Column(transaction_tag), Direction.ASC),
                ],
            )
            .set_limit(CHUNK_SIZE + 1)
            .set_offset(offset)
        )
        request = Request(
            dataset=Dataset.PerformanceMetrics.value, app_id="dynamic_sampling", query=query
        )
        data = raw_snql_query(
            request,
            referrer="dynamic_sampling.fetch_projects_with_count_per_transaction_volumes",
        )["data"]
        count = len(data)
        more_results = count > CHUNK_SIZE
        offset += CHUNK_SIZE

        if more_results:
            data = data[:-1]

        for row in data:
            proj_id = row["project_id"]
            org_id = row["org_id"]
            transaction_name = row["transaction_name"]
            num_transactions = row["num_transactions"]
            if current_proj_id != proj_id or current_org_id != org_id:
                if len(transaction_counts) > 0:
                    yield ProjectTransactions(
                        project_id=current_proj_id,
                        org_id=current_org_id,
                        transaction_counts=transaction_counts,
                    )
                transaction_counts = []
                current_org_id = org_id
                current_proj_id = proj_id
            transaction_counts.append((transaction_name, num_transactions))
        if not more_results:
            if len(transaction_counts) > 0:
                yield ProjectTransactions(
                    project_id=current_proj_id,
                    org_id=current_org_id,
                    transaction_counts=transaction_counts,
                )
            break
    else:
        logger.error(
            "",
            extra={"offset": offset},
        )

    return None
