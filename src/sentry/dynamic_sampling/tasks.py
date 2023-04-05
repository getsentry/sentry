import logging
from collections import namedtuple
from datetime import timedelta
from typing import Sequence, Tuple

from sentry import options, quotas
from sentry.dynamic_sampling.models.adjustment_models import AdjustedModel
from sentry.dynamic_sampling.models.transaction_adjustment_model import adjust_sample_rate
from sentry.dynamic_sampling.models.utils import DSElement, actual_sample_rate
from sentry.dynamic_sampling.prioritise_projects import fetch_projects_with_total_volumes
from sentry.dynamic_sampling.prioritise_transactions import (
    ProjectTransactions,
    fetch_project_transaction_totals,
    fetch_transactions_with_total_volumes,
    get_orgs_with_project_counts,
    transactions_zip,
)
from sentry.dynamic_sampling.rules.helpers.prioritise_project import _generate_cache_key
from sentry.dynamic_sampling.rules.helpers.prioritize_transactions import (
    set_transactions_resampling_rates,
)
from sentry.dynamic_sampling.rules.utils import (
    DecisionDropCount,
    DecisionKeepCount,
    OrganizationId,
    ProjectId,
    adjusted_factor,
    generate_cache_key_adj_factor,
    get_redis_client_for_ds,
)
from sentry.dynamic_sampling.snuba_utils import get_orgs_with_project_counts_without_modulo
from sentry.models import Project
from sentry.tasks.base import instrumented_task
from sentry.tasks.relay import schedule_invalidate_project_config
from sentry.utils import metrics

CACHE_KEY_TTL = 24 * 60 * 60 * 1000  # in milliseconds

MAX_ORGS_PER_QUERY = 100
MAX_PROJECTS_PER_QUERY = 5000
MAX_TRANSACTIONS_PER_PROJECT = 20

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.prioritise_projects",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=2 * 60 * 60,  # 2hours
    time_limit=2 * 60 * 60 + 5,
)  # type: ignore
def prioritise_projects() -> None:
    metrics.incr("sentry.tasks.dynamic_sampling.prioritise_projects.start", sample_rate=1.0)
    with metrics.timer("sentry.tasks.dynamic_sampling.prioritise_projects", sample_rate=1.0):
        for orgs in get_orgs_with_project_counts_without_modulo(
            MAX_ORGS_PER_QUERY, MAX_PROJECTS_PER_QUERY
        ):
            for org_id, projects_with_tx_count_and_rates in fetch_projects_with_total_volumes(
                org_ids=orgs
            ).items():
                process_projects_sample_rates.delay(org_id, projects_with_tx_count_and_rates)
            # TODO: @andrii potentially run it as separate celery job
            for org_id, projects_with_tx_count_and_rates in fetch_projects_with_total_volumes(
                org_ids=orgs, query_interval=timedelta(minutes=5)
            ).items():
                process_projects_sample_factors.delay(org_id, projects_with_tx_count_and_rates)


@instrumented_task(
    name="sentry.dynamic_sampling.process_projects_sample_rates",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=25 * 60,  # 25 mins
    time_limit=2 * 60 + 5,
)  # type: ignore
def process_projects_sample_rates(
    org_id: OrganizationId,
    projects_with_tx_count_and_rates: Sequence[
        Tuple[ProjectId, int, DecisionKeepCount, DecisionDropCount]
    ],
) -> None:
    """
    Takes a single org id and a list of project ids
    """
    with metrics.timer("sentry.tasks.dynamic_sampling.process_projects_sample_rates.core"):
        adjust_sample_rates(org_id, projects_with_tx_count_and_rates)


def adjust_sample_rates(
    org_id: int,
    projects_with_tx_count: Sequence[Tuple[ProjectId, int, DecisionKeepCount, DecisionDropCount]],
) -> None:
    """
    This function apply model and adjust sample rate per project in org
    and store it in DS redis cluster, then we invalidate project config
    so relay can reread it, and we'll inject it from redis cache.
    """
    projects = []
    Counter = namedtuple("Counter", ["count", "count_keep", "count_drop"])
    project_ids_with_counts = {}
    for project_id, count_per_root, count_keep, count_drop in projects_with_tx_count:
        project_ids_with_counts[project_id] = Counter(count_per_root, count_keep, count_drop)

    sample_rate = None
    for project in Project.objects.get_many_from_cache(project_ids_with_counts.keys()):
        sample_rate = quotas.get_blended_sample_rate(project)
        if sample_rate is None:
            continue
        counts = project_ids_with_counts[project.id]
        projects.append(
            DSElement(
                id=project.id,
                count=counts.count,
            )
        )

    # quit early if there is now sample_rate
    if sample_rate is None:
        return

    model = AdjustedModel(projects=projects)
    ds_projects = model.adjust_sample_rates(sample_rate=sample_rate)

    redis_client = get_redis_client_for_ds()
    with redis_client.pipeline(transaction=False) as pipeline:
        for ds_project in ds_projects:
            # hash, key, value
            cache_key = _generate_cache_key(org_id=org_id)
            pipeline.hset(
                cache_key,
                ds_project.id,
                ds_project.new_sample_rate,  # redis stores is as string
            )
            pipeline.pexpire(cache_key, CACHE_KEY_TTL)
            schedule_invalidate_project_config(
                project_id=ds_project.id, trigger="dynamic_sampling_prioritise_project_bias"
            )
        pipeline.execute()


