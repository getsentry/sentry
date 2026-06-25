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

import sentry_sdk
from scm import actions as scm_actions
from scm.types import GetRepositoryUserPermissionProtocol
from taskbroker_client.retry import Retry

from sentry import features
from sentry.integrations.github.client import GitHubReaction
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.scm.factory import new as make_scm
from sentry.seer.agent.client_utils import get_agent_state_from_pr_id
from sentry.seer.autofix.autofix_agent import Feedback
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.feedback_queue import enqueue_autofix_feedback
from sentry.seer.webhooks import SentryIterateCommand, sentry_command
from sentry.tasks.base import instrumented_task
from sentry.tasks.seer.autofix import consume_queued_autofix_feedback
from sentry.taskworker.namespaces import seer_tasks
from sentry.utils import metrics

logger = logging.getLogger(__name__)

ITERATE_COMMAND = "@sentry"
_SEER_GITHUB_PROVIDER = "integrations:github"


def _github_commenter_has_repo_write_access(
    *,
    organization_id: int,
    repo_id: int,
    github_username: str,
) -> bool:
    try:
        scm = make_scm(organization_id, repo_id, referrer="seer")
    except Exception:
        logger.warning(
            "autofix.pr_iteration.comment_trigger.scm_init_failed",
            extra={"organization_id": organization_id, "repo_id": repo_id},
            exc_info=True,
        )
        return False

    if not isinstance(scm, GetRepositoryUserPermissionProtocol):
        logger.warning(
            "autofix.pr_iteration.comment_trigger.unsupported_provider",
            extra={"organization_id": organization_id, "repo_id": repo_id},
        )
        return False

    try:
        result = scm_actions.get_repository_user_permission(scm, github_username)
    except Exception:
        logger.info(
            "autofix.pr_iteration.comment_trigger.permission_check_failed",
            extra={
                "organization_id": organization_id,
                "repo_id": repo_id,
                "github_username": github_username,
            },
            exc_info=True,
        )
        return False

    return result["data"]["perms"] in ("write", "admin")


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


@instrumented_task(
    name="sentry.tasks.autofix.trigger_pr_iteration_from_comment",
    namespace=seer_tasks,
    processing_deadline_duration=65,
    retry=Retry(times=1),
)
def trigger_pr_iteration_from_comment(
    *,
    organization_id: int,
    repo_id: int,
    integration_id: int,
    pr_number: int,
    feedback: str,
    comment: Mapping[str, Any],
) -> None:
    """
    Resolve the Autofix run behind ``pr_number`` and kick off a PR iteration.

    Runs async because it makes external GitHub and Seer calls: it fetches the
    PR to recover its GitHub id, looks up the agent run state keyed on that id,
    and triggers the iteration with the comment as feedback.
    """
    comment_user = comment.get("user", {})
    github_username = comment_user.get("login")
    if not github_username:
        logger.info(
            "autofix.pr_iteration.comment_trigger.no_github_username",
            extra={"organization_id": organization_id},
        )
        return None

    repo = Repository.objects.get(id=repo_id, organization_id=organization_id)

    integration = integration_service.get_integration(integration_id=integration_id)
    if integration is None:
        logger.warning(
            "autofix.pr_iteration.comment_trigger.missing_integration",
            extra={"organization_id": organization_id, "integration_id": integration_id},
        )
        return None

    client = integration.get_installation(organization_id=organization_id).get_client()
    pull_request = client.get_pull_request(repo.name, str(pr_number))
    pr_id = pull_request.get("id")
    if pr_id is None:
        return None

    agent_state = get_agent_state_from_pr_id(organization_id, _SEER_GITHUB_PROVIDER, pr_id)
    if agent_state is None or not agent_state.repo_pr_states:
        metrics.incr("autofix.pr_iteration.comment_trigger.no_run")
        logger.info(
            "autofix.pr_iteration.comment_trigger.no_run",
            extra={"organization_id": organization_id, "pr_id": pr_id},
        )
        return None

    if not _github_commenter_has_repo_write_access(
        organization_id=organization_id,
        repo_id=repo_id,
        github_username=github_username,
    ):
        metrics.incr("autofix.pr_iteration.comment_trigger.unauthorized")
        logger.info(
            "autofix.pr_iteration.comment_trigger.unauthorized",
            extra={
                "organization_id": organization_id,
                "github_username": github_username,
            },
        )
        return None

    group_id = agent_state.metadata.get("group_id") if agent_state.metadata else None
    if group_id is None:
        raise ValueError(f"Missing group id in agent run {agent_state.run_id}")

    feedback_obj = Feedback(
        text=feedback,
        source={"type": "github-pr-comment", "comment": comment},
    )

    enqueue_autofix_feedback(
        run_id=agent_state.run_id,
        organization_id=organization_id,
        group_id=group_id,
        feedback=feedback_obj,
        referrer=AutofixReferrer.GITHUB_PR_COMMENT,
    )
    consume_queued_autofix_feedback.apply_async(
        kwargs={
            "run_id": agent_state.run_id,
            "organization_id": organization_id,
            "group_id": group_id,
        }
    )

    metrics.incr("autofix.pr_iteration.comment_trigger.success")

    comment_id = comment.get("id")
    if comment_id is None:
        return None

    try:
        client.create_comment_reaction(repo.name, str(comment_id), GitHubReaction.EYES)
    except Exception as e:
        sentry_sdk.capture_exception(e)
    return None
