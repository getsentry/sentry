import logging
from collections import defaultdict
from collections.abc import Iterator, Mapping, Sequence
from datetime import datetime, timedelta

import sentry_sdk
from snuba_sdk import (
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Granularity,
    Limit,
    LimitBy,
    Op,
    OrderBy,
    Query,
    Request,
)

from sentry import features, options, quotas
from sentry.constants import ObjectStatus
from sentry.dynamic_sampling.models.base import ModelType
from sentry.dynamic_sampling.models.common import RebalancedItem, guarded_run
from sentry.dynamic_sampling.models.factory import model_factory
from sentry.dynamic_sampling.models.projects_rebalancing import ProjectsRebalancingInput
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
    are_equal_with_epsilon,
    sample_rate_to_float,
    to_context_iterator,
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
from sentry.dynamic_sampling.tasks.helpers.sample_rate import get_org_sample_rate
from sentry.dynamic_sampling.tasks.logging import log_sample_rate_source
from sentry.dynamic_sampling.tasks.task_context import TaskContext
from sentry.dynamic_sampling.tasks.utils import (
    dynamic_sampling_task,
    dynamic_sampling_task_with_context,
    sample_function,
)
from sentry.dynamic_sampling.types import DynamicSamplingMode, SamplingMeasure
from sentry.dynamic_sampling.utils import has_dynamic_sampling, is_project_mode_sampling
from sentry.models.options import OrganizationOption
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.naming_layer.mri import SpanMRI, TransactionMRI
from sentry.snuba.referrer import Referrer
from sentry.tasks.base import instrumented_task
from sentry.tasks.relay import schedule_invalidate_project_config
from sentry.utils import metrics
from sentry.utils.snuba import raw_snql_query

# This set contains all the projects for which we want to start extracting the sample rate over time. This is done
# as a temporary solution to dogfood our own product without exploding the cardinality of the project_id tag.
PROJECTS_WITH_METRICS = {1, 11276}  # sentry  # javascript
logger = logging.getLogger(__name__)

# a tuple type alias of project_id, root_count, keep_count, drop_count, to be used in extraction of metrics for a specific project
ProjectVolumes = tuple[ProjectId, int, DecisionKeepCount, DecisionDropCount]

# the same as ProjectVolumes, but with the organization ID added
OrgProjectVolumes = tuple[OrganizationId, ProjectId, int, DecisionKeepCount, DecisionDropCount]


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.boost_low_volume_projects",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=10 * 60,  # 5 minutes
    time_limit=10 * 60 + 5,
    silo_mode=SiloMode.REGION,
)
@dynamic_sampling_task_with_context(max_task_execution=MAX_TASK_SECONDS)
def boost_low_volume_projects(context: TaskContext) -> None:
    """
    Task to adjusts the sample rates of all projects in all active organizations.
    """
    logger.info(
        "boost_low_volume_projects",
        extra={"traceparent": sentry_sdk.get_traceparent(), "baggage": sentry_sdk.get_baggage()},
    )

    # NB: This always uses the *transactions* root count just to get the list of orgs.
    for orgs in TimedIterator(context, GetActiveOrgs(max_projects=MAX_PROJECTS_PER_QUERY)):
        for measure, orgs in partition_by_measure(orgs).items():
            for org_id, projects in fetch_projects_with_total_root_transaction_count_and_rates(
                context, org_ids=orgs, measure=measure
            ).items():
                boost_low_volume_projects_of_org.apply_async(
                    kwargs={
                        "org_id": org_id,
                        "projects_with_tx_count_and_rates": projects,
                    },
                    headers={"sentry-propagate-traces": False},
                )


