from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

import sentry_sdk
from django.db.models import Exists, F, OuterRef
from django.db.models.functions import Mod
from taskbroker_client.retry import Retry

from sentry.constants import ObjectStatus
from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.per_org.calculations import (
    apply_project_sample_rate_overrides,
    compare_organization_sliding_window_sample_rates,
    compare_rebalanced_projects_with_cache,
    compare_rebalanced_transactions_with_cache,
    compare_recalibration_factor_with_cache,
    get_cached_organization_sample_rate,
    get_cached_rebalanced_project_sample_rates,
    get_cached_rebalanced_transaction_sample_rates,
    get_cached_recalibration_factor,
    log_transaction_volume_debug,
    run_project_balancing,
    run_transaction_balancing,
)
from sentry.dynamic_sampling.per_org.configuration import (
    AutomaticDynamicSamplingConfiguration,
    BaseDynamicSamplingConfiguration,
    ProjectSampleRates,
    get_configuration,
)
from sentry.dynamic_sampling.per_org.gate import (
    is_org_in_recalibration_rollout,
    is_org_in_rollout,
    is_org_in_sample_rates_summary_log_rollout,
    sliding_window_comparison_org_ids,
    transaction_volume_debug_project_ids,
)
from sentry.dynamic_sampling.per_org.queries import (
    get_eap_organization_volume,
    get_eap_project_volumes,
    get_eap_transaction_volumes,
    get_recalibration_organization_volume,
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

logger = logging.getLogger(__name__)

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
    config = get_configuration(org_id)
    if not config.is_enabled:
        return DynamicSamplingStatus.ORG_HAS_NO_DYNAMIC_SAMPLING

    if not config.projects:
        return DynamicSamplingStatus.ORG_HAS_NO_PROJECTS

    # Recalibration pairs this volume with an outcomes query later in the task. The end is
    # fixed here instead of taken twice from the clock, and truncated to the minute because
    # the outcomes query widens its window to whole minutes.
    org_volume_end = datetime.now(UTC).replace(second=0, microsecond=0)
    org_volume_5m = get_eap_organization_volume(config, end=org_volume_end)
    if org_volume_5m is None:
        return DynamicSamplingStatus.NO_ORG_VOLUME

    project_volumes = get_eap_project_volumes(config)
    if not project_volumes:
        return DynamicSamplingStatus.NO_PROJECT_VOLUMES

    log_summary = is_org_in_sample_rates_summary_log_rollout(config.organization.id)

    # Read outside the balancing branch when the summary log is on, so orgs that skip project
    # balancing (project-mode custom sampling) still get a generic metrics side in the log.
    cached_sample_rates: dict[int, float | None] = {}
    if config.should_balance_projects or log_summary:
        cached_sample_rates = get_cached_rebalanced_project_sample_rates(config.organization.id)

    if config.should_balance_projects:
        rebalanced_projects = run_project_balancing(config, project_volumes)
        rebalanced_projects = apply_project_sample_rate_overrides(rebalanced_projects)
        config.set_rebalanced_project_sample_rates(rebalanced_projects)
        compare_rebalanced_projects_with_cache(
            config, rebalanced_projects, cached_sample_rates, project_volumes
        )

    if (
        isinstance(config, AutomaticDynamicSamplingConfiguration)
        and config.organization.id in sliding_window_comparison_org_ids()
    ):
        try:
            compare_organization_sliding_window_sample_rates(config)
        except Exception as exc:
            sentry_sdk.capture_exception(exc)

    sample_rates = config.get_project_sample_rates()
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
        return DynamicSamplingStatus.ALL_PROJECTS_AT_FULL_SAMPLE_RATE

    transaction_volumes = get_eap_transaction_volumes(config)
    if not transaction_volumes:
        return DynamicSamplingStatus.NO_TRANSACTION_VOLUMES

    debug_project_ids = transaction_volume_debug_project_ids() & {
        project.id for project in projects_to_balance
    }
    if debug_project_ids:
        log_transaction_volume_debug(config, transaction_volumes, debug_project_ids)

    rebalanced_transactions = run_transaction_balancing(
        config, project_volumes, transaction_volumes
    )
    # When the summary log is on, the cache is read for every project rather than only the
    # EAP-rebalanced ones, so the log can report a generic metrics side even where EAP
    # produced no transaction rates.
    cached_transaction_sample_rates = get_cached_rebalanced_transaction_sample_rates(
        org_id=config.organization.id,
        project_ids=(
            [project.id for project in config.projects]
            if log_summary
            else list(rebalanced_transactions.keys())
        ),
    )
    compare_rebalanced_transactions_with_cache(
        config, rebalanced_transactions, cached_transaction_sample_rates
    )

    if log_summary:
        log_sample_rates_summary(
            config,
            project_sample_rates=sample_rates,
            cached_project_sample_rates=cached_sample_rates,
            rebalanced_transactions=rebalanced_transactions,
            cached_transaction_sample_rates=cached_transaction_sample_rates,
        )

    if is_org_in_recalibration_rollout(org_id):
        recalibration_volume = get_recalibration_organization_volume(
            config,
            org_volume_5m,
            time_interval=timedelta(minutes=5),
            end=org_volume_end,
        )
        calculated_factor = config.recalibrate(recalibration_volume)
        cached_factor = get_cached_recalibration_factor(config.organization.id)
        compare_recalibration_factor_with_cache(
            config, recalibration_volume, calculated_factor, cached_factor
        )

    return None


def log_sample_rates_summary(
    config: BaseDynamicSamplingConfiguration,
    project_sample_rates: ProjectSampleRates,
    cached_project_sample_rates: dict[int, float | None],
    rebalanced_transactions: dict[int, tuple[list[RebalancedItem], float]],
    cached_transaction_sample_rates: dict[int, tuple[dict[str, float], float] | None],
) -> None:
    """
    One line per org per cycle with the org, project and transaction sample rates of both
    the EAP and the generic metrics (legacy) pipeline, for side-by-side comparison without
    having to join the per-project and per-transaction comparison logs.
    """
    projects_summary = {}
    for project in config.projects:
        project_id = project.id
        eap_named_rates, eap_implicit_rate = rebalanced_transactions.get(project_id, ([], None))
        cached_transactions = cached_transaction_sample_rates.get(project_id)
        generic_metrics_named_rates, generic_metrics_implicit_rate = (
            ({}, None) if cached_transactions is None else cached_transactions
        )
        projects_summary[str(project_id)] = {
            "eap_sample_rate": project_sample_rates.get(project_id),
            "generic_metrics_sample_rate": cached_project_sample_rates.get(project_id),
            "eap_transaction_implicit_sample_rate": eap_implicit_rate,
            "generic_metrics_transaction_implicit_sample_rate": generic_metrics_implicit_rate,
            "eap_transaction_sample_rates": {
                str(item.id): item.new_sample_rate for item in eap_named_rates
            },
            "generic_metrics_transaction_sample_rates": generic_metrics_named_rates,
        }

    logger.info(
        "dynamic_sampling.per_org.sample_rates_summary",
        extra={
            "org_id": config.organization.id,
            "eap_org_sample_rate": config.get_sample_rate(),
            "eap_org_serving_sample_rate": config.get_serving_sample_rate(),
            "generic_metrics_org_sample_rate": get_cached_organization_sample_rate(
                config.organization.id
            ),
            "projects": projects_summary,
        },
    )


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
