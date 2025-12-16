from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import orjson
from django.conf import settings
from pydantic import ValidationError
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry import options
from sentry.models.organization import Organization
from sentry.net.http import connection_from_url
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.utils import metrics
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
    # Validate event payload using Pydantic
    try:
        validated_event = _validate_github_check_run_event(event)
    except (ValidationError, ValueError):
        # Handle validation errors to prevent sending a 500 error to GitHub
        # which would trigger a retry. Both ValidationError (Pydantic) and
        # ValueError (numeric check) are caught here.
        return False

    if not _should_handle_github_check_run_event(organization, validated_event.action):
        return False

    extra: dict[str, Any] = {
        "organization_id": organization.id,
        "action": validated_event.action,
        "html_url": validated_event.check_run.html_url,
        "external_id": validated_event.check_run.external_id,
    }
    return _make_rerun_request(validated_event.check_run.external_id, extra)


def _validate_github_check_run_event(event: Mapping[str, Any]) -> GitHubCheckRunEvent:
    """
    Validate GitHub check_run event payload using Pydantic.

    Raises:
        ValidationError: If the event payload is invalid
        ValueError: If external_id is not numeric
    """
    try:
        validated_event = GitHubCheckRunEvent.parse_obj(event)
        int(validated_event.check_run.external_id)
    except ValidationError:
        logger.exception("Invalid GitHub check_run event payload")
        metrics.incr(f"{PREFIX}.outcome", tags={"status": "invalid_payload"})
        raise
    except ValueError:
        logger.exception("external_id must be numeric")
        metrics.incr(f"{PREFIX}.outcome", tags={"status": "invalid_payload"})
        raise

    return validated_event


def _make_rerun_request(original_run_id: str, extra: dict[str, Any]) -> bool:
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
        logger.exception("Failed to make rerun request", extra=extra)

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
