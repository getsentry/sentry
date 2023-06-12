import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta
from typing import List, Mapping, Optional, Sequence, Tuple

from snuba_sdk import (
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Granularity,
    LimitBy,
    Op,
    OrderBy,
    Query,
    Request,
)

from sentry import options, quotas
from sentry.dynamic_sampling.models.base import ModelType
from sentry.dynamic_sampling.models.common import RebalancedItem, guarded_run
from sentry.dynamic_sampling.models.factory import model_factory
from sentry.dynamic_sampling.models.projects_rebalancing import ProjectsRebalancingInput
from sentry.dynamic_sampling.rules.base import is_sliding_window_org_enabled
from sentry.dynamic_sampling.rules.helpers.prioritise_project import (
    generate_prioritise_by_project_cache_key,
)
from sentry.dynamic_sampling.rules.helpers.sliding_window import (
    get_sliding_window_org_sample_rate,
    get_sliding_window_size,
)
from sentry.dynamic_sampling.rules.utils import (
    DecisionDropCount,
    DecisionKeepCount,
    OrganizationId,
    ProjectId,
    get_redis_client_for_ds,
)
from sentry.dynamic_sampling.tasks.common import (
    are_equal_with_epsilon,
    compute_guarded_sliding_window_sample_rate,
    sample_rate_to_float,
)
from sentry.dynamic_sampling.tasks.constants import (
    CACHE_KEY_TTL,
    CHUNK_SIZE,
    MAX_SECONDS,
    MAX_TRANSACTIONS_PER_PROJECT,
)
from sentry.dynamic_sampling.tasks.logging import log_sample_rate_source
from sentry.dynamic_sampling.tasks.sliding_window_org.utils import (
    fetch_orgs_with_total_root_transactions_count,
)
from sentry.models import Organization, Project
from sentry.sentry_metrics import indexer
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.snuba.referrer import Referrer
from sentry.tasks.relay import schedule_invalidate_project_config
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)


def fetch_projects_with_total_root_transaction_count_and_rates(
    org_ids: List[int],
    granularity: Optional[Granularity] = None,
    query_interval: Optional[timedelta] = None,
) -> Mapping[OrganizationId, Sequence[Tuple[ProjectId, int, DecisionKeepCount, DecisionDropCount]]]:
    """
    Fetches for each org and each project the total root transaction count and how many transactions were kept and
    dropped.
    """
    if query_interval is None:
        query_interval = timedelta(hours=1)
        granularity = Granularity(3600)

    aggregated_projects = defaultdict(list)
    start_time = time.time()
    offset = 0
    org_ids = list(org_ids)
    transaction_string_id = indexer.resolve_shared_org("decision")
    transaction_tag = f"tags_raw[{transaction_string_id}]"
    sample_rate = int(options.get("dynamic-sampling.prioritise_projects.sample_rate") * 100)
    metric_id = indexer.resolve_shared_org(str(TransactionMRI.COUNT_PER_ROOT_PROJECT.value))

    where = [
        Condition(Column("timestamp"), Op.GTE, datetime.utcnow() - query_interval),
        Condition(Column("timestamp"), Op.LT, datetime.utcnow()),
        Condition(Column("metric_id"), Op.EQ, metric_id),
        Condition(Column("org_id"), Op.IN, org_ids),
    ]
    if sample_rate != 100:
        where += [Condition(Function("modulo", [Column("org_id"), 100]), Op.LT, sample_rate)]

    keep_count = Function(
        "countIf",
        [
            Function(
                "equals",
                [Column(transaction_tag), "keep"],
            )
        ],
        alias="keep_count",
    )
    drop_count = Function(
        "countIf",
        [
            Function(
                "equals",
                [Column(transaction_tag), "drop"],
            )
        ],
        alias="drop_count",
    )

    while (time.time() - start_time) < MAX_SECONDS:
        query = (
            Query(
                match=Entity(EntityKey.GenericOrgMetricsCounters.value),
                select=[
                    Function("sum", [Column("value")], "root_count_value"),
                    Column("org_id"),
                    Column("project_id"),
                    keep_count,
                    drop_count,
                ],
                groupby=[Column("org_id"), Column("project_id")],
                where=where,
                granularity=granularity,
                orderby=[
                    OrderBy(Column("org_id"), Direction.ASC),
                    OrderBy(Column("project_id"), Direction.ASC),
                ],
            )
            .set_limitby(
                LimitBy(
                    columns=[Column("org_id"), Column("project_id")],
                    count=MAX_TRANSACTIONS_PER_PROJECT,
                )
            )
            .set_limit(CHUNK_SIZE + 1)
            .set_offset(offset)
        )
        request = Request(
            dataset=Dataset.PerformanceMetrics.value, app_id="dynamic_sampling", query=query
        )
        data = raw_snql_query(
            request,
            referrer=Referrer.DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_PROJECTS_WITH_COUNT_PER_ROOT.value,
        )["data"]
        count = len(data)
        more_results = count > CHUNK_SIZE
        offset += CHUNK_SIZE

        if more_results:
            data = data[:-1]

        for row in data:
            aggregated_projects[row["org_id"]].append(
                (row["project_id"], row["root_count_value"], row["keep_count"], row["drop_count"])
            )

        if not more_results:
            break
    else:
        logger.error(
            "",
            extra={"offset": offset},
        )

    return aggregated_projects


