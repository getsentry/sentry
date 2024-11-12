from collections.abc import Sequence

import sentry_sdk

from sentry import quotas
from sentry.constants import SAMPLING_MODE_DEFAULT, TARGET_SAMPLE_RATE_DEFAULT
from sentry.dynamic_sampling.rules.utils import DecisionKeepCount, OrganizationId, ProjectId
from sentry.dynamic_sampling.tasks.boost_low_volume_projects import (
    fetch_projects_with_total_root_transaction_count_and_rates,
)
from sentry.dynamic_sampling.tasks.common import GetActiveOrgsVolumes, TimedIterator
from sentry.dynamic_sampling.tasks.constants import (
    MAX_REBALANCE_FACTOR,
    MAX_TASK_SECONDS,
    MIN_REBALANCE_FACTOR,
)
from sentry.dynamic_sampling.tasks.helpers.recalibrate_orgs import (
    compute_adjusted_factor,
    delete_adjusted_factor,
    delete_adjusted_project_factor,
    get_adjusted_factor,
    get_adjusted_project_factor,
    set_guarded_adjusted_factor,
    set_guarded_adjusted_project_factor,
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
from sentry.dynamic_sampling.utils import has_dynamic_sampling
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.recalibrate_orgs",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=1 * 60,  # 1 minute
    time_limit=1 * 60 + 5,
    silo_mode=SiloMode.REGION,
)
@dynamic_sampling_task_with_context(max_task_execution=MAX_TASK_SECONDS)
def recalibrate_orgs(context: TaskContext) -> None:
    for org_volumes in TimedIterator(
        context,
        GetActiveOrgsVolumes(),
    ):
        modes = OrganizationOption.objects.get_value_bulk_id(
            [v.org_id for v in org_volumes], "sentry:sampling_mode", SAMPLING_MODE_DEFAULT
        )

        orgs_batch = []
        projects_batch = []

        for org_volume in org_volumes:
            if not org_volume.is_valid_for_recalibration():
                continue

            if modes[org_volume.org_id] == DynamicSamplingMode.PROJECT:
                projects_batch.append(org_volume.org_id)
            else:
                orgs_batch.append((org_volume.org_id, org_volume.total, org_volume.indexed))

        # We run an asynchronous job for recalibrating a batch of orgs whose
        # size is specified in `GetActiveOrgsVolumes`.
        if orgs_batch:
            recalibrate_orgs_batch.delay(orgs_batch)

        if projects_batch:
            recalibrate_projects_batch.delay(projects_batch)


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.recalibrate_orgs_batch",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=6 * 60,  # 6 minutes
    time_limit=6 * 60 + 5,
    silo_mode=SiloMode.REGION,
)
@dynamic_sampling_task
def recalibrate_orgs_batch(orgs: Sequence[tuple[OrganizationId, int, int]]) -> None:
    for org_id, total, indexed in orgs:
        try:
            recalibrate_org(org_id, total, indexed)
        except Exception as e:
            sentry_sdk.capture_exception(e)
            continue


def recalibrate_org(org_id: OrganizationId, total: int, indexed: int) -> None:
    try:
        # We need the organization object for the feature flag.
        organization = Organization.objects.get_from_cache(id=org_id)
    except Organization.DoesNotExist:
        # In case an org is not found, it might be that it has been deleted in the time between
        # the query triggering this job and the actual execution of the job.
        organization = None

    # If the org doesn't have dynamic sampling, we want to early return to avoid unnecessary work.
    if not has_dynamic_sampling(organization):
        return

    # If we have the sliding window org sample rate, we use that or fall back to the blended sample rate in case of
    # issues.
    target_sample_rate, success = get_org_sample_rate(
        org_id=org_id,
        default_sample_rate=quotas.backend.get_blended_sample_rate(organization_id=org_id),
    )

    sample_function(
        function=log_sample_rate_source,
        _sample_rate=0.1,
        org_id=org_id,
        project_id=None,
        used_for="recalibrate_orgs",
        source="sliding_window_org" if success else "blended_sample_rate",
        sample_rate=target_sample_rate,
    )

    # If we didn't find any sample rate, we can't recalibrate the organization.
    if target_sample_rate is None:
        sentry_sdk.capture_message("Sample rate of org not found when trying to recalibrate it")
        return

    # We compute the effective sample rate that we had in the last considered time window.
    effective_sample_rate = indexed / total
    # We get the previous factor that was used for the recalibration.
    previous_factor = get_adjusted_factor(org_id)

    # We want to compute the new adjusted factor.
    adjusted_factor = compute_adjusted_factor(
        previous_factor, effective_sample_rate, target_sample_rate
    )
    if adjusted_factor is None:
        sentry_sdk.capture_message(
            "The adjusted factor for org recalibration could not be computed"
        )
        return

    if adjusted_factor < MIN_REBALANCE_FACTOR or adjusted_factor > MAX_REBALANCE_FACTOR:
        # In case the new factor would result into too much recalibration, we want to remove it from cache,
        # effectively removing the generated rule.
        delete_adjusted_factor(org_id)
        return

    # At the end we set the adjusted factor.
    set_guarded_adjusted_factor(org_id, adjusted_factor)


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.recalibrate_projects_batch",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=2 * 60,
    time_limit=2 * 60 + 5,
    silo_mode=SiloMode.REGION,
)
@dynamic_sampling_task_with_context(max_task_execution=MAX_TASK_SECONDS)
def recalibrate_projects_batch(context: TaskContext, orgs: list[OrganizationId]) -> None:
    for org_id, projects in fetch_projects_with_total_root_transaction_count_and_rates(
        context, org_ids=orgs, measure=SamplingMeasure.SPANS
    ).items():
        sample_rates = ProjectOption.objects.get_value_bulk_id(
            [t[0] for t in projects], "sentry:target_sample_rate"
        )

        for project_id, total, keep, _ in projects:
            try:
                recalibrate_project(org_id, project_id, total, keep, sample_rates[project_id])
            except Exception as e:
                sentry_sdk.capture_exception(e)
                continue


def recalibrate_project(
    org_id: OrganizationId,
    project_id: ProjectId,
    total: int,
    indexed: DecisionKeepCount,
    target_sample_rate: float | None,
) -> None:
    if target_sample_rate is None:
        target_sample_rate = TARGET_SAMPLE_RATE_DEFAULT

    sample_function(
        function=log_sample_rate_source,
        _sample_rate=0.1,
        org_id=org_id,
        project_id=project_id,
        used_for="recalibrate_orgs",
        source="project_setting",
        sample_rate=target_sample_rate,
    )

    # We compute the effective sample rate that we had in the last considered time window.
    effective_sample_rate = indexed / total
    # We get the previous factor that was used for the recalibration.
    previous_factor = get_adjusted_project_factor(project_id)

    # We want to compute the new adjusted factor.
    adjusted_factor = compute_adjusted_factor(
        previous_factor, effective_sample_rate, target_sample_rate
    )
    if adjusted_factor is None:
        sentry_sdk.capture_message(
            "The adjusted factor for org recalibration could not be computed"
        )
        return

    if adjusted_factor < MIN_REBALANCE_FACTOR or adjusted_factor > MAX_REBALANCE_FACTOR:
        # In case the new factor would result into too much recalibration, we want to remove it from cache,
        # effectively removing the generated rule.
        delete_adjusted_project_factor(project_id)
        return

    # At the end we set the adjusted factor.
    set_guarded_adjusted_project_factor(project_id, adjusted_factor)
