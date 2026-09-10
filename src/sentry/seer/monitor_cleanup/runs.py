from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import timedelta
from typing import Any, Literal
from uuid import UUID

from django.db import router, transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, Throttled, ValidationError
from rest_framework.request import Request

from sentry import features
from sentry.models.organization import Organization
from sentry.seer.agent.types import FeatureRunStatus
from sentry.seer.models.night_shift import (
    SeerNightShiftRun,
    SeerNightShiftRunResult,
    SeerNightShiftRunShard,
)
from sentry.seer.models.workflow import SeerWorkflowConfig, SeerWorkflowStrategy
from sentry.seer.monitor_cleanup import FEATURE
from sentry.seer.monitor_cleanup.results import prepare_monitor_cleanup_results
from sentry.seer.monitor_cleanup.schemas import (
    RESPONSE_VERSION,
    MonitorCleanupOutput,
    MonitorCleanupResponseV1,
)

logger = logging.getLogger(__name__)
TERMINAL = {"complete", "partial", "failed"}


def create_monitor_cleanup_run(request: Request, organization: Organization) -> SeerNightShiftRun:
    # Tasks use finish_shard, so import dispatch after module initialization.
    from sentry.tasks.seer.monitor_cleanup import dispatch_run

    if not features.has(FEATURE, organization, actor=request.user):
        raise NotFound
    if not request.user.is_authenticated:
        raise PermissionDenied("Sign in to run a monitor scan.")
    config = SeerWorkflowConfig.get_or_create_for_strategy(
        organization.id, SeerWorkflowStrategy.DUPLICATE_MONITORS
    )
    with transaction.atomic(router.db_for_write(SeerNightShiftRun)):
        config = SeerWorkflowConfig.objects.select_for_update().get(id=config.id)
        if SeerNightShiftRun.objects.filter(
            workflow_config=config, date_completed__isnull=True
        ).exists():
            raise ValidationError({"detail": "A monitor scan is already running."})
        if (
            SeerNightShiftRun.objects.filter(
                workflow_config=config, date_added__gte=timezone.now() - timedelta(hours=1)
            ).count()
            >= 5
        ):
            raise Throttled(
                detail="This organization has reached the limit of five scans per hour."
            )
        run = SeerNightShiftRun.objects.create(
            organization=organization,
            workflow_config=config,
            extras={
                "options": {"source": "manual"},
                "triggering_user_id": request.user.id,
                "status": "running",
                "response_schema_version": RESPONSE_VERSION,
            },
        )
        SeerNightShiftRunShard.objects.create(run=run, extras={"status": "queued"})
        transaction.on_commit(
            lambda: dispatch_run(run.id), using=router.db_for_write(SeerNightShiftRun)
        )
    return run


def finish_shard(
    shard_id: int,
    *,
    outputs: Sequence[MonitorCleanupOutput] | None = None,
    scan_status: Literal["complete", "partial"] = "complete",
    error: str | None = None,
) -> None:
    shard = SeerNightShiftRunShard.objects.filter(id=shard_id).first()
    if shard is None:
        return
    with transaction.atomic(router.db_for_write(SeerNightShiftRun)):
        run = SeerNightShiftRun.objects.select_for_update().filter(id=shard.run_id).first()
        if run is None:
            return
        shard = (
            SeerNightShiftRunShard.objects.select_related("seer_run").filter(id=shard_id).first()
        )
        if shard is None or shard.extras.get("status") in TERMINAL:
            return
        for output in outputs or []:
            SeerNightShiftRunResult.objects.get_or_create(
                run=run,
                kind=SeerWorkflowStrategy.DUPLICATE_MONITORS,
                idempotency_key=f"project:{output['projectId']}",
                defaults={"result_seer_run": shard.seer_run, "extras": output},
            )
        status = "failed" if error else scan_status
        shard.update(extras={**shard.extras, "status": status, "error": error})
        run.update(
            extras={**run.extras, "status": status},
            date_completed=timezone.now(),
        )


def deliver_monitor_cleanup_result(
    organization_id: int,
    run_uuid: UUID,
    status: FeatureRunStatus,
    result: dict[str, Any] | None,
    error: str | None,
    prompt_version: str | None = None,
) -> None:
    shard = (
        SeerNightShiftRunShard.objects.select_related("run__organization", "seer_run")
        .filter(
            run__organization_id=organization_id,
            run__workflow_config__strategy=SeerWorkflowStrategy.DUPLICATE_MONITORS,
            seer_run__uuid=run_uuid,
        )
        .first()
    )
    if shard is None or shard.extras.get("status") in TERMINAL:
        return
    if status != "completed" or result is None:
        finish_shard(shard.id, error="Seer could not complete this scan.")
        return
    # Reject unknown envelopes before interpreting their contents as the current schema.
    if (
        type(result.get("schema_version")) is not int
        or result["schema_version"] != RESPONSE_VERSION
    ):
        finish_shard(
            shard.id, error="Seer returned an unsupported monitor cleanup response version."
        )
        return
    try:
        response = MonitorCleanupResponseV1.parse_obj(result)
        outputs = prepare_monitor_cleanup_results(
            response.data, shard.run.organization, shard.run.extras["triggering_user_id"]
        )
    except ValueError:
        logger.exception("monitor_cleanup.invalid_output", extra={"shard_id": shard.id})
        finish_shard(shard.id, error="Seer returned findings that could not be validated.")
        return
    scan_status = response.data.scan_status
    if any(project.scan_status == "partial" for project in response.data.projects):
        scan_status = "partial"
    finish_shard(shard.id, outputs=outputs, scan_status=scan_status)
