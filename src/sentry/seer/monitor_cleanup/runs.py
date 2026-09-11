from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import timedelta
from functools import partial
from typing import Any, Literal, cast
from uuid import UUID

from django.db import router, transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.request import Request

from sentry import features
from sentry.models.organization import Organization
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.agent.types import FeatureRunStatus
from sentry.seer.models import SeerPermissionError
from sentry.seer.models.run import SeerAgentRun, SeerRun
from sentry.seer.monitor_cleanup import FEATURE, FEATURE_ID
from sentry.seer.monitor_cleanup.results import load_monitor_cleanup_results
from sentry.seer.monitor_cleanup.schemas import (
    RESPONSE_VERSION,
    MonitorCleanupOutput,
    MonitorCleanupResponseV1,
    MonitorCleanupRunExtras,
)
from sentry.tasks.seer import monitor_cleanup as monitor_cleanup_tasks
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser

logger = logging.getLogger(__name__)
TERMINAL = {"complete", "partial", "failed"}
RUN_TIMEOUT = timedelta(minutes=15)


def create_monitor_cleanup_run(request: Request, organization: Organization) -> SeerRun:
    if not features.has(FEATURE, organization, actor=request.user):
        raise NotFound
    if not request.user.is_authenticated:
        raise PermissionDenied("Sign in to run a monitor scan.")
    try:
        client = SeerAgentClient(organization=organization, user=cast(User | RpcUser, request.user))
    except SeerPermissionError as error:
        raise PermissionDenied(str(error)) from error
    extras: MonitorCleanupRunExtras = {
        "status": "running",
        "date_completed": None,
        "error": None,
        "response_schema_version": RESPONSE_VERSION,
        "project_ids": [],
        "results": [],
    }
    return client.start_feature_run(
        feature_id=FEATURE_ID,
        payload={"response_version": RESPONSE_VERSION},
        title="Monitor cleanup",
        flush=False,
        extras=dict(extras),
        referrer=FEATURE_ID,
        on_run_created=lambda run: transaction.on_commit(
            partial(monitor_cleanup_tasks.schedule_timeout, run.id, run.organization_id),
            using=router.db_for_write(SeerRun),
        ),
    )


def deliver_monitor_cleanup_result(
    organization_id: int,
    run_uuid: UUID,
    status: FeatureRunStatus,
    result: dict[str, Any] | None,
    error: str | None,
    prompt_version: str | None = None,
) -> None:
    log_extra = {"organization_id": organization_id, "run_uuid": str(run_uuid), "status": status}
    logger.info("monitor_cleanup.delivery.received", extra=log_extra)
    agent_run = (
        SeerAgentRun.objects.select_related("run__organization")
        .filter(
            run__organization_id=organization_id,
            source=FEATURE_ID,
            run__uuid=run_uuid,
        )
        .first()
    )
    if agent_run is None:
        logger.warning("monitor_cleanup.delivery.missing_run", extra=log_extra)
        return
    if agent_run.extras.get("status") in TERMINAL:
        logger.info("monitor_cleanup.delivery.already_finished", extra=log_extra)
        return
    if agent_run.run.user_id is None:
        finish_run(
            agent_run.run_id,
            organization_id=organization_id,
            error="The triggering user no longer exists.",
        )
        return
    if status != "completed" or result is None:
        logger.warning("monitor_cleanup.delivery.failed", extra={**log_extra, "error": error})
        finish_run(
            agent_run.run_id,
            organization_id=organization_id,
            error="Seer could not complete this scan.",
        )
        return
    try:
        response = MonitorCleanupResponseV1.parse_obj(result)
        outputs = load_monitor_cleanup_results(
            response.data, agent_run.run.organization, agent_run.run.user_id
        )
    except Exception:
        logger.exception("monitor_cleanup.invalid_output", extra={"agent_run_id": agent_run.id})
        finish_run(
            agent_run.run_id,
            organization_id=organization_id,
            error="Seer returned findings that could not be loaded.",
        )
        return
    scan_status = response.data.scan_status
    if any(project.scan_status == "partial" for project in response.data.projects):
        scan_status = "partial"
    finish_run(
        agent_run.run_id, organization_id=organization_id, outputs=outputs, scan_status=scan_status
    )


def finish_run(
    run_id: int,
    *,
    organization_id: int,
    outputs: Sequence[MonitorCleanupOutput] = (),
    scan_status: Literal["complete", "partial"] = "complete",
    error: str | None = None,
) -> None:
    with transaction.atomic(router.db_for_write(SeerAgentRun)):
        agent_run = (
            SeerAgentRun.objects.select_for_update(of=("self",))
            .filter(run_id=run_id, run__organization_id=organization_id, source=FEATURE_ID)
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
    logger.info(
        "monitor_cleanup.run.finished",
        extra={
            "run_id": run_id,
            "organization_id": organization_id,
            "status": extras["status"],
            "error": error,
        },
    )
