from __future__ import annotations

import random
from datetime import datetime, timezone

import sentry_sdk
from django.db.models import F
from django.db.models.functions import Mod
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
    SCHEDULER_BUCKET_ORG_STATUS_METRIC,
    TelemetryStatus,
    emit_status,
    instrumented,
)
from sentry.dynamic_sampling.rules.utils import OrganizationId, get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.utils import dynamic_sampling_task
from sentry.dynamic_sampling.utils import has_dynamic_sampling
from sentry.models.organization import Organization, OrganizationStatus
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import telemetry_experience_tasks
from sentry.utils.query import RangeQuerySetWrapper

BUCKET_COUNT = 10
JITTER_WINDOW_SECONDS = 60
BUCKET_CURSOR_KEY = "ds::per_org:bucket_cursor"


def _next_bucket_index() -> int:
    redis_client = get_redis_client_for_ds()
    try:
        next_value = redis_client.incr(BUCKET_CURSOR_KEY)
    except Exception as exc:
        sentry_sdk.capture_exception(exc)
        return datetime.now(tz=timezone.utc).minute % BUCKET_COUNT
    return (int(next_value) - 1) % BUCKET_COUNT


@instrumented_task(
    name="sentry.dynamic_sampling.per_org.schedule_per_org_calculations",
    namespace=telemetry_experience_tasks,
    processing_deadline_duration=1 * 60,
    retry=Retry(times=0),
    silo_mode=SiloMode.CELL,
)
@instrumented
def schedule_per_org_calculations() -> None:
    if is_killswitch_engaged():
        return TelemetryStatus.KILLSWITCHED
    if not is_rollout_enabled():
        return TelemetryStatus.ROLLOUT_DISABLED

    bucket_index = _next_bucket_index()
    schedule_per_org_calculations_bucket.apply_async(args=(bucket_index,))


@instrumented_task(
    name="sentry.dynamic_sampling.per_org.schedule_per_org_calculations_bucket",
    namespace=telemetry_experience_tasks,
    processing_deadline_duration=5 * 60,
    retry=Retry(times=3, delay=5),
    silo_mode=SiloMode.CELL,
)
@instrumented
def schedule_per_org_calculations_bucket(bucket_index: int) -> None:
    bucket_index = bucket_index % BUCKET_COUNT
    bucket_tag = {"bucket_index": str(bucket_index)}

    if is_killswitch_engaged():
        return TelemetryStatus.KILLSWITCHED
    if not is_rollout_enabled():
        return TelemetryStatus.ROLLOUT_DISABLED

    dispatched = 0
    skipped = 0
    queryset = (
        Organization.objects.filter(status=OrganizationStatus.ACTIVE)
        .annotate(_bucket=Mod(F("id"), BUCKET_COUNT))
        .filter(_bucket=bucket_index)
    )
    orgs = RangeQuerySetWrapper[Organization](
        queryset,
        step=1000,
        result_value_getter=lambda o: o.id,
    )

    for org in orgs:
        if not is_org_in_rollout(org.id):
            skipped += 1
            continue
        # jitter the tasks over the entire bucket to avoid spawning all tasks at once
        run_calculations_per_org_task.apply_async(
            args=(org.id,),
            countdown=random.randint(0, JITTER_WINDOW_SECONDS),
        )
        dispatched += 1

    emit_status(
        SCHEDULER_BUCKET_ORG_STATUS_METRIC,
        TelemetryStatus.DISPATCHED,
        amount=dispatched,
        extra_tags=bucket_tag,
    )
    emit_status(
        SCHEDULER_BUCKET_ORG_STATUS_METRIC,
        TelemetryStatus.ROLLOUT_EXCLUDED,
        amount=skipped,
        extra_tags=bucket_tag,
    )
    return TelemetryStatus.COMPLETED


@instrumented_task(
    name="sentry.dynamic_sampling.per_org.run_calculations_per_org",
    namespace=telemetry_experience_tasks,
    processing_deadline_duration=2 * 60,  # 2 minute timeout per org
    silo_mode=SiloMode.CELL,
)
@dynamic_sampling_task
def run_calculations_per_org_task(org_id: OrganizationId) -> None:
    run_calculations_per_org(org_id)


@instrumented
def run_calculations_per_org(org_id: OrganizationId) -> TelemetryStatus | None:
    if is_killswitch_engaged():
        return TelemetryStatus.KILLSWITCHED

    if not is_org_in_rollout(org_id):
        return TelemetryStatus.NOT_IN_ROLLOUT

    try:
        organization = Organization.objects.get_from_cache(id=org_id)
    except Organization.DoesNotExist:
        return TelemetryStatus.ORG_NOT_FOUND

    if not has_dynamic_sampling(organization):
        return TelemetryStatus.ORG_HAS_NO_DYNAMIC_SAMPLING

    outcomes = fetch_outcomes_volume(org_id, organization)
    if not has_recent_volume(outcomes):
        return TelemetryStatus.NO_VOLUME

    eap = run_eap_batch(org_id, organization)

    apply_sliding_window(org_id, organization, eap)
    apply_recalibration(org_id, organization, outcomes)
    boost_low_volume_projects(org_id, organization, eap)
    boost_low_volume_transactions(org_id, organization, eap)
