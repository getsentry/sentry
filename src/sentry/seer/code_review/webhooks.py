from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import orjson
from django.conf import settings
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry import options
from sentry.models.organization import Organization
from sentry.net.http import connection_from_url
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.utils import metrics
from sentry.utils.seer import can_use_prevent_ai_features

from .types import GitHubCheckRunAction

logger = logging.getLogger(__name__)


# This needs to match the value defined in the Seer API:
# https://github.com/getsentry/seer/blob/main/src/seer/automation/codegen/pr_review_coding_agent.py
SEER_PR_REVIEW_RERUN_PATH = "/v1/automation/codegen/pr-review/rerun"
PREFIX = "seer.code_review.check_run.rerun"

connection_pool = connection_from_url(settings.SEER_AUTOFIX_URL)


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
    if not _should_handle_github_check_run_event(organization, event["action"]):
        return False

    # Build base extra dict for logging
    extra = {
        "organization_id": organization.id,
        "action": event["action"],
    }
    try:
        check_run = event["check_run"]
        extra["html_url"] = check_run["html_url"]
        external_id_str = check_run["external_id"]
        extra["external_id"] = external_id_str
        original_run_id = int(external_id_str)
    except (KeyError, ValueError) as e:
        # We need to handle these errors to prevent sending a 500 error to GitHub
        # which would trigger a retry.
        extra["error"] = str(e)
        # If this happens, we should report it to GitHub as their payload is invalid.
        logger.warning("%s.invalid_payload", PREFIX, extra=extra)
        metrics.incr(f"{PREFIX}.outcome", tags={"status": "invalid_payload"})
        return False

    return _make_rerun_request(original_run_id, extra)


def _make_rerun_request(original_run_id: int, extra: dict[str, Any]) -> bool:
    payload = {"original_run_id": original_run_id}
    status = "failure"
    try:
        response = make_signed_seer_api_request(
            connection_pool=connection_pool,
            path=SEER_PR_REVIEW_RERUN_PATH,
            body=orjson.dumps(payload),
        )
        if response.status >= 400:
            logger.error("%s.error", PREFIX, extra=extra)
        else:
            status = "success"
    except (TimeoutError, MaxRetryError) as e:
        status = e.__class__.__name__
        logger.exception("%s.%s", PREFIX, status, extra=extra)

    # Record metric for HTTP responses (both success and error)
    metrics.incr(f"{PREFIX}.outcome", tags={"status": status == "success"})
    if status != "success":
        return False

    return True


def _should_handle_github_check_run_event(organization: Organization, action: str) -> bool:
    """
    Determine if the GitHub check_run event should be handled.
    """
    if not options.get("coding_workflows.code_review.github.check_run.rerun.enabled"):
        return False

    if not can_use_prevent_ai_features(organization):
        return False

    return action == GitHubCheckRunAction.REREQUESTED
