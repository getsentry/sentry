import logging
from datetime import timedelta
from typing import Dict, Mapping, Optional, Sequence, Tuple

import sentry_sdk

from sentry import features, options, quotas
from sentry.dynamic_sampling.models import utils
from sentry.dynamic_sampling.models.adjustment_models import AdjustedModel
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
from sentry.dynamic_sampling.rules.base import is_sliding_window_enabled
from sentry.dynamic_sampling.rules.helpers.prioritise_project import _generate_cache_key
from sentry.dynamic_sampling.rules.helpers.prioritize_transactions import (
    set_transactions_resampling_rates,
)
from sentry.dynamic_sampling.rules.helpers.sliding_window import (
    SLIDING_WINDOW_CALCULATION_ERROR,
    extrapolate_monthly_volume,
    generate_sliding_window_cache_key,
    generate_sliding_window_org_cache_key,
    get_sliding_window_org_sample_rate,
    get_sliding_window_sample_rate,
    get_sliding_window_size,
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
from sentry.dynamic_sampling.sliding_window import (
    fetch_orgs_with_total_root_transactions_count,
    fetch_projects_with_total_root_transactions_count,
)
from sentry.dynamic_sampling.snuba_utils import (
    get_active_orgs,
    get_orgs_with_project_counts_without_modulo,
)
from sentry.models import Organization, Project
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

    desired_sample_rate = quotas.get_blended_sample_rate(organization_id=org_volume.org_id)
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
    total_num_transactions = project_transactions.get("total_num_transactions")
    total_num_classes = project_transactions.get("total_num_classes")
    transactions = [
        DSElement(id=id, count=count) for id, count in project_transactions["transaction_counts"]
    ]

    try:
        organization = Organization.objects.get_from_cache(id=org_id)
    except Organization.DoesNotExist:
        organization = None

    if organization is not None and is_sliding_window_enabled(organization):
        sample_rate = get_sliding_window_sample_rate(
            org_id=org_id,
            project_id=project_id,
            error_sample_rate_fallback=quotas.get_blended_sample_rate(organization_id=org_id),
        )
    else:
        sample_rate = quotas.get_blended_sample_rate(organization_id=org_id)

    if sample_rate is None or sample_rate == 1.0:
        # no sampling => no rebalancing
        return

    intensity = options.get("dynamic-sampling.prioritise_transactions.rebalance_intensity", 1.0)
    named_rates, implicit_rate = utils.adjust_sample_rates(
        classes=transactions,
        rate=sample_rate,
        total_num_classes=total_num_classes,
        total=total_num_transactions,
        intensity=intensity,
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
    try:
        # We need the organization object for the feature flag.
        organization = Organization.objects.get_from_cache(id=org_id)
    except Organization.DoesNotExist:
        # In case an org is not found, it might be that it has been deleted in the time between
        # the query triggering this job and the actual execution of the job.
        organization = None

    # We get the sample rate either directly from quotas or from the new sliding window org mechanism.
    if organization is not None and features.has(
        "organizations:ds-sliding-window-org", organization, actor=None
    ):
        sample_rate = get_adjusted_base_rate_from_cache_or_compute(org_id)
    else:
        sample_rate = quotas.get_blended_sample_rate(organization_id=org_id)

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
            DSElement(
                id=project_id,
                count=count_per_root,
            )
        )

    model = AdjustedModel(projects=projects)
    ds_projects = model.adjust_sample_rates(sample_rate=sample_rate)

    redis_client = get_redis_client_for_ds()
    with redis_client.pipeline(transaction=False) as pipeline:
        for ds_project in ds_projects:
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
            return compute_sliding_window_sample_rate(
                org_id, None, org_total_root_count, window_size
            )

    return None


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.sliding_window",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=2 * 60 * 60,  # 2 hours
    time_limit=2 * 60 * 60 + 5,
)  # type: ignore
def sliding_window() -> None:
    window_size = get_sliding_window_size()
    # In case the size is None it means that we disabled the sliding window entirely.
    if window_size is not None:
        metrics.incr("sentry.dynamic_sampling.tasks.sliding_window.start", sample_rate=1.0)
        with metrics.timer("sentry.dynamic_sampling.tasks.sliding_window", sample_rate=1.0):
            for orgs in get_orgs_with_project_counts_without_modulo(
                MAX_ORGS_PER_QUERY, MAX_PROJECTS_PER_QUERY
            ):
                for (
                    org_id,
                    projects_with_total_root_count,
                ) in fetch_projects_with_total_root_transactions_count(
                    org_ids=orgs, window_size=window_size
                ).items():
                    adjust_base_sample_rate_per_project(
                        org_id, projects_with_total_root_count, window_size
                    )


