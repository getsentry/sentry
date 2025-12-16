from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import orjson
from django.conf import settings
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry import metrics, options
from sentry.models.organization import Organization
from sentry.net.http import connection_from_url
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.utils.seer import can_use_prevent_ai_features

from .types import GitHubCheckRunAction, GitHubCheckRunEvent

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
    if not _should_handle_github_check_run_event(organization, event):
        return False

    try:
        check_run, extra = _extract_check_run_and_extra(event, organization)
    except (TypeError, ValueError, KeyError):
        logger.warning("%s.missing_external_id", PREFIX, extra=extra)
        return False

    return _make_rerun_request(check_run, extra)


def _extract_check_run_and_extra(
    event: Mapping[str, Any],
    organization: Organization,
    action: GitHubCheckRunAction,
) -> tuple[GitHubCheckRunEvent, dict[str, Any]]:
    check_run = event["check_run"].value
    extra = {
        "organization_id": organization.id,
        "action": action,
        "html_url": check_run.value["html_url"],
    }
    original_run_id = check_run.value["external_id"]
    extra["original_run_id"] = original_run_id

    return check_run, extra


def _make_rerun_request(check_run: GitHubCheckRunEvent, extra: dict[str, Any]) -> bool:
    payload = {"original_run_id": check_run["external_id"]}
    error_status = None
    try:
        response = make_signed_seer_api_request(
            connection_pool=connection_pool,
            path=SEER_PR_REVIEW_RERUN_PATH,
            body=orjson.dumps(payload),
        )
        if response.status >= 400:
            error_status = response.status
    except TimeoutError:
        error_status = "timeout"
    except MaxRetryError:
        error_status = "max_retry"

    # Record metric for HTTP responses (both success and error)
    metrics.incr(f"{PREFIX}.outcome", tags={"status": error_status or "success"})

    if error_status is not None:
        logger.error("%s.error", PREFIX, extra={**extra, "error_status": error_status})
        return False

    return True


def _should_handle_github_check_run_event(
    organization: Organization, action: GitHubCheckRunAction
) -> bool:
    """
    Determine if the GitHub check_run event should be handled.
    """
    if not options.get("coding_workflows.code_review.github.enabled"):
        return False

    if not can_use_prevent_ai_features(organization):
        return False

    return action == GitHubCheckRunAction.REREQUESTED
