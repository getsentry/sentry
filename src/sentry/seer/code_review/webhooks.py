"""
Webhooks for GitHub webhook events.

This module handles GitHub webhook events for code review and schedules tasks to process them.

See tasks.py for the tasks that are scheduled to process the webhook events.

Currently, this module is only used to handle the webhook events from GitHub when a user clicks "Re-run" on a check run in GitHub UI.
When a user clicks "Re-run" on a check run in GitHub UI, we enqueue a task to forward the original run ID to Seer so it can rerun the PR review.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any

from pydantic import ValidationError

from sentry.models.organization import Organization

# TODO: Move that functionality to src/sentry/seer/code_review/utils.py when we have more webhook events to handle.
from sentry.overwatch.endpoints.overwatch_rpc import _is_eligible_for_code_review
from sentry.utils import metrics

from .types import GitHubCheckRunAction, GitHubCheckRunEvent

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
    if not _should_handle_github_check_run_event(organization, event["action"]):
        return False

    # Validate event payload using Pydantic
    try:
        validated_event = _validate_github_check_run_event(event)
    except (ValidationError, ValueError):
        # Handle validation errors to prevent sending a 500 error to GitHub
        # which would trigger a retry. Both ValidationError (Pydantic) and
        # ValueError (numeric check) are caught here.
        metrics.incr(f"{PREFIX}.outcome", tags={"status": "invalid_payload"})
        return False

    # Enqueue task to process the rerun request asynchronously
    from .tasks import process_github_webhook_event

    # Note: bind=True means self is automatically provided, mypy doesn't understand this
    process_github_webhook_event.delay(  # type: ignore[call-arg]
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
    try:
        validated_event = GitHubCheckRunEvent.parse_obj(event)
        int(validated_event.check_run.external_id)
    # These exceptions should be reported to GitHub as errors.
    except ValidationError:
        logger.exception("Invalid GitHub check_run event payload")
        raise
    except ValueError:
        logger.exception("external_id must be numeric")
        raise

    return validated_event


def _should_handle_github_check_run_event(organization: Organization, action: str) -> bool:
    """
    Determine if the GitHub check_run event should be handled.
    """

    if not _is_eligible_for_code_review(
        organization,
        # XXX: Handle these later
        repository_id=1,
        integration_id=1,
        external_identifier="",
    ):
        return False

    return action == GitHubCheckRunAction.REREQUESTED
