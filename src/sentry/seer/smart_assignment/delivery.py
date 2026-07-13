"""Delivery handler for smart_assignment feature results from Seer.

Seer pushes the `AssigneeVerdict` artifact back via the `deliver_feature_result`
RPC, routed here by feature_id (see `sentry.seer.agent.feature_delivery`). We
locate the pending `SeerSmartAssignmentResult` row by the run uuid and record the
verdict for offline evaluation.
"""

from __future__ import annotations

import logging
from typing import Any

from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.seer.agent.types import FeatureRunStatus
from sentry.seer.models.smart_assignment import SeerSmartAssignmentResult, SmartAssignmentStatus
from sentry.seer.smart_assignment.scoring import score_prediction
from sentry.users.services.user.service import user_service
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def _resolve_identifier_to_user_id(
    organization: Organization, identifier: str | None
) -> int | None:
    """Map an agent-produced `@username`/email `identifier` to a user id in the org.

    The agent predicts a person as a string -- preferably the `@username` of a
    linked Sentry user, falling back to a raw commit email (see the
    `RankedCandidate.identifier` contract on the Seer side). Returns None when the
    identifier is empty, doesn't match any user, or the matched user isn't a member
    of the org. Email-shaped identifiers resolve by verified email; everything else
    resolves by username (falling back to email). Matches are always confirmed
    against org membership so a username collision can't attribute a prediction to
    someone outside the org.
    """
    if not identifier:
        return None

    cleaned = identifier.strip().lstrip("@").strip()
    if not cleaned:
        return None

    if "@" in cleaned:
        users = user_service.get_many_by_email(
            emails=[cleaned], organization_id=organization.id, is_verified=True
        )
    else:
        users = user_service.get_by_username(username=cleaned)

    candidate_ids = [user.id for user in users]
    if not candidate_ids:
        return None

    member_ids = set(
        OrganizationMember.objects.filter(
            organization_id=organization.id, user_id__in=candidate_ids
        ).values_list("user_id", flat=True)
    )
    for user_id in candidate_ids:
        if user_id in member_ids:
            return user_id
    return None


def deliver_smart_assignment_result(
    organization_id: int,
    run_uuid: str,
    status: FeatureRunStatus,
    result: dict[str, Any] | None,
    error: str | None,
) -> None:
    """Record a smart_assignment verdict delivered from Seer onto its result row.

    Emits a single `smart_assignment.delivery` counter tagged with the outcome so
    we can track success vs failure, how often the agent abstains, and how often it
    names someone we can't link to a Sentry user in the org:
      - `missing_row`  -- delivery arrived with no matching row (orphaned run)
      - `error`        -- Seer run failed or returned no artifact
      - `abstain`      -- completed, but the agent named no one
      - `unlinked`     -- named someone we couldn't map to an org user
      - `resolved`     -- named someone we mapped to a Sentry user
    """
    row = SeerSmartAssignmentResult.objects.filter(
        result_seer_run__uuid=run_uuid, organization_id=organization_id
    ).first()
    if row is None:
        metrics.incr("smart_assignment.delivery", tags={"outcome": "missing_row"})
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
        metrics.incr("smart_assignment.delivery", tags={"outcome": "error"})
        logger.warning("smart_assignment.delivery.no_result", extra={**log_extra, "status": status})
        return

    candidates = result.get("candidates") if isinstance(result, dict) else None
    predicted_identifier = None
    if isinstance(candidates, list) and candidates and isinstance(candidates[0], dict):
        predicted_identifier = candidates[0].get("identifier")

    # Resolve the top pick to a Sentry user so evaluation can compare it directly
    # against the recorded ground-truth assignee. Left null if the agent named no
    # one or the identifier doesn't map to a user in the org; the raw string is
    # still preserved in `verdict`.
    predicted_assignee_user_id = _resolve_identifier_to_user_id(
        row.organization, predicted_identifier
    )

    row.update(
        status=SmartAssignmentStatus.COMPLETED,
        verdict=result,
        predicted_assignee_user_id=predicted_assignee_user_id,
    )

    if not predicted_identifier:
        outcome = "abstain"
    elif predicted_assignee_user_id is None:
        outcome = "unlinked"
    else:
        outcome = "resolved"
    metrics.incr("smart_assignment.delivery", tags={"outcome": outcome})

    # Ground truth may already be recorded (assignment landed before Seer finished);
    # if so this completes the pair and scores correctness now.
    score_prediction(row)

    logger.info(
        "smart_assignment.delivery.recorded",
        extra={
            **log_extra,
            "outcome": outcome,
            "num_candidates": len(candidates) if isinstance(candidates, list) else 0,
        },
    )
