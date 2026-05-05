from __future__ import annotations

import random
from datetime import datetime, timezone

import sentry_sdk
from django.db.models import F
from django.db.models.functions import Mod
from taskbroker_client.retry import Retry

from sentry.dynamic_sampling.per_org.tasks.gate import is_org_in_rollout
from sentry.dynamic_sampling.per_org.tasks.queries import get_eap_organization_volume
from sentry.dynamic_sampling.per_org.tasks.telemetry import (
    SCHEDULER_BUCKET_ORG_STATUS_METRIC,
    TelemetryStatus,
    emit_status,
    track_dynamic_sampling,
)
from sentry.dynamic_sampling.rules.utils import OrganizationId, get_redis_client_for_ds
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
    try:
        redis_client = get_redis_client_for_ds()
        bucket_index = (redis_client.incr(BUCKET_CURSOR_KEY) - 1) % BUCKET_COUNT
    except Exception as exc:
        sentry_sdk.capture_exception(exc)
        return datetime.now(tz=timezone.utc).minute % BUCKET_COUNT
    return bucket_index


@instrumented_task(
    name="sentry.dynamic_sampling.per_org.schedule_per_org_calculations",
    namespace=telemetry_experience_tasks,
    processing_deadline_duration=1 * 60,
    retry=Retry(times=0),
    silo_mode=SiloMode.CELL,
)
@track_dynamic_sampling
def schedule_per_org_calculations() -> None:
    bucket_index = _next_bucket_index()
    bucket_tag = {"bucket_index": str(bucket_index)}
    dispatched = 0
    skipped = 0
    queryset = (
        Organization.objects.filter(status=OrganizationStatus.ACTIVE)
        .annotate(_bucket=Mod(F("id"), BUCKET_COUNT))
        .filter(_bucket=bucket_index)
        .values_list("id", flat=True)
    )
    org_ids = RangeQuerySetWrapper[int](
        queryset,
        step=1000,
        result_value_getter=lambda org_id: org_id,
    )

    for org_id in org_ids:
        if not is_org_in_rollout(org_id):
            skipped += 1
            continue
        run_calculations_per_org_task.apply_async(
            args=(org_id,),
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
    return None


@instrumented_task(
    name="sentry.dynamic_sampling.per_org.run_calculations_per_org",
    namespace=telemetry_experience_tasks,
    processing_deadline_duration=2 * 60,  # 2 minute timeout per org
    silo_mode=SiloMode.CELL,
)
@track_dynamic_sampling
def run_calculations_per_org_task(org_id: OrganizationId) -> TelemetryStatus | None:
    try:
        organization = Organization.objects.get_from_cache(id=org_id)
    except Organization.DoesNotExist:
        return TelemetryStatus.ORG_NOT_FOUND

    if not has_dynamic_sampling(organization):
        return TelemetryStatus.ORG_HAS_NO_DYNAMIC_SAMPLING

    org_volume = get_eap_organization_volume(organization)
    if org_volume is None:
        return TelemetryStatus.NO_VOLUME

    return None
