import logging
from collections import namedtuple
from datetime import timedelta
from typing import Dict, Optional, Sequence, Tuple

from django.core.exceptions import ObjectDoesNotExist

from sentry import options, quotas
from sentry.dynamic_sampling.models.adjustment_models import AdjustedModel
from sentry.dynamic_sampling.models.transaction_adjustment_model import adjust_sample_rate
from sentry.dynamic_sampling.models.utils import DSElement
from sentry.dynamic_sampling.prioritise_projects import fetch_projects_with_total_volumes
from sentry.dynamic_sampling.prioritise_transactions import (
    ProjectTransactions,
    fetch_project_transaction_totals,
    fetch_transactions_with_total_volumes,
    get_orgs_with_project_counts,
    transactions_zip,
)
from sentry.dynamic_sampling.recalibrate_transactions import (
    OrganizationDataVolume,
    fetch_org_volumes,
)
from sentry.dynamic_sampling.rules.helpers.prioritise_project import _generate_cache_key
from sentry.dynamic_sampling.rules.helpers.prioritize_transactions import (
    set_transactions_resampling_rates,
)
from sentry.dynamic_sampling.rules.helpers.sliding_window import (
    extrapolate_monthly_volume,
    generate_sliding_window_cache_key,
)
from sentry.dynamic_sampling.rules.utils import (
    DecisionDropCount,
    DecisionKeepCount,
    OrganizationId,
    ProjectId,
    adjusted_factor,
    generate_cache_key_rebalance_factor,
    get_redis_client_for_ds,
)
from sentry.dynamic_sampling.sliding_window import fetch_projects_with_total_root_transactions_count
from sentry.dynamic_sampling.snuba_utils import (
    get_active_orgs,
    get_orgs_with_project_counts_without_modulo,
)
from sentry.models import Project
from sentry.tasks.base import instrumented_task
from sentry.tasks.relay import schedule_invalidate_project_config
from sentry.utils import metrics

CACHE_KEY_TTL = 24 * 60 * 60 * 1000  # in milliseconds

MAX_ORGS_PER_QUERY = 100
MAX_PROJECTS_PER_QUERY = 5000
MAX_TRANSACTIONS_PER_PROJECT = 20

# MIN and MAX rebalance factor ( make sure we don't go crazy when rebalancing)
MIN_REBALANCE_FACTOR = 0.1
MAX_REBALANCE_FACTOR = 10

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


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.recalibrate_orgs",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=2 * 60 * 60,  # 2hours
    time_limit=2 * 60 * 60 + 5,
)  # type: ignore
def recalibrate_orgs() -> None:
    query_interval = timedelta(minutes=5)
    metrics.incr("sentry.tasks.dynamic_sampling.recalibrate_orgs.start", sample_rate=1.0)

    # use a dict instead of a list to easily pass it to the logger in the extra field
    errors: Dict[str, str] = {}

    with metrics.timer("sentry.tasks.dynamic_sampling.recalibrate_orgs", sample_rate=1.0):
        for orgs in get_active_orgs(1000, query_interval):
            for org_volume in fetch_org_volumes(orgs, query_interval):
                error = rebalance_org(org_volume)
                if error and len(errors) < 100:
                    error_message = f"organisation:{org_volume.org_id} with {org_volume.total} transactions from which {org_volume.indexed} indexed, generated error:{error}"
                    errors[str(org_volume.org_id)] = error_message

        if errors:
            logger.info("Dynamic sampling organization recalibration failed", extra=errors)


