from __future__ import annotations

from datetime import timedelta

import sentry_sdk
from django.db.models import Exists, F, OuterRef
from django.db.models.functions import Mod
from taskbroker_client.retry import Retry

from sentry.constants import ObjectStatus
from sentry.dynamic_sampling.per_org.calculations import (
    PerOrgCalculations,
    apply_project_sample_rate_overrides,
    collect_transaction_volume_debug,
    compare_organization_sliding_window_sample_rates,
    get_cached_organization_sample_rate,
    get_cached_rebalanced_project_sample_rates,
    get_cached_rebalanced_transaction_sample_rates,
    get_cached_recalibration_factor,
    run_project_balancing,
    run_transaction_balancing,
)
from sentry.dynamic_sampling.per_org.configuration import (
    AutomaticDynamicSamplingConfiguration,
    get_configuration,
)
from sentry.dynamic_sampling.per_org.gate import (
    is_org_in_recalibration_rollout,
    is_org_in_rollout,
    is_org_in_sample_rates_summary_log_rollout,
    sliding_window_comparison_org_ids,
    transaction_volume_debug_project_ids,
)
from sentry.dynamic_sampling.per_org.legacy_comparison import log_comparison_with_legacy_pipeline
from sentry.dynamic_sampling.per_org.queries import (
    get_eap_organization_volume,
    get_eap_project_volumes,
    get_eap_transaction_volumes,
)
from sentry.dynamic_sampling.per_org.telemetry import (
    PROJECTS_BELOW_FULL_SAMPLE_RATE_METRIC,
    SCHEDULER_BUCKET_ORG_STATUS_METRIC,
    DynamicSamplingStatus,
    emit_count,
    emit_status,
    track_dynamic_sampling,
)
from sentry.dynamic_sampling.rules.utils import OrganizationId
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import telemetry_experience_tasks
from sentry.utils.cursored_scheduler import CursoredScheduler

# How long a full pass through all organizations should take.
CYCLE_DURATION = timedelta(minutes=10)


@instrumented_task(
    name="sentry.dynamic_sampling.per_org.run_calculations_per_org",
    namespace=telemetry_experience_tasks,
    processing_deadline_duration=2 * 60,  # 2 minute timeout per org
    # A task still queued a cycle after dispatch would compute sample rates from a stale
    # window, and the next cycle's task for the same org supersedes it. Drop it instead.
    expires=CYCLE_DURATION,
    silo_mode=SiloMode.CELL,
)
def run_calculations_per_org_task_entry(org_id: OrganizationId) -> None:
    run_calculations_per_org_task(org_id)


@track_dynamic_sampling
def run_calculations_per_org_task(org_id: OrganizationId) -> DynamicSamplingStatus | None:
    calculations = run_per_org_calculations(org_id)
    log_comparison_with_legacy_pipeline(calculations)
    return calculations.status


