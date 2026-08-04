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
from sentry.seer.autofix.artifact_schemas import RootCauseArtifact
from sentry.seer.autofix.autofix_agent import AutofixStep, handle_step_completed_events
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.on_completion_hook import record_fixability
from sentry.seer.autofix_rca.models import FEATURE_ID
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

    root_cause_artifact = RootCauseArtifact.model_validate(result)

    # Persist the full result for offline evaluation of Seer RCA quality.
    agent_run.update(
        extras={
            **(agent_run.extras or {}),
            "status": "completed",
            "result": root_cause_artifact.model_dump(),
        }
    )

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

    referrer = _resolve_referrer(agent_run.extras)

    handle_step_completed_events(
        group,
        AutofixStep.ROOT_CAUSE,
        run_state_id,
        str(agent_run.run.uuid),
        referrer,
        artifact_data=root_cause_artifact,
    )

    fixability = record_fixability(
        organization=group.organization,
        group=group,
        run_id=run_state_id,
        artifact_data=root_cause_artifact,
        step=AutofixStep.ROOT_CAUSE,
        referrer=referrer,
        reached_stopping_point=True,
    )

    sentry_sdk.metrics.count(
        "autofix_rca.delivery_completed",
        1,
        attributes={"fixability": fixability.assessment if fixability else "none"},
    )
    logger.info(
        "autofix_rca.delivery.completed",
        extra={
            **log_extra,
            "fixability": fixability.assessment if fixability else None,
            "has_artifact": result is not None,
        },
    )
