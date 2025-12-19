"""
Webhooks for GitHub webhook events.

This module handles GitHub webhook events for code review and schedules tasks to process them.

See webhook_tasks.py for the tasks that are scheduled to process the webhook events.

Currently, this module is only used to handle the webhook events from GitHub when a user clicks "Re-run" on a check run in GitHub UI.
When a user clicks "Re-run" on a check run in GitHub UI, we enqueue a task to forward the original run ID to Seer so it can rerun the PR review.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any

from pydantic import ValidationError

from sentry import features
from sentry.constants import ENABLE_PR_REVIEW_TEST_GENERATION_DEFAULT, HIDE_AI_FEATURES_DEFAULT
from sentry.models.organization import Organization
from sentry.utils import metrics

from .types import GitHubCheckRunAction, GitHubCheckRunEvent
from .webhook_task import process_github_webhook_event

logger = logging.getLogger(__name__)

PREFIX = "seer.code_review.check_run.rerun"


def handle_github_check_run_event(organization: Organization, event: Mapping[str, Any]) -> bool:
    """
    Handle GitHub check_run webhook events for PR review rerun.

    This is called when a check_run event is received from GitHub.
    When a user clicks "Re-run" on a check run in GitHub UI, we enqueue
    a task to forward the original run ID to Seer so it can rerun the PR review.

    Args:
        organization: The Sentry organization
        event: The webhook event payload

    Returns:
        True if the event was handled successfully (task enqueued), False otherwise
    """
    action = event.get("action")
    if action is None:
        logger.error("github.webhook.check_run.missing-action")
        metrics.incr(f"{PREFIX}.outcome", tags={"status": "missing_action"})
        return False

    if not _should_handle_github_check_run_event(organization, action):
        return False

    try:
        validated_event = _validate_github_check_run_event(event)
    except (ValidationError, ValueError):
        # Prevent sending a 500 error to GitHub which would trigger a retry
        logger.exception("github.webhook.check_run.invalid-payload")
        metrics.incr(f"{PREFIX}.outcome", tags={"status": "invalid_payload"})
        return False

    process_github_webhook_event.delay(
        original_run_id=validated_event.check_run.external_id,
        organization_id=organization.id,
        action=validated_event.action,
        html_url=validated_event.check_run.html_url,
        enqueued_at_str=datetime.now(timezone.utc).isoformat(),
    )

    metrics.incr(f"{PREFIX}.enqueued", tags={"status": "success"})
    return True


def _validate_github_check_run_event(event: Mapping[str, Any]) -> GitHubCheckRunEvent:
    """
    Validate GitHub check_run event payload using Pydantic.

    Raises:
        ValidationError: If the event payload is invalid
        ValueError: If external_id is not numeric
    """
    validated_event = GitHubCheckRunEvent.parse_obj(event)
    int(validated_event.check_run.external_id)  # Raises ValueError if not numeric
    return validated_event


def _should_handle_github_check_run_event(organization: Organization, action: str) -> bool:
    """
    Determine if the GitHub check_run event should be handled.
    """
    if action != GitHubCheckRunAction.REREQUESTED:
        return False

    if not features.has("organizations:gen-ai-features", organization):
        return False

    hide_ai_features = organization.get_option("sentry:hide_ai_features", HIDE_AI_FEATURES_DEFAULT)
    if hide_ai_features:
        return False

    pr_review_test_generation_enabled = bool(
        organization.get_option(
            "sentry:enable_pr_review_test_generation",
            ENABLE_PR_REVIEW_TEST_GENERATION_DEFAULT,
        )
    )
    if not pr_review_test_generation_enabled:
        return False

    return features.has("organizations:code-review-beta", organization)