@instrumented_task(
    name="sentry.dynamic_sampling.process_sliding_window",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=25 * 60,  # 25 mins
    time_limit=2 * 60 + 5,
)  # type: ignore
def process_sliding_window(
    org_id: OrganizationId,
    projects_with_total_root_count: Sequence[Tuple[ProjectId, int]],
    window_size: int,
) -> None:
    with metrics.timer(
        "sentry.tasks.dynamic_sampling.process_sliding_window.adjust_base_sample_rate_per_project"
    ):
        adjust_base_sample_rate_per_project(org_id, projects_with_total_root_count, window_size)


def adjust_base_sample_rate_per_project(
    org_id: int, projects_with_total_root_count: Sequence[Tuple[ProjectId, int]], window_size: int
) -> None:
    """
    Adjusts the base sample rate per project by computing the sliding window sample rate, considering the total
    volume of root transactions started from each project in the org.
    """
    projects_with_rebalanced_sample_rate = []

    for project_id, total_root_count in augment_with_empty_projects(
        org_id, projects_with_total_root_count
    ).items():
        try:
            # We want to compute the sliding window sample rate by considering a window of time.
            # This piece of code is very delicate, thus we want to guard it properly and capture any errors.
            sample_rate = compute_sliding_window_sample_rate(
                org_id, project_id, total_root_count, window_size
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)
            sample_rate = None

        # If the sample rate is None, we want to add a sentinel value into Redis, the goal being that when generating
        # rules we can distinguish between:
        # 1. Value in the cache
        # 2. No value in the cache
        # 3. Error happened
        projects_with_rebalanced_sample_rate.append(
            (
                project_id,
                str(sample_rate) if sample_rate is not None else SLIDING_WINDOW_CALCULATION_ERROR,
            )
        )

    redis_client = get_redis_client_for_ds()
    with redis_client.pipeline(transaction=False) as pipeline:
        for project_id, sample_rate in projects_with_rebalanced_sample_rate:  # type:ignore
            cache_key = generate_sliding_window_cache_key(org_id=org_id)
            pipeline.hset(cache_key, project_id, sample_rate)
            pipeline.pexpire(cache_key, CACHE_KEY_TTL)

            schedule_invalidate_project_config(
                project_id=project_id, trigger="dynamic_sampling_prioritise_project_bias"
            )

        pipeline.execute()


