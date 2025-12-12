from __future__ import annotations

import logging
from collections.abc import Mapping
from enum import StrEnum
from typing import Any

from sentry.models.organization import Organization
from sentry.seer.signed_seer_api import post_to_seer
from sentry.utils import metrics
from sentry.utils.seer import can_use_prevent_ai_features

logger = logging.getLogger(__name__)


# https://docs.github.com/en/webhooks/webhook-events-and-payloads#check_run
class CheckRunAction(StrEnum):
    COMPLETED = "completed"
    CREATED = "created"
    REQUESTED_ACTION = "requested_action"
    REREQUESTED = "rerequested"


HANDLED_ACTIONS = [CheckRunAction.REREQUESTED]
# This needs to match the value defined in the Seer API:
# https://github.com/getsentry/seer/blob/main/src/seer/automation/codegen/pr_review_coding_agent.py
SEER_PR_REVIEW_RERUN_PATH = "/v1/automation/codegen/pr-review/rerun"


def handle_github_check_run_event(
    organization: Organization,
    event: Mapping[str, Any],
) -> bool:
    """
    Handle GitHub check_run webhook events for PR review rerun.

    This is called when a check_run event is received from GitHub.
    When a user clicks "Re-run" on a check run in GitHub UI, we forward
    the original run ID to Seer so it can rerun the PR review.

    Args:
        organization: The Sentry organization
        event: The webhook event payload

    Returns:
        True if the event was handled successfully, False otherwise
    """
    check_run = event.get("check_run")
    action = event.get("action")

    extra = {
        "organization_id": organization.id,
        "action": action,
        "check_run_html_url": check_run.get("html_url") if check_run else None,
        "check_run_name": check_run.get("name") if check_run else None,
        "check_run_external_id": check_run.get("external_id") if check_run else None,
    }

    # Check if the org has opted in to Prevent AI features (Code Review)
    # This checks feature flags, org options, and billing plan type
    if not can_use_prevent_ai_features(organization):
        logger.debug("seer.error_prediction.check_run.feature_disabled", extra=extra)
        return False

    # Only handle relevant actions
    if action not in HANDLED_ACTIONS:
        logger.debug("seer.error_prediction.check_run.skipped_action", extra=extra)
        return False

    # Validate required fields after feature/action checks
    if not check_run:
        logger.warning("seer.error_prediction.check_run.missing_check_run", extra=extra)
        return False

    # Extract and validate external_id (required for Seer to identify the original run)
    raw_external_id = check_run.get("external_id")
    if not raw_external_id:
        logger.warning("seer.error_prediction.check_run.missing_external_id", extra=extra)
        return False

    try:
        original_run_id = int(raw_external_id)
    except (TypeError, ValueError):
        logger.warning(
            "seer.error_prediction.check_run.invalid_external_id",
            extra={**extra, "raw_external_id": raw_external_id},
        )
        return False

    # Forward the original run ID to Seer for PR review rerun
    payload = {"original_run_id": original_run_id}
    outcome = "failure"
    try:
        post_to_seer(path=SEER_PR_REVIEW_RERUN_PATH, payload=payload)
        outcome = "success"
    except Exception:
        logger.exception("seer.error_prediction.check_run.forward.exception", extra=extra)
    finally:
        metrics.incr("seer.error_prediction.check_run.forward.outcome", tags={"outcome": outcome})

    return outcome == "success"
