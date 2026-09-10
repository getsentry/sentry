from __future__ import annotations

import logging
from datetime import timedelta

from django.utils import timezone

from sentry import features
from sentry.auth import access
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.models.night_shift import (
    SeerNightShiftRun,
    SeerNightShiftRunShard,
)
from sentry.seer.models.run import SeerRun
from sentry.seer.monitor_cleanup import (
    FEATURE,
    FEATURE_ID,
    TERMINAL,
    finish_shard,
)
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.users.services.user.service import user_service
from sentry.viewer_context import ActorType, ViewerContext, viewer_context_scope

logger = logging.getLogger(__name__)
RUN_TIMEOUT = timedelta(minutes=15)


@instrumented_task(
    name="sentry.tasks.seer.monitor_cleanup.scan_organization",
    namespace=seer_tasks,
    processing_deadline_duration=120,
)
def scan_organization(shard_id: int) -> None:
    shard = (
        SeerNightShiftRunShard.objects.select_related("run__organization")
        .filter(id=shard_id)
        .first()
    )
    if shard is None or shard.seer_run_id is not None or shard.extras.get("status") in TERMINAL:
        return
    run = shard.run
    try:
        user = user_service.get_user(user_id=run.extras["triggering_user_id"])
        if not user or not access.from_user(user, run.organization).has_scope("org:read"):
            raise ValueError("The triggering user no longer has access to this organization.")
        if not features.has(FEATURE, run.organization, actor=user):
            raise ValueError("Monitor cleanup is not enabled for this organization.")

        def on_run_created(seer_run: SeerRun) -> None:
            shard.update(seer_run=seer_run, extras={**shard.extras, "status": "running"})

        with viewer_context_scope(
            ViewerContext(
                organization_id=run.organization_id,
                user_id=user.id,
                actor_type=ActorType.USER,
            )
        ):
            client = SeerAgentClient(organization=run.organization, user=user)
            client.start_feature_run(
                feature_id=FEATURE_ID,
                payload={"response_version": run.extras["response_schema_version"]},
                title="Monitor cleanup",
                flush=False,
                on_run_created=on_run_created,
                referrer=FEATURE_ID,
            )
    except Exception:
        logger.exception("monitor_cleanup.dispatch_failed", extra={"shard_id": shard_id})
        finish_shard(
            shard_id, error="Could not start the scan. Check organization access and Seer logs."
        )


@instrumented_task(
    name="sentry.tasks.seer.monitor_cleanup.expire_run",
    namespace=seer_tasks,
    processing_deadline_duration=30,
)
def expire_run(run_id: int) -> None:
    run = SeerNightShiftRun.objects.filter(id=run_id, date_completed__isnull=True).first()
    if run is None or timezone.now() - run.date_added < RUN_TIMEOUT:
        return
    shard = run.shards.first()
    if shard is not None:
        finish_shard(shard.id, error="The scan timed out. Start a new run to try again.")


def dispatch_run(run_id: int) -> None:
    run = SeerNightShiftRun.objects.filter(id=run_id).first()
    if run is None or run.date_completed is not None:
        return
    shard = run.shards.first()
    if shard is None:
        return
    try:
        # Queue the timeout first so an accepted scan always has a terminal fallback.
        expire_run.apply_async(args=[run.id], countdown=int(RUN_TIMEOUT.total_seconds()))
        scan_organization.apply_async(args=[shard.id])
    except Exception:
        logger.exception("monitor_cleanup.enqueue_failed", extra={"shard_id": shard.id})
        finish_shard(shard.id, error="Could not queue this monitor scan.")