def augment_with_empty_projects(
    org_id: int, projects_with_total_root_count: Sequence[Tuple[ProjectId, int]]
) -> Mapping[ProjectId, int]:
    """
    Augments the incoming sequence of projects and counts with all the projects that are not in the list. This projects
    will be added with count 0, to mark that they didn't have any metrics.
    """
    projects_with_counts = {
        project_id: count_per_root for project_id, count_per_root in projects_with_total_root_count
    }

    # Since we don't mind about strong consistency, we query a replica of the main database with the possibility of
    # having out of date information. This is a trade-off we accept, since we work under the assumption that eventually
    # the projects of an org will be replicated consistently across replicas, because no org should continue to create
    # new projects.
    all_projects_ids = (
        Project.objects.using_replica().filter(organization_id=org_id).values_list("id", flat=True)
    )
    for project_id in all_projects_ids:
        # In case a specific project has not been considered in the count query, it means that no metrics were extracted
        # for it, thus we consider it as having 0 transactions for the query's time window.
        if project_id not in projects_with_counts:
            projects_with_counts[project_id] = 0

    return projects_with_counts


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.sliding_window_org",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=2 * 60 * 60,  # 2 hours
    time_limit=2 * 60 * 60 + 5,
)  # type: ignore
def sliding_window_org() -> None:
    window_size = get_sliding_window_size()
    # In case the size is None it means that we disabled the sliding window entirely.
    if window_size is not None:
        metrics.incr("sentry.dynamic_sampling.tasks.sliding_window_org.start", sample_rate=1.0)
        with metrics.timer("sentry.dynamic_sampling.tasks.sliding_window_org", sample_rate=1.0):
            for orgs in get_orgs_with_project_counts_without_modulo(
                MAX_ORGS_PER_QUERY, MAX_PROJECTS_PER_QUERY
            ):
                for (org_id, total_root_count,) in fetch_orgs_with_total_root_transactions_count(
                    org_ids=orgs, window_size=window_size
                ).items():
                    adjust_base_sample_rate_per_org(org_id, total_root_count, window_size)


def adjust_base_sample_rate_per_org(org_id: int, total_root_count: int, window_size: int) -> None:
    """
    Adjusts the base sample rate per org by considering its volume and how it fits w.r.t. to the sampling tiers.
    """
    sample_rate = compute_sliding_window_sample_rate(org_id, None, total_root_count, window_size)
    # If the sample rate is None, we don't want to store a value into Redis.
    if sample_rate is None:
        return

    redis_client = get_redis_client_for_ds()
    with redis_client.pipeline(transaction=False) as pipeline:
        cache_key = generate_sliding_window_org_cache_key(org_id=org_id)
        pipeline.set(cache_key, sample_rate)
        pipeline.pexpire(cache_key, CACHE_KEY_TTL)
        pipeline.execute()


def compute_sliding_window_sample_rate(
    org_id: int, project_id: Optional[int], total_root_count: int, window_size: int
) -> Optional[float]:
    """
    Computes the actual sample rate for the sliding window given the total root count and the size of the
    window that was used for computing the root count.

    The org_id is used only because it is required on the quotas side to determine whether dynamic sampling is
    enabled in the first place for that project.
    """
    extrapolated_volume = extrapolate_monthly_volume(volume=total_root_count, hours=window_size)
    if extrapolated_volume is None:
        with sentry_sdk.push_scope() as scope:
            scope.set_extra("org_id", org_id)
            scope.set_extra("window_size", window_size)
            sentry_sdk.capture_message("The volume of the current month can't be extrapolated.")

        return None

    # We want to log the monthly volume for observability purposes.
    log_extrapolated_monthly_volume(
        org_id, project_id, total_root_count, extrapolated_volume, window_size
    )

    sampling_tier = quotas.get_transaction_sampling_tier_for_volume(org_id, extrapolated_volume)
    if sampling_tier is None:
        return None

    # We unpack the tuple containing the sampling tier information in the form (volume, sample_rate). This is done
    # under the assumption that the sampling_tier tuple contains both non-null values.
    _, sample_rate = sampling_tier

    # We assume that the sample_rate is a float.
    return float(sample_rate)


def log_extrapolated_monthly_volume(
    org_id: int, project_id: Optional[int], volume: int, extrapolated_volume: int, window_size: int
) -> None:
    extra = {
        "org_id": org_id,
        "volume": volume,
        "extrapolated_monthly_volume": extrapolated_volume,
        "window_size_in_hours": window_size,
    }

    if project_id is not None:
        extra["project_id"] = project_id

    logger.info(
        "compute_sliding_window_sample_rate.extrapolate_monthly_volume",
        extra=extra,
    )