def adjust_sample_rates_of_projects(
    org_id: int,
    projects_with_tx_count: Sequence[Tuple[ProjectId, int, DecisionKeepCount, DecisionDropCount]],
) -> None:
    """
    Adjusts the sample rates of projects belonging to a specific org.
    """
    try:
        # We need the organization object for the feature flag.
        organization = Organization.objects.get_from_cache(id=org_id)
    except Organization.DoesNotExist:
        # In case an org is not found, it might be that it has been deleted in the time between
        # the query triggering this job and the actual execution of the job.
        organization = None

    # We get the sample rate either directly from quotas or from the new sliding window org mechanism.
    if organization is not None and is_sliding_window_org_enabled(organization):
        sample_rate = get_adjusted_base_rate_from_cache_or_compute(org_id)
        log_sample_rate_source(
            org_id, None, "prioritise_by_project", "sliding_window_org", sample_rate
        )
    else:
        sample_rate = quotas.get_blended_sample_rate(organization_id=org_id)
        log_sample_rate_source(
            org_id, None, "prioritise_by_project", "blended_sample_rate", sample_rate
        )

    # If we didn't find any sample rate, it doesn't make sense to run the adjustment model.
    if sample_rate is None:
        return

    projects_with_counts = {
        project_id: count_per_root for project_id, count_per_root, _, _ in projects_with_tx_count
    }
    # Since we don't mind about strong consistency, we query a replica of the main database with the possibility of
    # having out of date information. This is a trade-off we accept, since we work under the assumption that eventually
    # the projects of an org will be replicated consistently across replicas, because no org should continue to create
    # new projects.
    all_projects_ids = (
        Project.objects.using_replica()
        .filter(organization=organization)
        .values_list("id", flat=True)
    )
    for project_id in all_projects_ids:
        # In case a specific project has not been considered in the count query, it means that no metrics were extracted
        # for it, thus we consider it as having 0 transactions for the query's time window.
        if project_id not in projects_with_counts:
            projects_with_counts[project_id] = 0

    projects = []
    for project_id, count_per_root in projects_with_counts.items():
        projects.append(
            RebalancedItem(
                id=project_id,
                count=count_per_root,
            )
        )

    model = model_factory(ModelType.PROJECTS_REBALANCING)
    rebalanced_projects = guarded_run(
        model, ProjectsRebalancingInput(classes=projects, sample_rate=sample_rate)
    )
    # In case the result of the model is None, it means that an error occurred, thus we want to early return.
    if rebalanced_projects is None:
        return

    redis_client = get_redis_client_for_ds()
    with redis_client.pipeline(transaction=False) as pipeline:
        for rebalanced_project in rebalanced_projects:
            cache_key = generate_prioritise_by_project_cache_key(org_id=org_id)
            # We want to get the old sample rate, which will be None in case it was not set.
            old_sample_rate = sample_rate_to_float(
                redis_client.hget(cache_key, rebalanced_project.id)
            )

            # We want to store the new sample rate as a string.
            pipeline.hset(
                cache_key,
                rebalanced_project.id,
                rebalanced_project.new_sample_rate,  # redis stores is as string
            )
            pipeline.pexpire(cache_key, CACHE_KEY_TTL)

            # We invalidate the caches only if there was a change in the sample rate. This is to avoid flooding the
            # system with project config invalidations, especially for projects with no volume.
            if not are_equal_with_epsilon(old_sample_rate, rebalanced_project.new_sample_rate):
                schedule_invalidate_project_config(
                    project_id=rebalanced_project.id,
                    trigger="dynamic_sampling_prioritise_project_bias",
                )

        pipeline.execute()


def get_adjusted_base_rate_from_cache_or_compute(org_id: int) -> Optional[float]:
    """
    Gets the adjusted base sample rate from the sliding window directly from the Redis cache or tries to compute
    it synchronously.
    """
    # We first try to get from cache the sliding window org sample rate.
    sample_rate = get_sliding_window_org_sample_rate(org_id)
    if sample_rate is not None:
        return sample_rate

    # In case we didn't find the value in cache, we want to compute it synchronously.
    window_size = get_sliding_window_size()
    # In case the size is None it means that we disabled the sliding window entirely.
    if window_size is not None:
        # We want to synchronously fetch the orgs and compute the sliding window org sample rate.
        orgs_with_counts = fetch_orgs_with_total_root_transactions_count(
            org_ids=[org_id], window_size=window_size
        )
        if (org_total_root_count := orgs_with_counts.get(org_id)) is not None:
            return compute_guarded_sliding_window_sample_rate(
                org_id, None, org_total_root_count, window_size
            )

    return None
