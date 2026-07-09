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
from typing import Any, NamedTuple

from pydantic import ValidationError

from sentry import features
from sentry.integrations.services.integration import RpcIntegration
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.seer.autofix.pr_iteration.types import (
    Feedback,
    GithubPrCommentFeedbackSource,
    GithubPrCommentFeedbackType,
    GithubPrReviewCommentFeedbackSource,
)
from sentry.tasks.seer.pr_iteration import trigger_pr_iteration_from_comment

logger = logging.getLogger(__name__)


class CreatedCommentContext(NamedTuple):
    comment: Mapping[str, Any]
    log_extra: dict[str, Any]


def _created_comment_context(
    *,
    event: Mapping[str, Any],
    organization: Organization,
) -> CreatedCommentContext | None:
    """
    Shared head for the comment processors: pull the comment off the event and
    build ``log_extra``, then filter to ``action == "created"``.
    """
    comment = event.get("comment", {})
    log_extra = {"organization_id": organization.id, "comment_id": comment.get("id")}

    action = event.get("action")
    if action != "created":
        logger.debug(
            "autofix.pr_iteration.comment_trigger.skipped_action",
            extra={**log_extra, "action": action},
        )
        return None

    return CreatedCommentContext(comment=comment, log_extra=log_extra)


def _dispatch_autofix_iteration_from_comment(
    *,
    comment: Mapping[str, Any],
    pr_number: int | None,
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None,
    log_extra: Mapping[str, Any],
    source_type: GithubPrCommentFeedbackType,
) -> None:
    try:
        source: GithubPrCommentFeedbackSource | GithubPrReviewCommentFeedbackSource
        if source_type == "github-pr-review-comment":
            source = GithubPrReviewCommentFeedbackSource(comment=comment)
        else:
            source = GithubPrCommentFeedbackSource(comment=comment)
        feedback = Feedback(source=source)
    except ValidationError:
        logger.debug("autofix.pr_iteration.comment_trigger.skipped_not_command", extra=log_extra)
        return None

    log_extra = {**log_extra, "pr_number": pr_number}
    # Past this point we have a genuine ``@sentry`` iterate command on a PR, so
    # log at info to make any silent drop debuggable.
    logger.info("autofix.pr_iteration.comment_trigger.received", extra=log_extra)

    if not features.has("organizations:autofix-pr-iteration", organization):
        logger.info("autofix.pr_iteration.comment_trigger.feature_disabled", extra=log_extra)
        return None

    if integration is None:
        logger.info("autofix.pr_iteration.comment_trigger.no_integration", extra=log_extra)
        return None

    if pr_number is None:
        logger.info("autofix.pr_iteration.comment_trigger.no_pr_number", extra=log_extra)
        return None

    if not comment.get("html_url"):
        raise ValueError("GitHub PR comment is missing html_url")

    logger.info("autofix.pr_iteration.comment_trigger.scheduled", extra=log_extra)
    trigger_pr_iteration_from_comment.delay(
        organization_id=organization.id,
        repo_id=repo.id,
        integration_id=integration.id,
        pr_number=pr_number,
        feedback=feedback.json(),
    )
    return None


def handle_pull_request_review_comment_for_autofix_iteration(
    *,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """
    Webhook processor for ``pull_request_review_comment`` events that triggers
    an Autofix PR iteration when a user leaves an inline ``@sentry`` comment.
    """
    context = _created_comment_context(event=event, organization=organization)
    # No need to check whether this is a pr vs. issue as this webhook only fires in a pr
    if context is None:
        return None

    pull_request = event.get("pull_request", {})
    _dispatch_autofix_iteration_from_comment(
        comment=context.comment,
        pr_number=pull_request.get("number"),
        organization=organization,
        repo=repo,
        integration=integration,
        log_extra=context.log_extra,
        source_type="github-pr-review-comment",
    )
    return None


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
    context = _created_comment_context(event=event, organization=organization)
    if context is None:
        return None

    # issue_comment fires on every issue too, so guard that this is a PR. Logs at
    # debug (like the action filter) to avoid spamming prod on non-PR comments.
    issue = event.get("issue", {})
    if not issue.get("pull_request"):
        logger.debug("autofix.pr_iteration.comment_trigger.skipped_not_pr", extra=context.log_extra)
        return None

    _dispatch_autofix_iteration_from_comment(
        comment=context.comment,
        pr_number=issue.get("number"),
        organization=organization,
        repo=repo,
        integration=integration,
        log_extra=context.log_extra,
        source_type="github-pr-comment",
    )
    return None
