from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any
from uuid import UUID

import sentry_sdk
from django.db import router, transaction
from django.utils import timezone

from sentry.models.group import Group
from sentry.seer.agent.types import FeatureRunStatus
from sentry.seer.autofix.autofix_agent import AutofixStep, handle_step_completed_events
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix_rca.models import FEATURE_ID, AutofixRCAResult
from sentry.seer.models.run import SeerAgentRun, SeerRun

logger = logging.getLogger(__name__)


def _resolve_referrer(extras: Mapping[str, Any] | None) -> AutofixReferrer:
    raw = (extras or {}).get("referrer")
    if not isinstance(raw, str):
        return AutofixReferrer.UNKNOWN
    try:
        return AutofixReferrer(raw)
    except ValueError:
        return AutofixReferrer.UNKNOWN


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

    try:
        rca_result = AutofixRCAResult.parse_obj(result)
    except Exception:
        sentry_sdk.metrics.count(
            "autofix_rca.delivery_error", 1, attributes={"error_type": "invalid_result"}
        )
        logger.exception("autofix_rca.delivery.invalid_result", extra=log_extra)
        return

    # Persist the full result for offline evaluation of Seer RCA quality.
    agent_run.update(
        extras={**(agent_run.extras or {}), "status": "completed", "result": rca_result.dict()}
    )

    decision = rca_result.introspection_decision
    action = decision.action.value if decision is not None else "none"

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

    # Hook back into the existing flow: mark the group triggered and emit the
    # completed webhook/analytics the on-completion hook would for a root cause.
    now = timezone.now()
    with transaction.atomic(using=router.db_for_write(Group)):
        group.update(seer_explorer_autofix_last_triggered=now)
        SeerRun.objects.filter(
            organization_id=organization_id, seer_run_state_id=run_state_id
        ).update(last_triggered_at=now)

    handle_step_completed_events(
        group,
        AutofixStep.ROOT_CAUSE,
        run_state_id,
        str(agent_run.run.uuid),
        _resolve_referrer(agent_run.extras),
        artifact_data=rca_result.artifact,
    )

    sentry_sdk.metrics.count(
        "autofix_rca.delivery_completed", 1, attributes={"introspection_action": action}
    )
    logger.info(
        "autofix_rca.delivery.completed",
        extra={
            **log_extra,
            "introspection_action": action,
            "has_artifact": rca_result.artifact is not None,
        },
    )
