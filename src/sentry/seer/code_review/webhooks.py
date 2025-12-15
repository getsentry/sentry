from __future__ import annotations

import logging
from collections.abc import Mapping
from enum import StrEnum
from typing import Any

from sentry import options
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


# This needs to match the value defined in the Seer API:
# https://github.com/getsentry/seer/blob/main/src/seer/automation/codegen/pr_review_coding_agent.py
SEER_PR_REVIEW_RERUN_PATH = "/v1/automation/codegen/pr-review/rerun"
PREFIX = "seer.error_prediction.check_run"


def handle_github_check_run_event(organization: Organization, event: Mapping[str, Any]) -> bool:
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
    check_run = event["check_run"]
    action = event["action"]
    extra = {
        "organization_id": organization.id,
        "action": action,
        "html_url": check_run.get("html_url"),
    }
    try:
        original_run_id = int(event["check_run"]["external_id"])
        extra["original_run_id"] = original_run_id
    except (TypeError, ValueError, KeyError):
        logger.warning("%s.missing_external_id", PREFIX, extra=extra)
        return False

    if not _should_handle_github_check_run_event(organization, action):
        return False

    # Forward the original run ID to Seer for PR review rerun
    payload = {"original_run_id": original_run_id}
    outcome = "failure"
    try:
        post_to_seer(path=SEER_PR_REVIEW_RERUN_PATH, payload=payload)
        outcome = "success"
    except Exception:
        logger.exception("%s.forward.exception", PREFIX, extra=extra)
    finally:
        metrics.incr(f"{PREFIX}.forward.outcome", tags={"outcome": outcome})

    return outcome == "success"


def _should_handle_github_check_run_event(organization: Organization, action: str) -> bool:
    """
    Determine if the GitHub check_run event should be handled.
    """
    if not can_use_prevent_ai_features(organization):
        return False

    if action != CheckRunAction.REREQUESTED:
        return False

    if not options.get("coding_workflows.error_prediction.github.check_run.rerun.enabled"):
        return False

    return True
