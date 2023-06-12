import logging
import math
from datetime import timedelta
from typing import Dict, Optional, Sequence, Tuple

import sentry_sdk

from sentry import options, quotas
from sentry.dynamic_sampling.models.base import ModelType
from sentry.dynamic_sampling.models.common import RebalancedItem, guarded_run
from sentry.dynamic_sampling.models.factory import model_factory
from sentry.dynamic_sampling.models.projects_rebalancing import ProjectsRebalancingInput
from sentry.dynamic_sampling.models.transactions_rebalancing import TransactionsRebalancingInput
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
from sentry.dynamic_sampling.rules.base import (
    is_sliding_window_enabled,
    is_sliding_window_org_enabled,
)
from sentry.dynamic_sampling.rules.helpers.prioritise_project import (
    generate_prioritise_by_project_cache_key,
    get_prioritise_by_project_sample_rate,
)
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
    mark_sliding_window_executed,
    mark_sliding_window_org_executed,
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


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.prioritise_projects",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=2 * 60 * 60,  # 2hours
    time_limit=2 * 60 * 60 + 5,
)
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
)
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


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.sliding_window",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=2 * 60 * 60,  # 2 hours
    time_limit=2 * 60 * 60 + 5,
)
def sliding_window() -> None:
    window_size = get_sliding_window_size()
    # In case the size is None it means that we disabled the sliding window entirely.
    if window_size is not None:
        metrics.incr("sentry.dynamic_sampling.tasks.sliding_window.start", sample_rate=1.0)
        with metrics.timer("sentry.dynamic_sampling.tasks.sliding_window", sample_rate=1.0):
            # It is important to note that this query will return orgs that in the last hour have had at least 1
            # transaction.
            for orgs in get_orgs_with_project_counts_without_modulo(
                MAX_ORGS_PER_QUERY, MAX_PROJECTS_PER_QUERY
            ):
                # This query on the other hand, fetches with a dynamic window size because we care about being able
                # to extrapolate monthly volume with a bigger window than the hour used in the orgs query. Thus, it can
                # be that an org is not detected because it didn't have traffic for this hour but its projects have
                # traffic in the last window_size, however this isn't a big deal since we cache the sample rate and if
                # not found we fall back to 100% (only if the sliding window has run).
                for (
                    org_id,
                    projects_with_total_root_count,
                ) in fetch_projects_with_total_root_transactions_count(
                    org_ids=orgs, window_size=window_size
                ).items():
                    with metrics.timer(
                        "sentry.dynamic_sampling.tasks.sliding_window.adjust_base_sample_rate_per_project"
                    ):
                        adjust_base_sample_rate_per_project(
                            org_id, projects_with_total_root_count, window_size
                        )

            # Due to the synchronous nature of the sliding window, when we arrived here, we can confidently say that the
            # execution of the sliding window was successful. We will keep this state for 1 hour.
            mark_sliding_window_executed()


def adjust_base_sample_rate_per_project(
    org_id: int, projects_with_total_root_count: Sequence[Tuple[ProjectId, int]], window_size: int
) -> None:
    """
    Adjusts the base sample rate per project by computing the sliding window sample rate, considering the total
    volume of root transactions started from each project in the org.
    """
    projects_with_rebalanced_sample_rate = []

    for project_id, total_root_count in projects_with_total_root_count:
        sample_rate = compute_guarded_sliding_window_sample_rate(
            org_id, project_id, total_root_count, window_size
        )

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
    cache_key = generate_sliding_window_cache_key(org_id=org_id)

    # We want to get all the old sample rates in memory because we will remove the entire hash in the next step.
    old_sample_rates = redis_client.hgetall(cache_key)

    # For efficiency reasons, we start a pipeline that will apply a set of operations without multiple round trips.
    with redis_client.pipeline(transaction=False) as pipeline:
        # We want to delete the Redis hash before adding new sample rate since we don't back-fill projects that have no
        # root count metrics in the considered window.
        pipeline.delete(cache_key)

        # For each project we want to now save the new sample rate.
        for project_id, sample_rate in projects_with_rebalanced_sample_rate:  # type:ignore
            # We store the new updated sample rate.
            pipeline.hset(cache_key, project_id, sample_rate)
            pipeline.pexpire(cache_key, CACHE_KEY_TTL)

            # We want to get the old sample rate, which will be None in case it was not set.
            old_sample_rate = sample_rate_to_float(old_sample_rates.get(str(project_id), ""))
            # We also get the new sample rate, which will be None in case we stored a SLIDING_WINDOW_CALCULATION_ERROR.
            sample_rate = sample_rate_to_float(sample_rate)  # type:ignore
            # We invalidate the caches only if there was a change in the sample rate. This is to avoid flooding the
            # system with project config invalidations.
            if not are_equal_with_epsilon(old_sample_rate, sample_rate):
                schedule_invalidate_project_config(
                    project_id=project_id, trigger="dynamic_sampling_sliding_window"
                )

        pipeline.execute()


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.sliding_window_org",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=2 * 60 * 60,  # 2 hours
    time_limit=2 * 60 * 60 + 5,
)
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

            # Due to the synchronous nature of the sliding window org, when we arrived here, we can confidently say
            # that the execution of the sliding window org was successful. We will keep this state for 1 hour.
            mark_sliding_window_org_executed()


def adjust_base_sample_rate_per_org(org_id: int, total_root_count: int, window_size: int) -> None:
    """
    Adjusts the base sample rate per org by considering its volume and how it fits w.r.t. to the sampling tiers.
    """
    sample_rate = compute_guarded_sliding_window_sample_rate(
        org_id, None, total_root_count, window_size
    )
    # If the sample rate is None, we don't want to store a value into Redis, but we prefer to keep the system
    # with the old value.
    if sample_rate is None:
        return

    redis_client = get_redis_client_for_ds()
    with redis_client.pipeline(transaction=False) as pipeline:
        cache_key = generate_sliding_window_org_cache_key(org_id=org_id)
        pipeline.set(cache_key, sample_rate)
        pipeline.pexpire(cache_key, CACHE_KEY_TTL)
        pipeline.execute()


def compute_guarded_sliding_window_sample_rate(
    org_id: int, project_id: Optional[int], total_root_count: int, window_size: int
) -> Optional[float]:
    try:
        # We want to compute the sliding window sample rate by considering a window of time.
        # This piece of code is very delicate, thus we want to guard it properly and capture any errors.
        return compute_sliding_window_sample_rate(org_id, project_id, total_root_count, window_size)
    except Exception as e:
        sentry_sdk.capture_exception(e)
        return None


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
