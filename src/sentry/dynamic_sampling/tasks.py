import logging
from typing import Optional, Sequence, Tuple

from sentry import features, quotas
from sentry.dynamic_sampling.models.adjustment_models import AdjustedModel
from sentry.dynamic_sampling.models.transaction_adjustment_model import adjust_sample_rate_full
from sentry.dynamic_sampling.models.utils import DSElement
from sentry.dynamic_sampling.prioritise_projects import fetch_projects_with_total_volumes
from sentry.dynamic_sampling.prioritise_transactions import (
    ProjectTransactions,
    fetch_transactions_with_total_volumes,
    get_orgs_with_project_counts,
    transactions_zip,
)
from sentry.dynamic_sampling.rules.helpers.prioritise_project import _generate_cache_key
from sentry.dynamic_sampling.rules.helpers.prioritize_transactions import (
    set_transactions_resampling_rates,
)
from sentry.dynamic_sampling.rules.utils import OrganizationId, ProjectId, get_redis_client_for_ds
from sentry.models import Organization, Project
from sentry.tasks.base import instrumented_task
from sentry.tasks.relay import schedule_invalidate_project_config
from sentry.utils import metrics

CACHE_KEY_TTL = 24 * 60 * 60 * 1000  # in milliseconds

# TODO RaduW validate assumptions
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
        for org_id, projects_with_tx_count in fetch_projects_with_total_volumes().items():
            process_projects_sample_rates.delay(org_id, projects_with_tx_count)


@instrumented_task(
    name="sentry.dynamic_sampling.process_projects_sample_rates",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=25 * 60,  # 25 mins
    time_limit=2 * 60 + 5,
)  # type: ignore
def process_projects_sample_rates(
    org_id: OrganizationId, projects_with_tx_count: Sequence[Tuple[ProjectId, int]]
) -> None:
    """
    Takes a single org id and a list of project ids
    """
    with metrics.timer("sentry.tasks.dynamic_sampling.process_projects_sample_rates.core"):
        adjust_sample_rates(org_id, projects_with_tx_count)


def adjust_sample_rates(
    org_id: int, projects_with_tx_count: Sequence[Tuple[ProjectId, int]]
) -> None:
    """
    This function apply model and adjust sample rate per project in org
    and store it in DS redis cluster, then we invalidate project config
    so relay can reread it, and we'll inject it from redis cache.
    """
    projects = []
    project_ids_with_counts = {}
    for project_id, count_per_root in projects_with_tx_count:
        project_ids_with_counts[project_id] = count_per_root

    sample_rate = None
    for project in Project.objects.get_many_from_cache(project_ids_with_counts.keys()):
        sample_rate = quotas.get_blended_sample_rate(project)
        if sample_rate is None:
            continue
        projects.append(
            DSElement(
                id=project.id,
                count=project_ids_with_counts[project.id],
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
    current_org: Optional[Organization] = None
    current_org_enabled = False
    with metrics.timer("sentry.tasks.dynamic_sampling.prioritise_transactions", sample_rate=1.0):
        for orgs in get_orgs_with_project_counts(MAX_ORGS_PER_QUERY, MAX_PROJECTS_PER_QUERY):
            # get the low and high transactions
            # TODO can we do this in one query rather than two
            for project_transactions in transactions_zip(
                fetch_transactions_with_total_volumes(
                    orgs,
                    large_transactions=True,
                    max_transactions=MAX_TRANSACTIONS_PER_PROJECT // 2,
                ),
                fetch_transactions_with_total_volumes(
                    orgs,
                    large_transactions=False,
                    max_transactions=MAX_TRANSACTIONS_PER_PROJECT // 2,
                ),
            ):

                if not current_org or current_org.id != project_transactions["org_id"]:
                    current_org = Organization.objects.get_from_cache(
                        id=project_transactions["org_id"]
                    )
                    current_org_enabled = features.has(
                        "organizations:ds-prioritise-by-transaction-bias", current_org
                    )
                if current_org_enabled:
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
    project = Project.objects.get_from_cache(id=project_id)
    sample_rate = quotas.get_blended_sample_rate(project)

    if sample_rate is None or sample_rate == 1.0:
        # no sampling => no rebalancing
        return

    named_rates = adjust_sample_rate_full(transactions=transactions, rate=sample_rate)

    set_transactions_resampling_rates(
        org_id=org_id,
        proj_id=project_id,
        named_rates=named_rates,
        default_rate=sample_rate,
        ttl_ms=CACHE_KEY_TTL,
    )

    schedule_invalidate_project_config(
        project_id=project_id, trigger="dynamic_sampling_prioritise_transaction_bias"
    )
