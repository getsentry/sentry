from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

import sentry_sdk

from sentry.models.group import Group
from sentry.seer.agent.types import FeatureRunStatus
from sentry.seer.autofix.on_completion_hook import AutofixOnCompletionHook
from sentry.seer.autofix_rca.models import FEATURE_ID
from sentry.seer.models.run import SeerAgentRun

logger = logging.getLogger(__name__)


def deliver_autofix_rca_result(
    organization_id: int,
    run_uuid: UUID,
    status: FeatureRunStatus,
    result: dict[str, Any] | None,
    error: str | None,
) -> None:
    logger.info(
        "autofix_rca.delivery.received",
        extra={"organization_id": organization_id, "run_uuid": run_uuid, "status": status},
    )
    agent_run = (
        SeerAgentRun.objects.filter(
            run__uuid=run_uuid,
            run__organization_id=organization_id,
            source=FEATURE_ID,
        )
        .select_related("run")
        .first()
    )
    if agent_run is None:
        logger.warning(
            "autofix_rca.delivery.missing_run",
            extra={"organization_id": organization_id, "run_uuid": run_uuid},
        )
        return

    run_state_id = agent_run.run.seer_run_state_id
    log_extra: dict[str, object] = {
        "organization_id": organization_id,
        "run_uuid": run_uuid,
        "seer_run_id": run_state_id,
        "group_id": agent_run.group_id,
    }

    if status == "error" or result is None:
        sentry_sdk.metrics.count(
            "autofix_rca.delivery_error",
            1,
            attributes={"error_type": "delivery_error" if status == "error" else "no_result"},
        )
        agent_run.update(
            extras={**(agent_run.extras or {}), "status": "error", "error_message": error}
        )
        logger.warning("autofix_rca.delivery.no_result", extra={**log_extra, "status": status})
        return

    # A redelivery (Seer's push is not idempotent per run) would otherwise run the
    # completion hook twice and continue the pipeline twice.
    if (agent_run.extras or {}).get("status") == "completed":
        sentry_sdk.metrics.count(
            "autofix_rca.delivery_error", 1, attributes={"error_type": "duplicate"}
        )
        logger.warning("autofix_rca.delivery.already_delivered", extra=log_extra)
        return

    # Persist the result for offline evaluation of Seer RCA quality.
    agent_run.update(extras={**(agent_run.extras or {}), "status": "completed", "result": result})

    if agent_run.group_id is None or run_state_id is None:
        logger.warning("autofix_rca.delivery.cannot_surface", extra=log_extra)
        return

    group = (
        Group.objects.filter(id=agent_run.group_id, project__organization_id=organization_id)
        .select_related("project", "project__organization")
        .first()
    )
    if group is None:
        logger.warning("autofix_rca.delivery.group_not_found", extra=log_extra)
        return

    # Hand off to the autofix on-completion hook.
    # In the future, we can put post-RCA specific logic here.
    AutofixOnCompletionHook.execute(group.organization, run_state_id)

    sentry_sdk.metrics.count("autofix_rca.delivery_completed", 1)
    logger.info("autofix_rca.delivery.completed", extra=log_extra)
