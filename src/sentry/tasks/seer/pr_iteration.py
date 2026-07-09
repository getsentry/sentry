from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import sentry_sdk
from scm import actions as scm_actions
from scm.types import GetRepositoryUserPermissionProtocol
from taskbroker_client.retry import Retry

from sentry.integrations.github.client import GitHubReaction
from sentry.integrations.services.integration import integration_service
from sentry.locks import locks
from sentry.models.group import Group
from sentry.models.repository import Repository
from sentry.scm.factory import new as make_scm
from sentry.seer.agent.client_utils import get_agent_state_from_pr_id
from sentry.seer.autofix.autofix_agent import (
    AutofixStep,
    PrIterationNoPullRequestException,
    PrIterationNotEnabledException,
    get_autofix_run_state,
    trigger_autofix_agent,
)
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.feedback_queue import (
    QueuedAutofixFeedback,
    enqueue_autofix_feedback,
    pop_queued_autofix_feedback,
)
from sentry.seer.autofix.pr_iteration.types import Feedback, GithubPrCommentFeedbackSource
from sentry.seer.models import SeerPermissionError
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger(__name__)

_SEER_GITHUB_PROVIDER = "integrations:github"


def _get_feedback_referrer(items: list[QueuedAutofixFeedback]) -> AutofixReferrer:
    referrers = {item.referrer for item in items}
    if len(referrers) == 1:
        return referrers.pop()
    return AutofixReferrer.UNKNOWN


@instrumented_task(
    name="sentry.tasks.autofix.consume_queued_feedback",
    namespace=seer_tasks,
    processing_deadline_duration=60,
    retry=Retry(on=(UnableToAcquireLock,), times=3, delay=5),
)
def consume_queued_autofix_feedback(run_id: int, organization_id: int, group_id: int) -> None:
    lock = locks.get(
        f"autofix:feedback:lock:{run_id}",
        duration=60,
        name="autofix_feedback",
    )

    with lock.acquire():
        group = Group.objects.filter(
            id=group_id,
            project__organization_id=organization_id,
        ).first()
        if group is None:
            logger.warning(
                "autofix.pr_iteration.consume_feedback.group_not_found",
                extra={"run_id": run_id, "group_id": group_id},
            )
            return

        try:
            state = get_autofix_run_state(group, run_id)
        except SeerPermissionError:
            logger.warning(
                "autofix.pr_iteration.consume_feedback.run_state_not_found",
                extra={"run_id": run_id, "group_id": group_id},
            )
            return

        if state.status == "processing":
            return

        queued_items = pop_queued_autofix_feedback(run_id)
        if not queued_items:
            return

        feedback_items = []
        seen_comment_ids: set[int] = set()
        for item in queued_items:
            if not item.feedback.is_valid_for_run_state(state):
                logger.info(
                    "autofix.pr_iteration.consume_feedback.stale_feedback",
                    extra={
                        "organization_id": organization_id,
                        "group_id": group_id,
                        "run_id": run_id,
                    },
                )

                continue

            source = item.feedback.source
            if isinstance(source, GithubPrCommentFeedbackSource):
                comment_id = source.comment.get("id")
                if comment_id is not None:
                    if comment_id in seen_comment_ids:
                        continue
                    seen_comment_ids.add(comment_id)

            feedback_items.append(item.feedback)

        if not feedback_items:
            logger.info(
                "autofix.pr_iteration.consume_feedback.no_consumable_feedback",
                extra={"run_id": run_id, "group_id": group_id},
            )
            return

        try:
            trigger_autofix_agent(
                group=group,
                step=AutofixStep.PR_ITERATION,
                referrer=_get_feedback_referrer(queued_items),
                run_id=run_id,
                user_context="\n\n".join(item.text for item in feedback_items),
                feedback=feedback_items,
            )
        except (
            PrIterationNoPullRequestException,
            PrIterationNotEnabledException,
            SeerPermissionError,
        ) as error:
            logger.info(
                "autofix.pr_iteration.consume_feedback.skipped",
                extra={"run_id": run_id, "group_id": group.id, "error": str(error)},
            )


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

    repo = Repository.objects.filter(id=repo_id, organization_id=organization_id).first()
    if repo is None:
        logger.info(
            "autofix.pr_iteration.comment_trigger.missing_repo",
            extra={"organization_id": organization_id, "repo_id": repo_id},
        )
        return None

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

    logger.info(
        "autofix.pr_iteration.comment_trigger.success",
        extra={
            "organization_id": organization_id,
            "repo_id": repo_id,
        },
    )

    return None