def rebalance_org(org_volume: OrganizationDataVolume) -> Optional[str]:
    """
    Calculates the rebalancing factor for an org

    It takes the last interval total number of transactions and kept transactions, and
    it figures out how far it is from the desired rate ( i.e. the blended rate)
    """

    redis_client = get_redis_client_for_ds()
    factor_key = generate_cache_key_rebalance_factor(org_volume.org_id)
    # we need a project from the current org... unfortunately get_blended_sample_rate
    # takes a project (not an org)
    # TODO RaduW is there a better way to get an org Project than filtering ?
    org_projects = Project.objects.filter(organization__id=org_volume.org_id)

    desired_sample_rate = None
    for project in org_projects:
        desired_sample_rate = quotas.get_blended_sample_rate(project)
        break
    else:
        redis_client.delete(factor_key)  # cleanup just to be sure
        # org with no project this shouldn't happen
        return "no project found"

    if desired_sample_rate is None:
        return f"project with desired_sample_rate==None for {org_volume.org_id}"

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
        return f"factor:{new_factor} outside of the acceptable range [0.1..10.0]"

    if new_factor != 1.0:
        # Finally got a good key, save it to be used in rule generation
        redis_client.set(factor_key, new_factor)
    else:
        # we are either at 1.0 no point creating an adjustment rule
        redis_client.delete(factor_key)
    return None


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
    try:
        project = Project.objects.get_from_cache(id=project_id)
    except ObjectDoesNotExist:
        return  # project has probably been deleted no need to continue

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


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.sliding_window",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=2 * 60 * 60,  # 2 hours
    time_limit=2 * 60 * 60 + 5,
)  # type: ignore
def sliding_window_rebalancing() -> None:
    metrics.incr("sentry.dynamic_sampling.tasks.sliding_window.start", sample_rate=1.0)
    with metrics.timer("sentry.dynamic_sampling.tasks.sliding_window", sample_rate=1.0):
        for orgs in get_orgs_with_project_counts_without_modulo(
            MAX_ORGS_PER_QUERY, MAX_PROJECTS_PER_QUERY
        ):
            for (
                org_id,
                projects_with_total_root_count,
            ) in fetch_projects_with_total_root_transactions_count(org_ids=orgs).items():
                adjust_base_sample_rate_per_project(org_id, projects_with_total_root_count)


def adjust_base_sample_rate_per_project(
    org_id: int,
    projects_with_total_root_count: Sequence[Tuple[ProjectId, int]],
) -> None:
    """
    Adjusts the base sample rate per project by considering its volume and how it fits w.r.t. to the sampling tiers
    defined on the billing side.
    """
    projects_with_rebalanced_sample_rate = []
    for project_id, total_root_count in projects_with_total_root_count:
        forecasted_volume = extrapolate_monthly_volume(daily_volume=total_root_count)
        if forecasted_volume is None:
            logger.info(
                f"The volume of the current month can't be forecasted for org {org_id} and project {project_id}."
            )
            continue

        sampling_tier = quotas.get_transaction_sampling_tier_for_volume(org_id, forecasted_volume)
        # In case the sampling tier cannot be determined, we want to log it and try to get it for the next project.
        #
        # There might be a situation in which the old key is set into Redis still and in that case, we prefer to keep it
        # instead of deleting it. This behavior can be changed anytime, by just doing an "HDEL" on the failing key.
        if sampling_tier is None:
            logger.error(
                f"The sampling tier for org {org_id} and project {project_id} can't be determined, either an error "
                f"occurred or the org doesn't have dynamic sampling."
            )
            continue

        # We unpack the tuple containing the sampling tier information in the form (volume, sample_rate). This is done
        # under the assumption that the sampling_tier tuple contains both non-null values.
        _, sample_rate = sampling_tier
        projects_with_rebalanced_sample_rate.append((project_id, sample_rate))

    # In case we failed to get the sampling tier of all the projects, we don't even want to start a Redis pipeline.
    if len(projects_with_rebalanced_sample_rate) == 0:
        return

    redis_client = get_redis_client_for_ds()
    with redis_client.pipeline(transaction=False) as pipeline:
        for project_id, sample_rate in projects_with_rebalanced_sample_rate:
            cache_key = generate_sliding_window_cache_key(org_id=org_id)
            pipeline.hset(cache_key, project_id, sample_rate)
            pipeline.pexpire(cache_key, CACHE_KEY_TTL)

            schedule_invalidate_project_config(
                project_id=project_id, trigger="dynamic_sampling_prioritise_project_bias"
            )

        pipeline.execute()