@metrics.wraps("dynamic_sampling.partition_by_measure")
def partition_by_measure(
    org_ids: list[OrganizationId],
) -> Mapping[SamplingMeasure, list[OrganizationId]]:
    """
    Partitions the orgs by the measure that will be used to adjust the sample
    rates. This is controlled through a feature flag on the organization,
    determined by its plan.

    Only organizations with organization-mode sampling will be considered. In
    project-mode sampling, the sample rate is set per project, so there is no
    need to adjust the sample rates.
    """

    original_orgs = Organization.objects.get_many_from_cache(org_ids)
    modes = OrganizationOption.objects.get_value_bulk(original_orgs, "sentry:sampling_mode")

    # Exclude orgs with project-mode sampling from the start. We know the
    # default is DynamicSamplingMode.ORGANIZATION.
    orgs = [org for org, mode in modes.items() if mode != DynamicSamplingMode.PROJECT]

    if not options.get("dynamic-sampling.check_span_feature_flag"):
        return {SamplingMeasure.TRANSACTIONS: [org.id for org in orgs]}

    spans = []
    transactions = []

    for org in orgs:
        # This is an N+1 query that fetches getsentry database models
        # internally, but we cannot abstract over batches of feature flag
        # handlers yet. Hence, we must fetch organizations and do individual
        # feature checks per org.
        if features.has("organizations:dynamic-sampling-spans", org):
            spans.append(org.id)
        else:
            transactions.append(org.id)

    return {SamplingMeasure.SPANS: spans, SamplingMeasure.TRANSACTIONS: transactions}


@instrumented_task(
    name="sentry.dynamic_sampling.boost_low_volume_projects_of_org_with_query",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=3 * 60,
    time_limit=3 * 60 + 5,
    silo_mode=SiloMode.REGION,
)
@dynamic_sampling_task_with_context(max_task_execution=MAX_TASK_SECONDS)
def boost_low_volume_projects_of_org_with_query(
    context: TaskContext,
    org_id: OrganizationId,
) -> None:
    """
    Task to adjust the sample rates of the projects of a single organization specified by an
    organization ID. Transaction counts and rates are fetched within this task.
    """
    logger.info(
        "boost_low_volume_projects_of_org_with_query",
        extra={"traceparent": sentry_sdk.get_traceparent(), "baggage": sentry_sdk.get_baggage()},
    )

    org = Organization.objects.get_from_cache(id=org_id)
    if is_project_mode_sampling(org):
        return

    measure = SamplingMeasure.TRANSACTIONS
    if options.get("dynamic-sampling.check_span_feature_flag") and features.has(
        "organizations:dynamic-sampling-spans", org
    ):
        measure = SamplingMeasure.SPANS

    projects_with_tx_count_and_rates = fetch_projects_with_total_root_transaction_count_and_rates(
        context,
        org_ids=[org_id],
        measure=measure,
    )[org_id]
    rebalanced_projects = calculate_sample_rates_of_projects(
        org_id, projects_with_tx_count_and_rates
    )
    if rebalanced_projects is not None:
        store_rebalanced_projects(org_id, rebalanced_projects)


@instrumented_task(
    name="sentry.dynamic_sampling.boost_low_volume_projects_of_org",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=3 * 60,
    time_limit=3 * 60 + 5,
    silo_mode=SiloMode.REGION,
)
@dynamic_sampling_task
def boost_low_volume_projects_of_org(
    org_id: OrganizationId,
    projects_with_tx_count_and_rates: Sequence[ProjectVolumes],
) -> None:
    """
    Task to adjust the sample rates of the projects of a single organization specified by an
    organization ID. Transaction counts and rates have to be provided.
    """
    logger.info(
        "boost_low_volume_projects_of_org",
        extra={"traceparent": sentry_sdk.get_traceparent(), "baggage": sentry_sdk.get_baggage()},
    )
    rebalanced_projects = calculate_sample_rates_of_projects(
        org_id, projects_with_tx_count_and_rates
    )
    if rebalanced_projects is not None:
        store_rebalanced_projects(org_id, rebalanced_projects)