@instrumented_task(
    name="sentry.dynamic_sampling.process_projects_factors",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=25 * 60,  # 25 mins
    time_limit=2 * 60 + 5,
)  # type: ignore
def process_projects_sample_factors(
    org_id: OrganizationId,
    projects_with_tx_count_and_rates: Sequence[
        Tuple[ProjectId, int, DecisionKeepCount, DecisionDropCount]
    ],
) -> None:
    """
    Takes a single org id and a list of project ids
    """
    with metrics.timer("sentry.tasks.dynamic_sampling.process_projects_factors.core"):
        redis_client = get_redis_client_for_ds()
        Counter = namedtuple("Counter", ["count", "count_keep", "count_drop"])
        project_ids_with_counts = {}
        for project_id, count_per_root, count_keep, count_drop in projects_with_tx_count_and_rates:
            project_ids_with_counts[project_id] = Counter(count_per_root, count_keep, count_drop)

        with redis_client.pipeline(transaction=False) as pipeline:
            for project in Project.objects.get_many_from_cache(project_ids_with_counts.keys()):
                desired_sample_rate = quotas.get_blended_sample_rate(project)

                if not desired_sample_rate:
                    continue

                counter = project_ids_with_counts[project.id]
                if (actual_rate := actual_sample_rate(counter.count_keep, counter.count_drop)) != 0:
                    adj_factor_cache_key = generate_cache_key_adj_factor(org_id)

                    try:
                        prev_factor = float(pipeline.hget(adj_factor_cache_key, project.id))
                    except (TypeError, ValueError):
                        prev_factor = 1.0

                    new_factor = adjusted_factor(prev_factor, actual_rate, desired_sample_rate)

                    pipeline.hset(adj_factor_cache_key, project.id, new_factor)
                    pipeline.pexpire(adj_factor_cache_key, CACHE_KEY_TTL)

                schedule_invalidate_project_config(
                    project_id=project.id, trigger="dynamic_sampling_process_projects_factors"
                )
            pipeline.execute()


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.prioritise_transactions",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=2 * 60 * 60,  # 2hours
    time_limit=2 * 60 * 60 + 5,
)  # type: ignore
def prioritise_transactions() -> None:
    """
    A task that retrieves all relative transaction counts from all projects in all orgs
    and invokes a task for rebalancing transaction sampling rates within each project
    """
    metrics.incr("sentry.tasks.dynamic_sampling.prioritise_transactions.start", sample_rate=1.0)

    num_big_trans = int(
        options.get("dynamic-sampling.prioritise_transactions.num_explicit_large_transactions")
    )
    num_small_trans = int(
        options.get("dynamic-sampling.prioritise_transactions.num_explicit_small_transactions")
    )

    with metrics.timer("sentry.tasks.dynamic_sampling.prioritise_transactions", sample_rate=1.0):
        for orgs in get_orgs_with_project_counts(MAX_ORGS_PER_QUERY, MAX_PROJECTS_PER_QUERY):
            # get the low and high transactions
            for project_transactions in transactions_zip(
                fetch_project_transaction_totals(orgs),
                fetch_transactions_with_total_volumes(
                    orgs,
                    large_transactions=True,
                    max_transactions=num_big_trans,
                ),
                fetch_transactions_with_total_volumes(
                    orgs,
                    large_transactions=False,
                    max_transactions=num_small_trans,
                ),
            ):
                process_transaction_biases.delay(project_transactions)


@instrumented_task(
    name="sentry.dynamic_sampling.process_transaction_biases",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=25 * 60,  # 25 mins
    time_limit=2 * 60 + 5,
)  # type: ignore
def process_transaction_biases(project_transactions: ProjectTransactions) -> None:
    """
    A task that given a project relative transaction counts calculates rebalancing
    sampling rates based on the overall desired project sampling rate.
    """

    org_id = project_transactions["org_id"]
    project_id = project_transactions["project_id"]
    transactions = project_transactions["transaction_counts"]
    total_num_transactions = project_transactions.get("total_num_transactions")
    total_num_classes = project_transactions.get("total_num_classes")
    project = Project.objects.get_from_cache(id=project_id)
    sample_rate = quotas.get_blended_sample_rate(project)

    if sample_rate is None or sample_rate == 1.0:
        # no sampling => no rebalancing
        return

    named_rates, implicit_rate = adjust_sample_rate(
        classes=transactions,
        rate=sample_rate,
        total_num_classes=total_num_classes,
        total=total_num_transactions,
    )

    set_transactions_resampling_rates(
        org_id=org_id,
        proj_id=project_id,
        named_rates=named_rates,
        default_rate=implicit_rate,
        ttl_ms=CACHE_KEY_TTL,
    )

    schedule_invalidate_project_config(
        project_id=project_id, trigger="dynamic_sampling_prioritise_transaction_bias"
    )
