from __future__ import annotations

from taskbroker_client.retry import Retry

from sentry.dynamic_sampling.per_org.tasks.gate import (
    is_killswitch_engaged,
    is_org_in_rollout,
    is_rollout_enabled,
)
from sentry.dynamic_sampling.per_org.tasks.steps.boost_low_volume_projects import (
    boost_low_volume_projects,
)
from sentry.dynamic_sampling.per_org.tasks.steps.boost_low_volume_transactions import (
    boost_low_volume_transactions,
)
from sentry.dynamic_sampling.per_org.tasks.steps.eap_batch import run_eap_batch
from sentry.dynamic_sampling.per_org.tasks.steps.outcomes_volume import (
    fetch_outcomes_volume,
    has_recent_volume,
)
from sentry.dynamic_sampling.per_org.tasks.steps.recalibration import apply_recalibration
from sentry.dynamic_sampling.per_org.tasks.steps.sliding_window import apply_sliding_window
from sentry.dynamic_sampling.per_org.tasks.telemetry import (
    SCHEDULER_BEAT_STATUS_METRIC,
    TelemetryStatus,
    emit_status,
    emit_status_metric,
    instrumented,
)
from sentry.dynamic_sampling.rules.utils import OrganizationId
from sentry.dynamic_sampling.tasks.utils import dynamic_sampling_task
from sentry.dynamic_sampling.utils import has_dynamic_sampling
from sentry.models.organization import Organization, OrganizationStatus
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import telemetry_experience_tasks
from sentry.utils.query import RangeQuerySetWrapper


@instrumented_task(
    name="sentry.dynamic_sampling.per_org.schedule_per_org_calculations",
    namespace=telemetry_experience_tasks,
    processing_deadline_duration=1 * 60,
    retry=Retry(times=0),
    silo_mode=SiloMode.CELL,
)
@dynamic_sampling_task
def schedule_per_org_calculations() -> None:
    if is_killswitch_engaged():
        emit_status(SCHEDULER_BEAT_STATUS_METRIC, TelemetryStatus.KILLSWITCHED)
        return
    if not is_rollout_enabled():
        emit_status(SCHEDULER_BEAT_STATUS_METRIC, TelemetryStatus.ROLLOUT_DISABLED)
        return

    dispatched = 0
    skipped = 0
    orgs = RangeQuerySetWrapper[Organization](
        Organization.objects.filter(status=OrganizationStatus.ACTIVE),
        step=1000,
        result_value_getter=lambda o: o.id,
    )

    for org in orgs:
        if not is_org_in_rollout(org.id):
            skipped += 1
            continue
        run_calculations_per_org_task.apply_async(args=(org.id,))
        dispatched += 1

    emit_status(SCHEDULER_BEAT_STATUS_METRIC, "dispatched", amount=dispatched)
    emit_status(SCHEDULER_BEAT_STATUS_METRIC, "rollout_excluded", amount=skipped)


@instrumented_task(
    name="sentry.dynamic_sampling.per_org.run_calculations_per_org",
    namespace=telemetry_experience_tasks,
    processing_deadline_duration=20 * 60 + 5,
    retry=Retry(times=5, delay=5),
    silo_mode=SiloMode.CELL,
)
@dynamic_sampling_task
def run_calculations_per_org_task(org_id: OrganizationId) -> None:
    run_calculations_per_org(org_id)


@instrumented
def run_calculations_per_org(org_id: OrganizationId) -> None:
    if is_killswitch_engaged():
        emit_status_metric("killswitched")
        return

    if not is_org_in_rollout(org_id):
        emit_status_metric("not_in_rollout")
        return

    try:
        organization = Organization.objects.get_from_cache(id=org_id)
    except Organization.DoesNotExist:
        emit_status_metric("org_not_found")
        return

    if not has_dynamic_sampling(organization):
        emit_status_metric("org_has_no_dynamic_sampling")
        return

    outcomes = fetch_outcomes_volume(org_id, organization)
    if not has_recent_volume(outcomes):
        emit_status_metric("no_volume")
        return

    eap = run_eap_batch(org_id, organization)

    apply_sliding_window(org_id, organization, eap)
    apply_recalibration(org_id, organization, outcomes)
    boost_low_volume_projects(org_id, organization, eap)
    boost_low_volume_transactions(org_id, organization, eap)

    emit_status_metric("completed")