def fetch_projects_with_total_root_transaction_count_and_rates(
    context: TaskContext,
    org_ids: list[int],
    measure: SamplingMeasure,
    query_interval: timedelta | None = None,
) -> Mapping[OrganizationId, Sequence[ProjectVolumes]]:
    """
    Fetches for each org and each project the total root transaction count and how many transactions were kept and
    dropped.
    """
    func_name = fetch_projects_with_total_root_transaction_count_and_rates.__name__
    timer = context.get_timer(func_name)
    with timer:
        context.incr_function_state(func_name, num_iterations=1)

        project_count_query_iter = to_context_iterator(
            query_project_counts_by_org(
                org_ids,
                measure,
                query_interval,
            )
        )
        aggregated_projects = defaultdict(list)
        for chunk in TimedIterator(context, project_count_query_iter, func_name):
            for org_id, project_id, root_count_value, keep_count, drop_count in chunk:
                aggregated_projects[org_id].append(
                    (
                        project_id,
                        root_count_value,
                        keep_count,
                        drop_count,
                    )
                )

            context.incr_function_state(
                function_id=func_name,
                num_db_calls=1,
                num_rows_total=len(chunk),
                num_projects=len(chunk),
            )
            context.get_function_state(func_name).num_orgs = len(aggregated_projects)

        return aggregated_projects


def query_project_counts_by_org(
    org_ids: list[int], measure: SamplingMeasure, query_interval: timedelta | None = None
) -> Iterator[Sequence[OrgProjectVolumes]]:
    """Queries the total root transaction count and how many transactions were kept and dropped
    for each project in a given interval (defaults to the last hour).

    Yields chunks of result rows, to allow timeouts to be handled in the caller.
    """
    if query_interval is None:
        query_interval = timedelta(hours=1)

    if query_interval > timedelta(days=1):
        granularity = Granularity(24 * 3600)
    else:
        granularity = Granularity(3600)

    org_ids = list(org_ids)
    project_ids = list(
        Project.objects.filter(organization_id__in=org_ids, status=ObjectStatus.ACTIVE).values_list(
            "id", flat=True
        )
    )
    transaction_string_id = indexer.resolve_shared_org("decision")
    transaction_tag = f"tags_raw[{transaction_string_id}]"
    if measure == SamplingMeasure.SPANS:
        metric_id = indexer.resolve_shared_org(str(SpanMRI.COUNT_PER_ROOT_PROJECT.value))
    elif measure == SamplingMeasure.TRANSACTIONS:
        metric_id = indexer.resolve_shared_org(str(TransactionMRI.COUNT_PER_ROOT_PROJECT.value))
    else:
        raise ValueError(f"Unsupported measure: {measure}")

    query = Query(
        match=Entity(EntityKey.GenericOrgMetricsCounters.value),
        select=[
            Function("sum", [Column("value")], "root_count_value"),
            Column("org_id"),
            Column("project_id"),
            Function(
                "sumIf",
                [
                    Column("value"),
                    Function("equals", [Column(transaction_tag), "keep"]),
                ],
                alias="keep_count",
            ),
            Function(
                "sumIf",
                [
                    Column("value"),
                    Function("equals", [Column(transaction_tag), "drop"]),
                ],
                alias="drop_count",
            ),
        ],
        groupby=[Column("org_id"), Column("project_id")],
        where=[
            Condition(Column("timestamp"), Op.GTE, datetime.utcnow() - query_interval),
            Condition(Column("timestamp"), Op.LT, datetime.utcnow()),
            Condition(Column("metric_id"), Op.EQ, metric_id),
            Condition(Column("org_id"), Op.IN, org_ids),
            Condition(Column("project_id"), Op.IN, project_ids),
        ],
        granularity=granularity,
        orderby=[
            OrderBy(Column("org_id"), Direction.ASC),
            OrderBy(Column("project_id"), Direction.ASC),
        ],
        limitby=LimitBy(
            columns=[Column("org_id"), Column("project_id")],
            count=MAX_TRANSACTIONS_PER_PROJECT,
        ),
        # we are fetching one more than the chunk size to determine if there are more results
        limit=Limit(CHUNK_SIZE + 1),
    )

    offset = 0
    more_results: bool = True
    while more_results:
        request = Request(
            dataset=Dataset.PerformanceMetrics.value,
            app_id="dynamic_sampling",
            query=query.set_offset(offset),
            tenant_ids={"use_case_id": UseCaseID.TRANSACTIONS.value, "cross_org_query": 1},
        )
        data = raw_snql_query(
            request,
            referrer=Referrer.DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_PROJECTS_WITH_COUNT_PER_ROOT.value,
        )["data"]

        more_results = len(data) > CHUNK_SIZE
        offset += CHUNK_SIZE

        # re-adjust, for the extra row we fetched
        if more_results:
            data = data[:-1]

        yield [
            (
                row["org_id"],
                row["project_id"],
                row["root_count_value"],
                row["keep_count"],
                row["drop_count"],
            )
            for row in data
        ]


