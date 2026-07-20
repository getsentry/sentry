from __future__ import annotations

from datetime import timedelta

import sentry_sdk
from taskbroker_client.retry import Retry

from sentry.dynamic_sampling.per_org.calculations import (
    apply_project_sample_rate_overrides,
    compare_organization_sliding_window_sample_rates,
    compare_rebalanced_projects_with_cache,
    compare_rebalanced_transactions_with_cache,
    get_cached_rebalanced_project_sample_rates,
    get_cached_rebalanced_transaction_sample_rates,
    run_project_balancing,
    run_transaction_balancing,
)
from sentry.dynamic_sampling.per_org.configuration import (
    AutomaticDynamicSamplingConfiguration,
    get_configuration,
)
from sentry.dynamic_sampling.per_org.gate import (
    is_org_in_rollout,
    sliding_window_comparison_org_ids,
)
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

    org_volume_5m = get_eap_organization_volume(config)
    if org_volume_5m is None:
        return DynamicSamplingStatus.NO_ORG_VOLUME

    project_volumes = get_eap_project_volumes(config)
    if not project_volumes:
        return DynamicSamplingStatus.NO_PROJECT_VOLUMES

    if config.should_balance_projects:
        rebalanced_projects = run_project_balancing(config, project_volumes)
        rebalanced_projects = apply_project_sample_rate_overrides(rebalanced_projects)
        config.set_rebalanced_project_sample_rates(rebalanced_projects)
        cached_sample_rates = get_cached_rebalanced_project_sample_rates(config.organization.id)
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

    # run_transaction_balancing skips projects at a 100% rate (legacy parity), so their
    # transaction volumes are never used — leave them out of the query.
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

    transaction_volumes = get_eap_transaction_volumes(config, root_projects=projects_to_balance)
    if not transaction_volumes:
        return DynamicSamplingStatus.NO_TRANSACTION_VOLUMES

    rebalanced_transactions = run_transaction_balancing(
        config, project_volumes, transaction_volumes
    )
    cached_transaction_sample_rates = get_cached_rebalanced_transaction_sample_rates(
        org_id=config.organization.id, project_ids=rebalanced_transactions.keys()
    )
    compare_rebalanced_transactions_with_cache(
        config, rebalanced_transactions, cached_transaction_sample_rates
    )

    return None


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
        queryset=Organization.objects.filter(status=OrganizationStatus.ACTIVE),
        task=run_calculations_per_org_task_entry,
        cycle_duration=CYCLE_DURATION,
        validate_item=validate_and_track,
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