def run_per_org_calculations(org_id: OrganizationId) -> PerOrgCalculations:
    """Compute the sample rates of one organization and of its projects and transactions.

    Queries the volumes, runs the balancing models, recalibrates, and returns everything a
    run produced. Reporting is left to the caller, so that a run can be exercised through
    what it computed rather than through what it logged.
    """
    config = get_configuration(org_id)
    calculations = PerOrgCalculations(config=config)

    if not config.is_enabled:
        return calculations.stopped_at(DynamicSamplingStatus.ORG_HAS_NO_DYNAMIC_SAMPLING)

    if not config.projects:
        return calculations.stopped_at(DynamicSamplingStatus.ORG_HAS_NO_PROJECTS)

    if get_eap_organization_volume(config) is None:
        return calculations.stopped_at(DynamicSamplingStatus.NO_ORG_VOLUME)

    calculations.project_volumes = get_eap_project_volumes(config)
    if not calculations.project_volumes:
        return calculations.stopped_at(DynamicSamplingStatus.NO_PROJECT_VOLUMES)

    calculations.summary_log_enabled = is_org_in_sample_rates_summary_log_rollout(
        config.organization.id
    )

    # Read outside the balancing branch when the summary log is on, so orgs that skip project
    # balancing (project-mode custom sampling) still get a generic metrics side in the log.
    if config.should_balance_projects or calculations.summary_log_enabled:
        calculations.cached_project_sample_rates = get_cached_rebalanced_project_sample_rates(
            config.organization.id
        )

    if config.should_balance_projects:
        calculations.rebalanced_projects = apply_project_sample_rate_overrides(
            run_project_balancing(config, calculations.project_volumes)
        )
        config.set_rebalanced_project_sample_rates(calculations.rebalanced_projects)

    if (
        isinstance(config, AutomaticDynamicSamplingConfiguration)
        and config.organization.id in sliding_window_comparison_org_ids()
    ):
        try:
            compare_organization_sliding_window_sample_rates(config)
        except Exception as exc:
            sentry_sdk.capture_exception(exc)

    sample_rates = calculations.project_sample_rates
    # Emitted once per org per scheduler cycle, so summing over one CYCLE_DURATION
    # window yields the total number of projects sampled below 100%.
    projects_below_full_sample_rate = sum(
        1 for sample_rate in sample_rates.values() if sample_rate is not None and sample_rate < 1.0
    )
    if projects_below_full_sample_rate:
        emit_count(PROJECTS_BELOW_FULL_SAMPLE_RATE_METRIC, projects_below_full_sample_rate)
    projects_to_balance = [
        project for project in config.projects if sample_rates.get(project.id) != 1.0
    ]
    if not projects_to_balance:
        return calculations.stopped_at(DynamicSamplingStatus.ALL_PROJECTS_AT_FULL_SAMPLE_RATE)

    transaction_volumes = get_eap_transaction_volumes(config)
    if not transaction_volumes:
        return calculations.stopped_at(DynamicSamplingStatus.NO_TRANSACTION_VOLUMES)

    debug_project_ids = transaction_volume_debug_project_ids() & {
        project.id for project in projects_to_balance
    }
    if debug_project_ids:
        calculations.transaction_volume_debug = collect_transaction_volume_debug(
            config, transaction_volumes, debug_project_ids
        )

    calculations.rebalanced_transactions = run_transaction_balancing(
        config, calculations.project_volumes, transaction_volumes
    )
    # When the summary log is on, the cache is read for every project rather than only the
    # EAP-rebalanced ones, so the log can report a generic metrics side even where EAP
    # produced no transaction rates.
    calculations.cached_transaction_sample_rates = get_cached_rebalanced_transaction_sample_rates(
        org_id=config.organization.id,
        project_ids=(
            [project.id for project in config.projects]
            if calculations.summary_log_enabled
            else list(calculations.rebalanced_transactions.keys())
        ),
    )
    if calculations.summary_log_enabled:
        calculations.cached_organization_sample_rate = get_cached_organization_sample_rate(
            config.organization.id
        )

    if is_org_in_recalibration_rollout(org_id):
        calculations.recalibration_ran = True
        calculations.recalibration_factor = config.recalibrate()
        calculations.cached_recalibration_factor = get_cached_recalibration_factor(
            config.organization.id
        )

    return calculations


@instrumented_task(
    name="sentry.dynamic_sampling.per_org.schedule_per_org_calculations",
    namespace=telemetry_experience_tasks,
    processing_deadline_duration=1 * 60,
    retry=Retry(times=0),
    silo_mode=SiloMode.CELL,
)
@track_dynamic_sampling
def schedule_per_org_calculations() -> None:
    dispatched = 0
    skipped = 0

    def validate_and_track(org_id: int) -> bool:
        nonlocal dispatched, skipped
        if not is_org_in_rollout(org_id):
            skipped += 1
            return False
        dispatched += 1
        return True

    scheduler = CursoredScheduler(
        name="ds_per_org",
        schedule_key="dynamic-sampling-schedule-per-org-calculations",
        queryset=Organization.objects.filter(
            Exists(
                Project.objects.filter(
                    organization_id=OuterRef("pk"),
                    status=ObjectStatus.ACTIVE,
                )
            ),
            status=OrganizationStatus.ACTIVE,
        )
        .annotate(_order_bucket=Mod(F("id"), 10))
        .order_by("_order_bucket", "id"),
        task=run_calculations_per_org_task_entry,
        cycle_duration=CYCLE_DURATION,
        validate_item=validate_and_track,
        preserve_queryset_order=True,
    )
    scheduler.tick()

    emit_status(
        SCHEDULER_BUCKET_ORG_STATUS_METRIC,
        DynamicSamplingStatus.DISPATCHED,
        amount=dispatched,
    )
    emit_status(
        SCHEDULER_BUCKET_ORG_STATUS_METRIC,
        DynamicSamplingStatus.ROLLOUT_EXCLUDED,
        amount=skipped,
    )
