"""Per-org dynamic sampling pipeline tasks.

Defines the cron-driven bucket scheduler and the per-org worker that runs one
cycle of dynamic-sampling calculations end-to-end. Tasks are registered at
import time via `@instrumented_task`; `TASKWORKER_IMPORTS` targets this module
so decorators run on startup.

The scheduling side is split into two tasks to keep bucket progress safe
under retries:

* ``schedule_per_org_calculations`` is the beat entry point. It atomically
  INCRs a Redis cursor, captures the resulting ``bucket_index``, and
  dispatches the bucket task with that index. It runs without retries so a
  failure here can never advance the cursor twice for the same revolution.
* ``schedule_per_org_calculations_bucket`` does the actual fan-out and is
  safely retryable: retries re-execute with the same ``bucket_index`` so a
  transient failure cannot cause a bucket to be skipped.

The worker side (``run_calculations_per_org_task``) runs one full cycle for a
single organization; each phase lives in its own module under ``steps.*`` and
is wired together by ``run_calculations_per_org``.
"""

from __future__ import annotations

import random
from datetime import datetime, timezone

import sentry_sdk
from django.db.models import F
from django.db.models.functions import Mod
from taskbroker_client.retry import Retry

from sentry.dynamic_sampling.per_org.tasks.gate import is_killswitch_engaged, is_org_in_rollout
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
    SCHEDULER_BUCKET_ORG_STATUS_METRIC,
    SCHEDULER_BUCKET_SIZE_METRIC,
    SCHEDULER_BUCKET_STATUS_METRIC,
    emit_gauge,
    emit_status,
    emit_status_metric,
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
