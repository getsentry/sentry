"""Delivery handler for smart_assignment feature results from Seer.

Seer pushes the `AssigneeVerdict` artifact back via the `deliver_feature_result`
RPC, routed here by feature_id (see `sentry.seer.agent.feature_delivery`). We
locate the pending `SeerSmartAssignmentResult` row by the run uuid and record the
verdict for offline evaluation.
"""

from __future__ import annotations

import logging
from typing import Any

from sentry.seer.agent.types import FeatureRunStatus
from sentry.seer.models.smart_assignment import SeerSmartAssignmentResult, SmartAssignmentStatus

logger = logging.getLogger(__name__)


def deliver_smart_assignment_result(
    organization_id: int,
    run_uuid: str,
    status: FeatureRunStatus,
    result: dict[str, Any] | None,
    error: str | None,
) -> None:
    """Record a smart_assignment verdict delivered from Seer onto its result row."""
    row = SeerSmartAssignmentResult.objects.filter(
        result_seer_run__uuid=run_uuid, organization_id=organization_id
    ).first()
    if row is None:
        logger.warning(
            "smart_assignment.delivery.missing_row",
            extra={"organization_id": organization_id, "run_uuid": run_uuid},
        )
        return

    log_extra = {"organization_id": organization_id, "group_id": row.group_id, "row_id": row.id}

    if status == "error" or result is None:
        row.update(
            status=SmartAssignmentStatus.ERROR,
            extras={**(row.extras or {}), "error": error or "no_artifact"},
        )
        logger.warning("smart_assignment.delivery.no_result", extra={**log_extra, "status": status})
        return

    candidates = result.get("candidates") if isinstance(result, dict) else None
    predicted_identifier = None
    if isinstance(candidates, list) and candidates and isinstance(candidates[0], dict):
        predicted_identifier = candidates[0].get("identifier")

    row.update(
        status=SmartAssignmentStatus.COMPLETED,
        verdict=result,
        predicted_identifier=predicted_identifier,
    )
    logger.info(
        "smart_assignment.delivery.recorded",
        extra={
            **log_extra,
            "num_candidates": len(candidates) if isinstance(candidates, list) else 0,
        },
    )
