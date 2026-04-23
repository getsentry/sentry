"""Per-org scheduler.

Cron entry point that fans the per-org orchestrator out across all active
organizations. Orgs are split into `BUCKET_COUNT` deterministic buckets by
`Organization.id % BUCKET_COUNT`, and a Redis-backed cursor advances one
bucket per run, so after `BUCKET_COUNT` runs every org has been scheduled
exactly once without tracking individual orgs.

The cursor is advanced exactly once per beat fire. To guarantee that, the
scheduling work is split into two tasks:

* ``schedule_per_org_calculations`` is the beat entry point. It atomically
  INCRs the cursor, captures the resulting bucket_index, and dispatches the
  bucket task with that index as an argument. It runs without retries so a
  failure here can never advance the cursor twice for the same revolution.
* ``schedule_per_org_calculations_bucket_task`` does the actual fan-out and
  is safely retryable: retries re-execute with the same bucket_index, so a
  transient failure cannot cause a bucket to be skipped.
"""

from __future__ import annotations

import random
from datetime import datetime, timezone

import sentry_sdk
from django.db.models import F
from django.db.models.functions import Mod
from taskbroker_client.retry import Retry

from sentry.dynamic_sampling.per_org.tasks.gate import is_killswitch_engaged, is_org_in_rollout
from sentry.dynamic_sampling.per_org.tasks.orchestrator import run_calculations_per_org_task
from sentry.dynamic_sampling.per_org.tasks.telemetry import (
    SCHEDULER_BEAT_STATUS_METRIC,
    SCHEDULER_BUCKET_ORG_STATUS_METRIC,
    SCHEDULER_BUCKET_SIZE_METRIC,
    SCHEDULER_BUCKET_STATUS_METRIC,
    emit_gauge,
    emit_status,
)
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.utils import dynamic_sampling_task
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
    except Exception as e:
        sentry_sdk.capture_exception(e)
        return datetime.now(tz=timezone.utc).minute % BUCKET_COUNT
    return (int(next_value) - 1) % BUCKET_COUNT


@instrumented_task(
    name="sentry.dynamic_sampling.per_org.schedule_per_org_calculations_bucket",
    namespace=telemetry_experience_tasks,
    processing_deadline_duration=5 * 60,
    retry=Retry(times=3, delay=5),
    silo_mode=SiloMode.CELL,
)
@dynamic_sampling_task
def schedule_per_org_calculations_bucket(bucket_index: int) -> None:
    """Fan out a single bucket of orgs to the orchestrator.

    ``bucket_index`` is supplied by the beat entry so retries of this task
    always re-process the same bucket instead of advancing the cursor.
    """
    if is_killswitch_engaged():
        emit_status(SCHEDULER_BUCKET_STATUS_METRIC, "killswitched")
        return

    if not 0 <= bucket_index < BUCKET_COUNT:
        sentry_sdk.capture_message(
            f"bucket_index out of range: {bucket_index}, wrapping via modulo",
            level="warning",
        )
        bucket_index = bucket_index % BUCKET_COUNT

    queryset = (
        Organization.objects.filter(status=OrganizationStatus.ACTIVE)
        .annotate(_bucket=Mod(F("id"), BUCKET_COUNT))
        .filter(_bucket=bucket_index)
    )

    dispatched = 0
    skipped = 0
    orgs = RangeQuerySetWrapper[Organization](
        queryset,
        step=1000,
        result_value_getter=lambda o: o.id,
    )

    for org in orgs:
        if not is_org_in_rollout(org.id):
            skipped += 1
            continue
        countdown = random.randint(0, JITTER_WINDOW_SECONDS)
        run_calculations_per_org_task.apply_async(args=(org.id,), countdown=countdown)
        dispatched += 1

    bucket_tag = {"bucket_index": str(bucket_index)}
    emit_gauge(SCHEDULER_BUCKET_SIZE_METRIC, dispatched + skipped, tags=bucket_tag)
    emit_status(
        SCHEDULER_BUCKET_ORG_STATUS_METRIC,
        "dispatched",
        amount=dispatched,
        extra_tags=bucket_tag,
    )
    emit_status(
        SCHEDULER_BUCKET_ORG_STATUS_METRIC,
        "rollout_excluded",
        amount=skipped,
        extra_tags=bucket_tag,
    )
    emit_status(SCHEDULER_BUCKET_STATUS_METRIC, "completed")


@instrumented_task(
    name="sentry.dynamic_sampling.per_org.schedule_per_org_calculations",
    namespace=telemetry_experience_tasks,
    processing_deadline_duration=1 * 60,
    retry=Retry(times=0),
    silo_mode=SiloMode.CELL,
)
@dynamic_sampling_task
def schedule_per_org_calculations() -> None:
    """Beat entry point: advance the bucket cursor by exactly one.

    Retries are deliberately disabled. The only work here is an atomic INCR
    plus a single dispatch; a retry would re-INCR the cursor and silently
    skip the bucket that failed. If dispatch fails the bucket is missed for
    this revolution, which is a less severe failure mode than double-
    advancing the cursor.
    """
    if is_killswitch_engaged():
        emit_status(SCHEDULER_BEAT_STATUS_METRIC, "killswitched")
        return

    bucket_index = _next_bucket_index()
    schedule_per_org_calculations_bucket.apply_async(args=(bucket_index,))
    emit_status(SCHEDULER_BEAT_STATUS_METRIC, "dispatched")
