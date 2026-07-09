"""
Trigger an Autofix PR iteration from a GitHub PR comment mention.

When a user comments ``@sentry iterate <feedback>`` on a pull request that
Autofix created, we kick off a ``PR_ITERATION`` run that revises the existing
PR using the comment as feedback. The commenter must have write access to the
repository so that random GitHub users can't drive Autofix runs (which cost
quota and rewrite the PR).
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from sentry import features
from sentry.integrations.services.integration import RpcIntegration
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.seer.webhooks import SentryIterateCommand, sentry_command
from sentry.tasks.seer.pr_iteration import trigger_pr_iteration_from_comment

logger = logging.getLogger(__name__)


def handle_issue_comment_for_autofix_iteration(
    *,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """
    Webhook processor for ``issue_comment`` events that triggers an Autofix PR
    iteration when a user comments ``@sentry``.
    """
    action = event.get("action")
    comment = event.get("comment", {})
    comment_id = comment.get("id")
    log_extra = {"organization_id": organization.id, "comment_id": comment_id}

    # These two filters fire on essentially every issue_comment webhook, so they
    # log at debug to avoid spamming prod. Enable debug logging locally to see them.
    if action != "created":
        logger.debug(
            "autofix.pr_iteration.comment_trigger.skipped_action",
            extra={**log_extra, "action": action},
        )
        return None

    issue = event.get("issue", {})
    if not issue.get("pull_request"):
        logger.debug("autofix.pr_iteration.comment_trigger.skipped_not_pr", extra=log_extra)
        return None

    command = sentry_command(comment.get("body"))
    if not isinstance(command, SentryIterateCommand):
        logger.debug("autofix.pr_iteration.comment_trigger.skipped_not_command", extra=log_extra)
        return None

    feedback = command.feedback

    pr_number = issue.get("number")
    # Past this point we have a genuine ``@sentry`` iterate command on a PR, so
    # log at info to make any silent drop debuggable.
    logger.info(
        "autofix.pr_iteration.comment_trigger.received",
        extra={**log_extra, "pr_number": pr_number},
    )

    if not features.has("organizations:autofix-pr-iteration", organization):
        logger.info(
            "autofix.pr_iteration.comment_trigger.feature_disabled",
            extra={**log_extra, "pr_number": pr_number},
        )
        return None

    if integration is None:
        logger.info(
            "autofix.pr_iteration.comment_trigger.no_integration",
            extra={**log_extra, "pr_number": pr_number},
        )
        return None

    if pr_number is None:
        logger.info("autofix.pr_iteration.comment_trigger.no_pr_number", extra=log_extra)
        return None

    if not comment.get("html_url"):
        raise ValueError("GitHub PR comment is missing html_url")

    logger.info(
        "autofix.pr_iteration.comment_trigger.scheduled",
        extra={**log_extra, "pr_number": pr_number},
    )
    trigger_pr_iteration_from_comment.delay(
        organization_id=organization.id,
        repo_id=repo.id,
        integration_id=integration.id,
        pr_number=pr_number,
        feedback=feedback,
        comment=comment,
    )
    return None
