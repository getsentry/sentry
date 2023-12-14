import time
from collections import defaultdict
from datetime import datetime, timedelta
from typing import List, Mapping, Optional, Sequence, Tuple

from sentry_sdk.crons.decorator import monitor
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

from sentry import quotas
from sentry.dynamic_sampling.models.base import ModelType
from sentry.dynamic_sampling.models.common import RebalancedItem, guarded_run
from sentry.dynamic_sampling.models.factory import model_factory
from sentry.dynamic_sampling.models.projects_rebalancing import ProjectsRebalancingInput
from sentry.dynamic_sampling.rules.base import is_sliding_window_org_enabled
from sentry.dynamic_sampling.rules.utils import (
    DecisionDropCount,
    DecisionKeepCount,
    OrganizationId,
    ProjectId,
    get_redis_client_for_ds,
)
from sentry.dynamic_sampling.tasks.common import (
    GetActiveOrgs,
    TimedIterator,
    TimeoutException,
    are_equal_with_epsilon,
    sample_rate_to_float,
)
from sentry.dynamic_sampling.tasks.constants import (
    CHUNK_SIZE,
    DEFAULT_REDIS_CACHE_KEY_TTL,
    MAX_PROJECTS_PER_QUERY,
    MAX_TASK_SECONDS,
    MAX_TRANSACTIONS_PER_PROJECT,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_projects import (
    generate_boost_low_volume_projects_cache_key,
)
from sentry.dynamic_sampling.tasks.helpers.sliding_window import get_sliding_window_org_sample_rate
from sentry.dynamic_sampling.tasks.logging import log_sample_rate_source
from sentry.dynamic_sampling.tasks.task_context import TaskContext
from sentry.dynamic_sampling.tasks.utils import (
    dynamic_sampling_task,
    dynamic_sampling_task_with_context,
)
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.silo import SiloMode
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.snuba.referrer import Referrer
from sentry.tasks.base import instrumented_task
from sentry.tasks.relay import schedule_invalidate_project_config
from sentry.utils import metrics
from sentry.utils.snuba import raw_snql_query

# This set contains all the projects for which we want to start extracting the sample rate over time. This is done
# as a temporary solution to dogfood our own product without exploding the cardinality of the project_id tag.
PROJECTS_WITH_METRICS = {1, 11276}  # sentry  # javascript


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.boost_low_volume_projects",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=2 * 60 * 60,
    time_limit=2 * 60 * 60 + 5,
    silo_mode=SiloMode.REGION,
)
# TODO(rjo100): dual write check-ins for debugging
@monitor(monitor_slug="dynamic-sampling-boost-low-volume-transactions-test")
@dynamic_sampling_task_with_context(max_task_execution=MAX_TASK_SECONDS)
def boost_low_volume_projects(context: TaskContext) -> None:
    for orgs in TimedIterator(context, GetActiveOrgs(max_projects=MAX_PROJECTS_PER_QUERY)):
        for (
            org_id,
            projects_with_tx_count_and_rates,
        ) in fetch_projects_with_total_root_transaction_count_and_rates(
            context, org_ids=orgs
        ).items():
            boost_low_volume_projects_of_org.delay(org_id, projects_with_tx_count_and_rates)


@instrumented_task(
    name="sentry.dynamic_sampling.boost_low_volume_projects_of_org",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=25 * 60,
    time_limit=2 * 60 + 5,
    silo_mode=SiloMode.REGION,
)
@dynamic_sampling_task
def boost_low_volume_projects_of_org(
    org_id: OrganizationId,
    projects_with_tx_count_and_rates: Sequence[
        Tuple[ProjectId, int, DecisionKeepCount, DecisionDropCount]
    ],
) -> None:
    adjust_sample_rates_of_projects(org_id, projects_with_tx_count_and_rates)


def fetch_projects_with_total_root_transaction_count_and_rates(
    context: TaskContext,
    org_ids: List[int],
    granularity: Optional[Granularity] = None,
    query_interval: Optional[timedelta] = None,
) -> Mapping[OrganizationId, Sequence[Tuple[ProjectId, int, DecisionKeepCount, DecisionDropCount]]]:
    """
    Fetches for each org and each project the total root transaction count and how many transactions were kept and
    dropped.
    """
    func_name = fetch_projects_with_total_root_transaction_count_and_rates.__name__
    timer = context.get_timer(func_name)
    with timer:
        context.incr_function_state(func_name, num_iterations=1)

        if query_interval is None:
            query_interval = timedelta(hours=1)
            granularity = Granularity(3600)

        aggregated_projects = defaultdict(list)
        offset = 0
        org_ids = list(org_ids)
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
                Function("equals", [Column(transaction_tag), "keep"]),
            ],
            alias="keep_count",
        )
        drop_count = Function(
            "sumIf",
            [
                Column("value"),
                Function("equals", [Column(transaction_tag), "drop"]),
            ],
            alias="drop_count",
        )

        while time.monotonic() < context.expiration_time:
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
                dataset=Dataset.PerformanceMetrics.value,
                app_id="dynamic_sampling",
                query=query,
                tenant_ids={"use_case_id": UseCaseID.TRANSACTIONS.value},
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
                    (
                        row["project_id"],
                        row["root_count_value"],
                        row["keep_count"],
                        row["drop_count"],
                    )
                )
                context.incr_function_state(function_id=func_name, num_projects=1)

            context.incr_function_state(
                function_id=func_name,
                num_db_calls=1,
                num_rows_total=count,
                num_orgs=len(aggregated_projects),
            )

            if not more_results:
                break
        else:
            raise TimeoutException(context)

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
        sample_rate = get_sliding_window_org_sample_rate(org_id)
        log_sample_rate_source(
            org_id, None, "boost_low_volume_projects", "sliding_window_org", sample_rate
        )
    else:
        sample_rate = quotas.backend.get_blended_sample_rate(organization_id=org_id)
        log_sample_rate_source(
            org_id, None, "boost_low_volume_projects", "blended_sample_rate", sample_rate
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
            cache_key = generate_boost_low_volume_projects_cache_key(org_id=org_id)
            # We want to get the old sample rate, which will be None in case it was not set.
            old_sample_rate = sample_rate_to_float(
                redis_client.hget(cache_key, rebalanced_project.id)
            )

            if rebalanced_project.id in PROJECTS_WITH_METRICS:
                metrics.gauge(
                    "dynamic_sampling.project_sample_rate",
                    rebalanced_project.new_sample_rate * 100,
                    tags={"project_id": rebalanced_project.id},
                    unit="percent",
                )

            # We want to store the new sample rate as a string.
            pipeline.hset(
                cache_key,
                rebalanced_project.id,
                rebalanced_project.new_sample_rate,  # redis stores is as string
            )
            pipeline.pexpire(cache_key, DEFAULT_REDIS_CACHE_KEY_TTL)

            # We invalidate the caches only if there was a change in the sample rate. This is to avoid flooding the
            # system with project config invalidations, especially for projects with no volume.
            if not are_equal_with_epsilon(old_sample_rate, rebalanced_project.new_sample_rate):
                schedule_invalidate_project_config(
                    project_id=rebalanced_project.id,
                    trigger="dynamic_sampling_boost_low_volume_projects",
                )

        pipeline.execute()
