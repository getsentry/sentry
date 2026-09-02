"""Start or stop an Autofix PR iteration from a top-level GitHub PR comment.
``@sentry <feedback>`` starts an iteration on an Autofix pull request.
``@sentry stop iterating`` stops iteration for that Autofix run.
The commenter must have write access to the repository.
Inline review comments arrive through ``listeners/review.py`` instead.
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
from sentry.seer.autofix.pr_iteration.constants import PR_ITERATION_PROVIDER_SLUG
from sentry.seer.autofix.pr_iteration.feedback import Feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubPrCommentFeedbackSource,
)
from sentry.seer.webhooks import SentryStopCommand, sentry_command
from sentry.tasks.seer.pr_iteration import (
    pause_pr_iteration_from_comment,
    trigger_pr_iteration_from_comment,
)

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


class CommentDispatchTarget(NamedTuple):
    integration: RpcIntegration
    pr_number: int


def _resolve_comment_dispatch(
    *,
    comment: Mapping[str, Any],
    pr_number: int | None,
    organization: Organization,
    integration: RpcIntegration | None,
    log_extra: Mapping[str, Any],
    command: str,
) -> CommentDispatchTarget | None:
    """Run the gates that every ``@sentry`` command on a pull request shares.

    These logs are shared, so each caller names itself with a ``command`` tag
    rather than a message of its own.
    """
    log_extra = {**log_extra, "command": command}

    if not features.has("organizations:autofix-pr-iteration-manual", organization):
        logger.info("autofix.pr_iteration.comment_trigger.feature_disabled", extra=log_extra)
        return None

    if integration is None:
        logger.info("autofix.pr_iteration.comment_trigger.no_integration", extra=log_extra)
        return None

    # GitHub Enterprise inherits this processor (see
    # ``GitHubEnterpriseIssueCommentEventWebhook``) and sends the same
    # ``issue_comment`` events, so it is turned away here rather than a task hop
    # later. See ``PR_ITERATION_PROVIDER``.
    if integration.provider != PR_ITERATION_PROVIDER_SLUG:
        logger.info(
            "autofix.pr_iteration.comment_trigger.unsupported_provider",
            extra={**log_extra, "provider": integration.provider},
        )
        return None

    if pr_number is None:
        logger.info("autofix.pr_iteration.comment_trigger.no_pr_number", extra=log_extra)
        return None

    if not comment.get("html_url"):
        raise ValueError("GitHub PR comment is missing html_url")

    return CommentDispatchTarget(integration=integration, pr_number=pr_number)


def _dispatch_autofix_iteration_from_comment(
    *,
    comment: Mapping[str, Any],
    pr_number: int | None,
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None,
    log_extra: Mapping[str, Any],
) -> None:
    try:
        feedback = Feedback(
            source=GithubPrCommentFeedbackSource(comment=comment, repo_name=repo.name)
        )
    except ValidationError:
        logger.debug("autofix.pr_iteration.comment_trigger.skipped_not_command", extra=log_extra)
        return None

    log_extra = {**log_extra, "pr_number": pr_number}
    # From here the comment is a real ``@sentry`` iterate command on a pull request.
    logger.info("autofix.pr_iteration.comment_trigger.received", extra=log_extra)

    target = _resolve_comment_dispatch(
        comment=comment,
        pr_number=pr_number,
        organization=organization,
        integration=integration,
        log_extra=log_extra,
        command="iterate",
    )
    if target is None:
        return None

    logger.info("autofix.pr_iteration.comment_trigger.scheduled", extra=log_extra)
    trigger_pr_iteration_from_comment.delay(
        organization_id=organization.id,
        repo_id=repo.id,
        integration_id=target.integration.id,
        pr_number=target.pr_number,
        feedback=feedback.json(),
    )
    return None


def _dispatch_pause_from_comment(
    *,
    comment: Mapping[str, Any],
    pr_number: int | None,
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None,
    log_extra: Mapping[str, Any],
) -> None:
    log_extra = {**log_extra, "pr_number": pr_number}
    logger.info("autofix.pr_iteration.stop_command.received", extra=log_extra)

    target = _resolve_comment_dispatch(
        comment=comment,
        pr_number=pr_number,
        organization=organization,
        integration=integration,
        log_extra=log_extra,
        command="stop",
    )
    if target is None:
        return None

    github_username = (comment.get("user") or {}).get("login")
    if not github_username:
        logger.info("autofix.pr_iteration.stop_command.no_github_username", extra=log_extra)
        return None

    logger.info("autofix.pr_iteration.stop_command.scheduled", extra=log_extra)
    pause_pr_iteration_from_comment.delay(
        organization_id=organization.id,
        repo_id=repo.id,
        integration_id=target.integration.id,
        pr_number=target.pr_number,
        comment_id=comment.get("id"),
        github_username=github_username,
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
    Webhook processor for ``issue_comment`` events that starts or stops an
    Autofix PR iteration when a user comments ``@sentry``.
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

    if isinstance(sentry_command(context.comment.get("body")), SentryStopCommand):
        _dispatch_pause_from_comment(
            comment=context.comment,
            pr_number=issue.get("number"),
            organization=organization,
            repo=repo,
            integration=integration,
            log_extra=context.log_extra,
        )
        return None

    _dispatch_autofix_iteration_from_comment(
        comment=context.comment,
        pr_number=issue.get("number"),
        organization=organization,
        repo=repo,
        integration=integration,
        log_extra=context.log_extra,
    )
    return None