def calculate_sample_rates_of_projects(
    org_id: int,
    projects_with_tx_count: Sequence[ProjectVolumes],
) -> list[RebalancedItem] | None:
    """
    Calculates the sample rates of projects belonging to a specific org.
    """
    try:
        # We need the organization object for the feature flag.
        organization = Organization.objects.get_from_cache(id=org_id)
    except Organization.DoesNotExist:
        # In case an org is not found, it might be that it has been deleted in the time between
        # the query triggering this job and the actual execution of the job.
        organization = None

    # If the org doesn't have dynamic sampling, we want to early return to avoid unnecessary work.
    if not has_dynamic_sampling(organization):
        return None

    # If we have the sliding window org sample rate, we use that or fall back to the blended sample rate in case of
    # issues.
    sample_rate, success = get_org_sample_rate(
        org_id=org_id,
        default_sample_rate=quotas.backend.get_blended_sample_rate(organization_id=org_id),
    )
    if success:
        sample_function(
            function=log_sample_rate_source,
            _sample_rate=0.1,
            org_id=org_id,
            project_id=None,
            used_for="boost_low_volume_projects",
            source="sliding_window_org",
            sample_rate=sample_rate,
        )
    else:
        sample_function(
            function=log_sample_rate_source,
            _sample_rate=0.1,
            org_id=org_id,
            project_id=None,
            used_for="boost_low_volume_projects",
            source="blended_sample_rate",
            sample_rate=sample_rate,
        )

    # If we didn't find any sample rate, it doesn't make sense to run the adjustment model.
    if sample_rate is None:
        sentry_sdk.capture_message(
            "Sample rate of org not found when trying to adjust the sample rates of its projects"
        )
        return None

    projects_with_counts = {
        project_id: count_per_root for project_id, count_per_root, _, _ in projects_with_tx_count
    }
    # The rebalancing will not work (or would make sense) when we have only projects with zero-counts.
    if not any(projects_with_counts.values()):
        return None

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
    rebalanced_projects: list[RebalancedItem] | None = guarded_run(
        model, ProjectsRebalancingInput(classes=projects, sample_rate=sample_rate)
    )

    return rebalanced_projects


def store_rebalanced_projects(org_id: int, rebalanced_projects: list[RebalancedItem]) -> None:
    """Stores the rebalanced projects in the cache and invalidates the project configs."""
    redis_client = get_redis_client_for_ds()
    with redis_client.pipeline(transaction=False) as pipeline:
        for rebalanced_project in rebalanced_projects:
            cache_key = generate_boost_low_volume_projects_cache_key(org_id=org_id)
            # We want to get the old sample rate, which will be None in case it was not set.
            old_sample_rate = sample_rate_to_float(
                redis_client.hget(cache_key, str(rebalanced_project.id))
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
                str(rebalanced_project.id),
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
