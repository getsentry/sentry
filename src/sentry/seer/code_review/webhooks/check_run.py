"""
Webhooks for GitHub check_run webhook events.

This module is used to handle GitHub check_run webhook events for PR review rerun.
When a user clicks "Re-run" on a check run in GitHub UI, we enqueue
a task to forward the original run ID to Seer so it can rerun the PR review.
"""

from __future__ import annotations

import enum
import logging
from collections.abc import Mapping
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, ValidationError  # noqa: F401

from sentry.integrations.github.webhook_types import GithubWebhookType

from ..logging import debug_log
from ..metrics import (
    CodeReviewErrorType,
    WebhookFilteredReason,
    record_webhook_enqueued,
    record_webhook_filtered,
    record_webhook_handler_error,
    record_webhook_received,
)

logger = logging.getLogger(__name__)


class Log(enum.StrEnum):
    MISSING_ACTION = "github.webhook.check_run.missing-action"
    INVALID_PAYLOAD = "github.webhook.check_run.invalid-payload"


class GitHubCheckRunAction(StrEnum):
    COMPLETED = "completed"
    CREATED = "created"
    REQUESTED_ACTION = "requested_action"
    REREQUESTED = "rerequested"


class GitHubCheckRunData(BaseModel):
    """GitHub check_run object structure."""

    external_id: str = Field(..., description="The external ID set by Seer")
    html_url: str = Field(..., description="The URL to view the check run on GitHub")

    class Config:
        extra = "allow"  # Allow additional fields from GitHub (Pydantic v1 syntax)


class GitHubCheckRunEvent(BaseModel):
    """
    GitHub check_run webhook event payload.
    https://docs.github.com/en/webhooks/webhook-events-and-payloads#check_run
    """

    action: str = Field(..., description="The action performed (e.g., 'rerequested')")
    check_run: GitHubCheckRunData = Field(..., description="The check run data")

    class Config:
        extra = "allow"  # Allow additional fields from GitHub (Pydantic v1 syntax)


def handle_check_run_event(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    **kwargs: Any,
) -> None:
    """
    This is called when a check_run event is received from GitHub.
    When a user clicks "Re-run" on a check run in GitHub UI, we enqueue
    a task to forward the original run ID to Seer so it can rerun the PR review.

    Args:
        github_event: The GitHub webhook event type from X-GitHub-Event header (e.g., "check_run")
        event: The webhook event payload
        organization: The Sentry organization that the webhook event belongs to
        **kwargs: Additional keyword arguments
    """
    check_run_data = event.get("check_run", {})
    action = event.get("action")
    html_url = check_run_data.get("html_url")
    external_id = check_run_data.get("external_id")

    base_extra = {
        "github_event": github_event.value if hasattr(github_event, "value") else str(github_event),
        "action": action,
        "html_url": html_url,
        "external_id": external_id,
    }

    debug_log("code_review.check_run.entry", extra=base_extra)

    if github_event != GithubWebhookType.CHECK_RUN:
        debug_log(
            "code_review.check_run.wrong_event_type",
            extra={**base_extra, "expected": "check_run"},
        )
        return

    if action is None:
        debug_log("code_review.check_run.missing_action", extra=base_extra)
        logger.error(Log.MISSING_ACTION.value, extra=base_extra)
        record_webhook_handler_error(
            github_event,
            action or "",
            CodeReviewErrorType.MISSING_ACTION,
        )
        return

    debug_log("code_review.check_run.action_received", extra=base_extra)
    record_webhook_received(github_event, action)

    if action != GitHubCheckRunAction.REREQUESTED:
        debug_log(
            "code_review.check_run.action_not_rerequested",
            extra={**base_extra, "expected_action": "rerequested"},
        )
        record_webhook_filtered(github_event, action, WebhookFilteredReason.UNSUPPORTED_ACTION)
        return

    debug_log("code_review.check_run.validating_payload", extra=base_extra)

    try:
        validated_event = _validate_github_check_run_event(event)
    except (ValidationError, ValueError) as e:
        debug_log(
            "code_review.check_run.validation_failed",
            extra={**base_extra, "error": str(e)},
        )
        # Prevent sending a 500 error to GitHub which would trigger a retry
        logger.exception(Log.INVALID_PAYLOAD.value, extra=base_extra)
        record_webhook_handler_error(
            github_event,
            action,
            CodeReviewErrorType.INVALID_PAYLOAD,
        )
        return

    debug_log(
        "code_review.check_run.validation_success",
        extra={
            **base_extra,
            "validated_external_id": validated_event.check_run.external_id,
        },
    )

    # Import here to avoid circular dependency with webhook_task
    from .task import process_github_webhook_event

    enqueued_at = datetime.now(timezone.utc).isoformat()

    debug_log(
        "code_review.check_run.scheduling_task",
        extra={
            **base_extra,
            "original_run_id": validated_event.check_run.external_id,
            "enqueued_at": enqueued_at,
        },
    )

    # Scheduling the work as a task allows us to retry the request if it fails.
    process_github_webhook_event.delay(
        github_event=github_event,
        # A reduced payload is enough for the task to process.
        event_payload={"original_run_id": validated_event.check_run.external_id},
        action=validated_event.action,
        html_url=validated_event.check_run.html_url,
        enqueued_at_str=enqueued_at,
    )
    record_webhook_enqueued(github_event, action)

    debug_log("code_review.check_run.task_scheduled", extra=base_extra)


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
