"""
Trigger an Autofix PR iteration from a GitHub PR comment mention.

When a Sentry user comments ``@sentry iterate <feedback>`` on a pull request
that Autofix created, we kick off a ``PR_ITERATION`` run that revises the
existing PR using the comment as feedback. The commenter must be a verified
member of the organization that owns the integration so that random GitHub
users can't drive Autofix runs (which cost quota and rewrite the PR).
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import sentry_sdk
from taskbroker_client.retry import Retry

from sentry import features, options
from sentry.identity.services.identity import identity_service
from sentry.integrations.github.client import GitHubReaction
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.organizations.services.organization import organization_service
from sentry.seer.agent.client_utils import get_agent_state_from_pr_id
from sentry.seer.autofix.autofix_agent import (
    AutofixStep,
    NoSeerQuotaException,
    trigger_autofix_agent,
)
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.code_review.webhooks.issue_comment import SENTRY_REVIEW_COMMAND
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.utils import metrics

logger = logging.getLogger(__name__)

ITERATE_COMMAND = "@sentry"
_SEER_GITHUB_PROVIDER = "integrations:github"


def parse_iterate_command(comment_body: str | None) -> str | None:
    """
    Return the feedback that follows ``@sentry``, or ``None`` if the
    comment isn't an iterate command.

    We have to make sure that we don't process ``@sentry review``, as
    it is a trigger for code review.
    """
    if not comment_body:
        return None

    lowered = comment_body.lower()

    # Skip @sentry review comments as it is handled in other webhook handlers
    code_review_found = lowered.find(SENTRY_REVIEW_COMMAND)
    if code_review_found != -1:
        return None

    index = lowered.find(ITERATE_COMMAND)
    if index == -1:
        return None

    return comment_body[index + len(ITERATE_COMMAND) :].strip()


def _commenter_is_org_member(
    *,
    organization: Organization,
    github_user_id: int | str,
    provider_type: str,
) -> bool:
    """
    Resolve the GitHub commenter to a Sentry user via their linked identity and
    confirm they're a member of ``organization``.
    """
    identity = identity_service.get_identity(
        filter={
            "identity_ext_id": str(github_user_id),
            "provider_type": provider_type,
            "provider_ext_id": options.get("github-app.id"),
        }
    )
    if identity is None:
        return False

    member = organization_service.check_membership_by_id(
        organization_id=organization.id, user_id=identity.user_id
    )
    return member is not None


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
    iteration when a verified org member comments ``@sentry iterate``.
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

    feedback = parse_iterate_command(comment.get("body"))
    if feedback is None:
        logger.debug("autofix.pr_iteration.comment_trigger.skipped_not_command", extra=log_extra)
        return None

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

    github_user_id = comment.get("user", {}).get("id")
    if github_user_id is None:
        logger.info(
            "autofix.pr_iteration.comment_trigger.no_user_id",
            extra={**log_extra, "pr_number": pr_number},
        )
        return None

    if not _commenter_is_org_member(
        organization=organization,
        github_user_id=github_user_id,
        provider_type=integration.provider,
    ):
        metrics.incr("autofix.pr_iteration.comment_trigger.unauthorized")
        logger.info(
            "autofix.pr_iteration.comment_trigger.unauthorized",
            extra={**log_extra, "github_user_id": github_user_id, "pr_number": pr_number},
        )
        # TODO: Add some kind of notification "Link your GH account with your Sentry account"
        return None

    if pr_number is None:
        logger.info("autofix.pr_iteration.comment_trigger.no_pr_number", extra=log_extra)
        return None

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
        comment_id=comment_id,
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
    comment_id: int | None,
) -> None:
    """
    Resolve the Autofix run behind ``pr_number`` and kick off a PR iteration.

    Runs async because it makes external GitHub and Seer calls: it fetches the
    PR to recover its GitHub id, looks up the agent run state keyed on that id,
    and triggers the iteration with the comment as feedback.
    """
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

    group_id = agent_state.metadata.get("group_id") if agent_state.metadata else None
    if group_id is None:
        raise ValueError(f"Missing group id in agent run {agent_state.run_id}")

    group = Group.objects.get(id=group_id, project__organization_id=organization_id)

    try:
        trigger_autofix_agent(
            group,
            AutofixStep.PR_ITERATION,
            referrer=AutofixReferrer.GITHUB_PR_COMMENT,
            run_id=agent_state.run_id,
            user_context=feedback,
        )
    except NoSeerQuotaException:
        logger.info(
            "autofix.pr_iteration.comment_trigger.no_quota",
            extra={"organization_id": organization_id, "run_id": agent_state.run_id},
        )
        return None

    metrics.incr("autofix.pr_iteration.comment_trigger.success")

    if comment_id is None:
        return None

    try:
        client.create_comment_reaction(repo.name, str(comment_id), GitHubReaction.EYES)
    except Exception as e:
        sentry_sdk.capture_exception(e)
    return None
