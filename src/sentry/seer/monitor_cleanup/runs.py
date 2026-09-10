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
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.agent.types import FeatureRunStatus
from sentry.seer.models import SeerPermissionError
from sentry.seer.models.run import SeerAgentRun, SeerRun
from sentry.seer.monitor_cleanup import FEATURE, FEATURE_ID
from sentry.seer.monitor_cleanup.results import prepare_monitor_cleanup_results
from sentry.seer.monitor_cleanup.schemas import (
    RESPONSE_VERSION,
    MonitorCleanupOutput,
    MonitorCleanupResponseV1,
    MonitorCleanupRunExtras,
)

logger = logging.getLogger(__name__)
TERMINAL = {"complete", "partial", "failed"}
RUN_TIMEOUT = timedelta(minutes=15)


def create_monitor_cleanup_run(request: Request, organization: Organization) -> SeerRun:
    # Timeout scheduling calls finish_run if enqueueing fails.
    from sentry.tasks.seer.monitor_cleanup import schedule_timeout

    if not features.has(FEATURE, organization, actor=request.user):
        raise NotFound
    if not request.user.is_authenticated:
        raise PermissionDenied("Sign in to run a monitor scan.")
    try:
        client = SeerAgentClient(organization=organization, user=request.user)
    except SeerPermissionError as error:
        raise PermissionDenied(str(error)) from error
    with transaction.atomic(router.db_for_write(SeerRun)):
        Organization.objects.select_for_update().get(id=organization.id)
        runs = SeerAgentRun.objects.filter(run__organization=organization, source=FEATURE_ID)
        if runs.filter(extras__status="running").exists():
            raise ValidationError({"detail": "A monitor scan is already running."})
        if runs.filter(run__date_added__gte=timezone.now() - timedelta(hours=1)).count() >= 5:
            raise Throttled(
                detail="This organization has reached the limit of five scans per hour."
            )
        extras: MonitorCleanupRunExtras = {
            "status": "running",
            "date_completed": None,
            "error": None,
            "response_schema_version": RESPONSE_VERSION,
            "project_ids": [],
            "results": [],
        }
        run = client.start_feature_run(
            feature_id=FEATURE_ID,
            payload={"response_version": RESPONSE_VERSION},
            title="Monitor cleanup",
            flush=False,
            extras=dict(extras),
            referrer=FEATURE_ID,
        )
        transaction.on_commit(lambda: schedule_timeout(run.id), using=router.db_for_write(SeerRun))
    return run


def finish_run(
    run_id: int,
    *,
    outputs: Sequence[MonitorCleanupOutput] = (),
    scan_status: Literal["complete", "partial"] = "complete",
    error: str | None = None,
) -> None:
    with transaction.atomic(router.db_for_write(SeerAgentRun)):
        agent_run = (
            SeerAgentRun.objects.select_for_update()
            .filter(run_id=run_id, source=FEATURE_ID)
            .first()
        )
        if agent_run is None or agent_run.extras.get("status") in TERMINAL:
            return
        extras: MonitorCleanupRunExtras = {
            "status": "failed" if error else scan_status,
            "date_completed": timezone.now().isoformat(),
            "error": error,
            "response_schema_version": RESPONSE_VERSION,
            "project_ids": [output["projectId"] for output in outputs],
            "results": list(outputs),
        }
        agent_run.update(extras={**agent_run.extras, **extras})


def deliver_monitor_cleanup_result(
    organization_id: int,
    run_uuid: UUID,
    status: FeatureRunStatus,
    result: dict[str, Any] | None,
    error: str | None,
    prompt_version: str | None = None,
) -> None:
    agent_run = (
        SeerAgentRun.objects.select_related("run__organization")
        .filter(
            run__organization_id=organization_id,
            source=FEATURE_ID,
            run__uuid=run_uuid,
        )
        .first()
    )
    if agent_run is None or agent_run.extras.get("status") in TERMINAL:
        return
    if agent_run.run.user_id is None:
        finish_run(agent_run.run_id, error="The triggering user no longer exists.")
        return
    if status != "completed" or result is None:
        finish_run(agent_run.run_id, error="Seer could not complete this scan.")
        return
    # Reject unknown envelopes before interpreting their contents as the current schema.
    if (
        type(result.get("schema_version")) is not int
        or result["schema_version"] != RESPONSE_VERSION
    ):
        finish_run(
            agent_run.run_id, error="Seer returned an unsupported monitor cleanup response version."
        )
        return
    try:
        response = MonitorCleanupResponseV1.parse_obj(result)
        outputs = prepare_monitor_cleanup_results(
            response.data, agent_run.run.organization, agent_run.run.user_id
        )
    except ValueError:
        logger.exception("monitor_cleanup.invalid_output", extra={"agent_run_id": agent_run.id})
        finish_run(agent_run.run_id, error="Seer returned findings that could not be validated.")
        return
    scan_status = response.data.scan_status
    if any(project.scan_status == "partial" for project in response.data.projects):
        scan_status = "partial"
    finish_run(agent_run.run_id, outputs=outputs, scan_status=scan_status)
