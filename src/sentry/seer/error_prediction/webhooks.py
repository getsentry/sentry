from __future__ import annotations

import logging
from collections.abc import Mapping
from enum import StrEnum
from typing import Any

from sentry import features
from sentry.models.organization import Organization
from sentry.seer.signed_seer_api import post_to_seer
from sentry.utils import metrics

logger = logging.getLogger(__name__)


# https://docs.github.com/en/webhooks/webhook-events-and-payloads#check_run
class CheckRunAction(StrEnum):
    COMPLETED = "completed"
    CREATED = "created"
    REQUESTED_ACTION = "requested_action"
    REREQUESTED = "rerequested"


HANDLED_ACTIONS = [CheckRunAction.REREQUESTED]
# This needs to match the value defined in the Seer API:
# https://github.com/getsentry/seer/blob/main/src/seer/automation/codegen/tasks.py
SEER_ERROR_PREDICTION_PATH = "/v1/automation/codegen/pr-review/github/check-run"


def forward_github_event_for_error_prediction(
    organization: Organization,
    event: Mapping[str, Any],
) -> bool:
    """
    Handle GitHub check_run webhook events for error prediction.

    This is called when a check_run event is received from GitHub,
    which can trigger error prediction analysis and PR comments.

    Args:
        organization: The Sentry organization
        event: The webhook event payload

    Returns:
        True if the event was forwarded successfully, False otherwise
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

    # Check if error prediction/AI features are enabled for this org
    if not features.has("organizations:gen-ai-features", organization):
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

    # Forward minimal payload to Seer for error prediction
    payload = {
        "action": action,
        "check_run": {
            "external_id": check_run.get("external_id"),
            "html_url": check_run.get("html_url"),
        },
    }
    outcome = "failure"
    try:
        post_to_seer(path=SEER_ERROR_PREDICTION_PATH, payload=payload)
        outcome = "success"
    except Exception:
        logger.exception("seer.error_prediction.check_run.forward.exception", extra=extra)
    finally:
        metrics.incr("seer.error_prediction.check_run.forward.outcome", tags={"outcome": outcome})

    return outcome == "success"
