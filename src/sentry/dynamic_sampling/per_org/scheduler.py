from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

import sentry_sdk
from taskbroker_client.retry import Retry

from sentry import features
from sentry.dynamic_sampling.per_org.cache import write_caches
from sentry.dynamic_sampling.per_org.calculations import (
    apply_project_sample_rate_overrides,
    run_project_balancing,
    run_transaction_balancing,
)
from sentry.dynamic_sampling.per_org.comparisons import emit_comparisons
from sentry.dynamic_sampling.per_org.configuration import (
    BaseDynamicSamplingConfiguration,
    get_configuration,
)
from sentry.dynamic_sampling.per_org.feature_cache import (
    candidate_organizations,
    get_orgs_with_dynamic_sampling,
)
from sentry.dynamic_sampling.per_org.gate import (
    is_org_in_recalibration_rollout,
    is_org_in_rollout,
)
from sentry.dynamic_sampling.per_org.queries import (
    RECALIBRATION_TIME_INTERVAL,
    get_eap_organization_volume,
    get_eap_project_volumes,
    get_eap_transaction_volumes,
)
from sentry.dynamic_sampling.per_org.telemetry import (
    SCHEDULER_BUCKET_ORG_STATUS_METRIC,
    DynamicSamplingStatus,
    emit_status,
    track_dynamic_sampling,
)
from sentry.dynamic_sampling.rules.utils import OrganizationId
from sentry.dynamic_sampling.utils import DYNAMIC_SAMPLING_FEATURE
from sentry.models.organization import Organization
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import telemetry_experience_tasks
from sentry.utils.cursored_scheduler import CursoredScheduler

logger = logging.getLogger(__name__)

# How long a full pass through all organizations should take.
CYCLE_DURATION = timedelta(minutes=10)


class PerOrgCalculationError(Exception):
    """One organization's pass through the per-org pipeline failed.

    Deliberately not a ``DynamicSamplingException``: that one reports an expected outcome
    as a status and is swallowed by ``track_dynamic_sampling``, while a failure here has
    to reach Sentry and fail the task.
    """


def _failure_context(
    org_id: OrganizationId, config: BaseDynamicSamplingConfiguration
) -> dict[str, object]:
    """The pipeline inputs that explain a failed pass, for the Sentry event.

    Every value is read behind a guard, so that a second failure while describing the
    first one cannot replace it with a less useful error.
    """
    context: dict[str, object] = {"organization_id": org_id}
    try:
        results = config.results
        org_volume = results.organization_volume
        context.update(
            {
                "organization_slug": config.organization.slug,
                "configuration": type(config).__name__,
                "target_sample_rate": config.get_sample_rate(),
                "projects": len(config.projects),
                "projects_to_balance": len(results.projects_to_balance),
                "project_volumes": len(results.project_volumes),
                "transaction_volumes": len(results.transaction_volumes),
                "organization_total": org_volume.total if org_volume else None,
                "organization_indexed": org_volume.indexed if org_volume else None,
                "recalibration_factor": results.recalibration_factor,
            }
        )
    except Exception:
        context["incomplete"] = True
    return context


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

    try:
        results = config.results
        org_volume_end = datetime.now(UTC).replace(second=0, microsecond=0)
        results.organization_volume = get_eap_organization_volume(
            config, time_interval=RECALIBRATION_TIME_INTERVAL, end=org_volume_end
        )
        if results.organization_volume is None:
            return DynamicSamplingStatus.NO_ORG_VOLUME
        results.project_volumes = get_eap_project_volumes(config)
        if not results.project_volumes:
            return DynamicSamplingStatus.NO_PROJECT_VOLUMES

        if config.should_balance_projects:
            rebalanced_projects = run_project_balancing(config, results.project_volumes)
            rebalanced_projects = apply_project_sample_rate_overrides(rebalanced_projects)
            config.set_rebalanced_project_sample_rates(rebalanced_projects)

        sample_rates = config.get_project_sample_rates()
        results.projects_to_balance = [
            project for project in config.projects if sample_rates.get(project.id) != 1.0
        ]
        if not results.projects_to_balance:
            return DynamicSamplingStatus.ALL_PROJECTS_AT_FULL_SAMPLE_RATE

        results.transaction_volumes = get_eap_transaction_volumes(config)
        if not results.transaction_volumes:
            return DynamicSamplingStatus.NO_TRANSACTION_VOLUMES

        results.rebalanced_transactions = run_transaction_balancing(
            config, results.project_volumes, results.transaction_volumes
        )

        if is_org_in_recalibration_rollout(config.organization.id):
            config.recalibrate(results.organization_volume)
        write_caches(config)
        return None

    except Exception as e:
        context = _failure_context(org_id, config)
        # Attached to the isolation scope, so that the capture_exception in
        # track_dynamic_sampling reports it with the event.
        sentry_sdk.set_context("dynamic_sampling_per_org", context)
        raise PerOrgCalculationError(
            f"Per-org calculations failed for organization {org_id}"
        ) from e
    finally:
        emit_comparisons(config)


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

    def keep_orgs_with_dynamic_sampling(organizations: Sequence[Organization]) -> list[int]:
        # A None result means the check failed, which would otherwise read as "none of them".
        results = features.batch_has_for_organizations(DYNAMIC_SAMPLING_FEATURE, organizations)
        if results is None:
            raise RuntimeError(f"Unable to evaluate {DYNAMIC_SAMPLING_FEATURE} for a batch of orgs")

        kept = [org.id for org in organizations if results.get(f"organization:{org.id}", False)]
        emit_status(
            SCHEDULER_BUCKET_ORG_STATUS_METRIC,
            DynamicSamplingStatus.ORG_HAS_NO_DYNAMIC_SAMPLING,
            amount=len(organizations) - len(kept),
        )
        return kept

    organizations = candidate_organizations()
    # A cold cache reads as None, and falling back to the full population keeps the
    # pipeline running. The per-item check still rejects any org that does not qualify.
    orgs_with_dynamic_sampling = get_orgs_with_dynamic_sampling()
    if orgs_with_dynamic_sampling is not None:
        organizations = organizations.filter(id__in=orgs_with_dynamic_sampling)

    scheduler = CursoredScheduler(
        name="ds_per_org",
        schedule_key="dynamic-sampling-schedule-per-org-calculations",
        queryset=organizations,
        task=run_calculations_per_org_task_entry,
        cycle_duration=CYCLE_DURATION,
        validate_item=validate_and_track,
        prevalidate_batch=keep_orgs_with_dynamic_sampling,
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
