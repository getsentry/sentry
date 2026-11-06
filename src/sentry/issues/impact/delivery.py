from __future__ import annotations

import logging
from uuid import UUID

from sentry.issues.action_log import ActionSource, publish_action
from sentry.issues.action_log.types import ImpactAssessmentAction
from sentry.issues.impact.types import IMPACT_FEATURE_ID, SeerImpactAssessmentResponse
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.models.group import Group
from sentry.seer.agent.types import FeatureRunStatus
from sentry.seer.models.run import SeerAgentRun

logger = logging.getLogger(__name__)


def deliver_impact_assessment(
    organization_id: int,
    run_uuid: UUID,
    status: FeatureRunStatus,
    result: dict[str, object] | None,
    error: str | None,
    prompt_version: str | None = None,
) -> None:
    log_extra = {
        "organization_id": organization_id,
        "run_uuid": str(run_uuid),
        "status": status,
    }
    agent_run = (
        SeerAgentRun.objects.filter(
            run__organization_id=organization_id, run__uuid=run_uuid, source=IMPACT_FEATURE_ID
        )
        .select_related("run")
        .first()
    )
    if agent_run is None:
        logger.warning("impact.delivery.missing_run", extra=log_extra)
        return

    if status != "completed" or result is None:
        logger.warning("impact.delivery.failed", extra={**log_extra, "error": error})
        return

    try:
        assessment = SeerImpactAssessmentResponse.parse_obj(result)
        source_event_id = str(agent_run.extras["source_event_id"])
    except (KeyError, TypeError, ValueError):
        logger.exception("impact.delivery.invalid_result", extra=log_extra)
        return

    group = Group.objects.filter(
        id=agent_run.group_id, project__organization_id=organization_id
    ).first()
    if group is None:
        logger.warning("impact.delivery.missing_group", extra=log_extra)
        return

    idempotency_key = f"impact:{run_uuid}"
    if GroupActionLogEntry.objects.filter(
        group_id=group.id, idempotency_key=idempotency_key
    ).exists():
        logger.info("impact.delivery.duplicate", extra=log_extra)
        return

    publish_action(
        ImpactAssessmentAction(
            score=assessment.score,
            description=assessment.description,
            citations=assessment.citations,
            source_event_id=source_event_id,
        ),
        source=ActionSource.SEER_EXPLORER,
        group_id=group.id,
        project=group.project,
        idempotency_key=idempotency_key,
    )
