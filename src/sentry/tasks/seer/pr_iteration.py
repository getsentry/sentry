from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

import sentry_sdk
from scm import actions as scm_actions
from scm.manager import SourceCodeManager
from scm.types import (
    CreatePullRequestCommentReactionProtocol,
    CreateReviewCommentReactionProtocol,
    GetRepositoryUserPermissionProtocol,
    Reaction,
)
from taskbroker_client.retry import Retry

from sentry.cache import default_cache
from sentry.integrations.services.integration import integration_service
from sentry.locks import locks
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.scm.factory import new as make_scm
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.agent.client_utils import fetch_run_status, get_agent_state_from_pr_id
from sentry.seer.autofix.autofix_agent import (
    AutofixStep,
    PrIterationNoPullRequestException,
    PrIterationNotEnabledException,
    trigger_autofix_agent,
)
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.feedback import Feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.base import ConsumeTask
from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import CheckSuiteFeedbackSource
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubPrCommentFeedbackSource,
    GithubPrCommentFeedbackType,
    GithubPrReviewCommentFeedbackSource,
)
from sentry.seer.autofix.pr_iteration.queue import (
    QueuedAutofixFeedback,
    pop_queued_autofix_feedback,
    try_enqueue_autofix_feedback,
)
from sentry.seer.models import SeerApiError, SeerPermissionError
from sentry.shared_integrations.exceptions import ApiError
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger(__name__)

# Posted when someone ``@sentry``-iterates a PR that Seer associates with a run
# that has no Autofix-created ``repo_pr_states`` — mainly coding-agent-handoff
# PRs. We intentionally do *not* post this when Seer returns no run at all:
# GitHub webhooks fan out to every region, so a missing run often just means
# this region is not the one that owns the Autofix session.
INELIGIBLE_PR_ITERATION_COMMENT = (
    "PR iteration only works on pull requests created by Seer's Autofix agent. "
    "PRs that the Autofix Agent didn't create aren't eligible. This includes PRs "
    "created by the Coding Agent handoff and unrelated human PRs."
)

# One explanatory comment per PR; further pings still get a :confused: reaction.
_INELIGIBLE_COMMENT_CACHE_TTL = int(timedelta(days=7).total_seconds())


def _ineligible_comment_cache_key(*, organization_id: int, repo_id: int, pr_number: int) -> str:
    return f"autofix:pr_iteration:ineligible_comment:{organization_id}:{repo_id}:{pr_number}"


def _ineligible_pr_iteration_comment_body(github_username: str) -> str:
    return f"@{github_username}\n\n{INELIGIBLE_PR_ITERATION_COMMENT}"


def _get_feedback_referrer(items: list[QueuedAutofixFeedback]) -> AutofixReferrer:
    referrers = {item.referrer for item in items}
    if len(referrers) == 1:
        return referrers.pop()
    return AutofixReferrer.UNKNOWN


def trigger_consume_pr_iteration_feedback(
    *,
    run_id: int,
    organization_id: int,
    feedback: Feedback,
    run_state: SeerRunState,
    bypass: bool = False,
    delay: int | None = None,
) -> None:
    if bypass:
        task: ConsumeTask | None = ConsumeTask.Now
    else:
        task = feedback.source.should_trigger(run_state)

    if task is None:
        return

    countdown = delay if delay is not None else task.countdown()
    consume_queued_autofix_feedback.apply_async(
        kwargs={
            "run_id": run_id,
            "organization_id": organization_id,
        },
        countdown=countdown,
    )


@instrumented_task(
    name="sentry.tasks.autofix.consume_queued_feedback",
    namespace=seer_tasks,
    processing_deadline_duration=60,
    retry=Retry(on=(UnableToAcquireLock,), times=3, delay=5),
)
def consume_queued_autofix_feedback(
    run_id: int, organization_id: int, *args: Any, **kwargs: Any
) -> None:
    # Accept unused *args/**kwargs so in-flight activations queued with retired
    # kwargs (e.g. group_id) still deserialize after the signature change.
    lock = locks.get(
        f"autofix:feedback:lock:{run_id}",
        duration=60,
        name="autofix_feedback",
    )

    with lock.acquire():
        try:
            organization = Organization.objects.get_from_cache(id=organization_id)
        except Organization.DoesNotExist:
            logger.warning(
                "autofix.pr_iteration.consume_feedback.organization_not_found",
                extra={"run_id": run_id, "organization_id": organization_id},
            )
            return

        try:
            state = fetch_run_status(run_id, organization)
        except (SeerApiError, ValueError):
            logger.warning(
                "autofix.pr_iteration.consume_feedback.run_state_not_found",
                extra={"run_id": run_id, "organization_id": organization_id},
            )
            return

        group_id = state.metadata.get("group_id") if state.metadata else None
        group = (
            Group.objects.filter(id=group_id, project__organization_id=organization_id).first()
            if group_id
            else None
        )
        if group is None:
            logger.warning(
                "autofix.pr_iteration.consume_feedback.group_not_found",
                extra={"run_id": run_id, "group_id": group_id},
            )
            return

        if state.status == "processing":
            return

        queued_items = pop_queued_autofix_feedback(run_id)
        if not queued_items:
            return

        feedback_items = []
        # Keyed by (source class, comment id): issue-comment and review-comment
        # ids come from separate GitHub namespaces, so dedupe within each type.
        seen_comment_keys: set[tuple[type, int]] = set()
        seen_check_suite_ids: set[int] = set()
        for item in queued_items:
            if not item.feedback.source.should_consume(state):
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
            if isinstance(
                source, (GithubPrCommentFeedbackSource, GithubPrReviewCommentFeedbackSource)
            ):
                comment_id = source.comment.id
                if comment_id is not None:
                    key = (type(source), comment_id)
                    if key in seen_comment_keys:
                        continue
                    seen_comment_keys.add(key)
            elif isinstance(source, CheckSuiteFeedbackSource):
                suite_id = source.event.check_suite.id
                if suite_id in seen_check_suite_ids:
                    continue
                seen_check_suite_ids.add(suite_id)

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
    scm: SourceCodeManager,
    github_username: str,
) -> bool:
    if not isinstance(scm, GetRepositoryUserPermissionProtocol):
        logger.warning("autofix.pr_iteration.comment_trigger.unsupported_provider")
        return False

    try:
        result = scm_actions.get_repository_user_permission(scm, github_username)
    except Exception:
        logger.info(
            "autofix.pr_iteration.comment_trigger.permission_check_failed",
            extra={"github_username": github_username},
            exc_info=True,
        )
        return False

    return result["data"]["perms"] in ("write", "admin")


def _add_comment_reaction(
    scm: SourceCodeManager,
    *,
    source_type: GithubPrCommentFeedbackType,
    pr_number: int,
    comment_id: int,
    reaction: Reaction,
) -> None:
    """React to a PR comment via the SCM platform."""
    try:
        if source_type == "github-pr-review-comment":
            if not isinstance(scm, CreateReviewCommentReactionProtocol):
                logger.warning("autofix.pr_iteration.comment_trigger.unsupported_provider")
                return
            scm_actions.create_review_comment_reaction(
                scm, str(pr_number), str(comment_id), reaction
            )
        else:
            if not isinstance(scm, CreatePullRequestCommentReactionProtocol):
                logger.warning("autofix.pr_iteration.comment_trigger.unsupported_provider")
                return
            scm_actions.create_pull_request_comment_reaction(
                scm, str(pr_number), str(comment_id), reaction
            )
    except Exception as e:
        sentry_sdk.capture_exception(e)


def _comment_pr_iteration_ineligible(
    client: Any,
    *,
    organization_id: int,
    repo_id: int,
    repo_name: str,
    pr_number: int,
    github_username: str,
    source_type: GithubPrCommentFeedbackType,
    comment_id: int | None,
) -> None:
    """React :confused: and, at most once per PR, explain why iteration didn't run."""
    log_extra = {
        "organization_id": organization_id,
        "repo_id": repo_id,
        "pr_number": pr_number,
    }

    try:
        scm = make_scm(organization_id, repo_id, referrer="seer")
    except Exception:
        logger.warning(
            "autofix.pr_iteration.comment_trigger.ineligible_scm_init_failed",
            extra=log_extra,
            exc_info=True,
        )
        scm = None

    if scm is not None and comment_id is not None:
        _add_comment_reaction(
            scm,
            source_type=source_type,
            pr_number=pr_number,
            comment_id=comment_id,
            reaction="confused",
        )

    cache_key = _ineligible_comment_cache_key(
        organization_id=organization_id, repo_id=repo_id, pr_number=pr_number
    )
    lock = locks.get(
        f"autofix:pr_iteration:ineligible_comment:lock:{organization_id}:{repo_id}:{pr_number}",
        duration=30,
        name="autofix_pr_iteration_ineligible_comment",
    )
    try:
        with lock.acquire():
            if default_cache.get(cache_key) is not None:
                return

            try:
                client.create_comment(
                    repo_name,
                    str(pr_number),
                    {"body": _ineligible_pr_iteration_comment_body(github_username)},
                )
            except Exception:
                logger.warning(
                    "autofix.pr_iteration.comment_trigger.ineligible_comment_failed",
                    extra=log_extra,
                    exc_info=True,
                )
                return

            default_cache.set(cache_key, True, timeout=_INELIGIBLE_COMMENT_CACHE_TTL)
    except UnableToAcquireLock:
        pass


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
) -> None:
    """
    Resolve the Autofix run behind ``pr_number`` and kick off a PR iteration.

    Runs async because it makes external GitHub and Seer calls: it fetches the
    PR to recover its GitHub id, looks up the agent run state keyed on that id,
    and triggers the iteration with the comment as feedback.

    ``feedback`` is a serialized :class:`Feedback` built at mention time; the raw
    comment is read back off ``source.comment`` for the username and reaction.
    """
    feedback_obj = Feedback.parse_raw(feedback)
    source = feedback_obj.source
    if not isinstance(source, (GithubPrCommentFeedbackSource, GithubPrReviewCommentFeedbackSource)):
        logger.error(
            "autofix.pr_iteration.comment_trigger.unexpected_source",
            extra={"organization_id": organization_id, "source_type": source.type},
        )
        return None

    comment = source.comment
    github_username = comment.user.login if comment.user else None
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
    if repo.provider is None:
        logger.warning(
            "autofix.pr_iteration.comment_trigger.no_provider",
            extra={"organization_id": organization_id, "repo_id": repo.id},
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
    try:
        # Async task: the PR may be deleted, made private, or GitHub may return a
        # transient error between webhook receipt and execution.
        pull_request = client.get_pull_request(repo.name, str(pr_number))
    except ApiError:
        logger.warning(
            "autofix.pr_iteration.comment_trigger.get_pull_request_failed",
            extra={"organization_id": organization_id, "pr_number": pr_number},
            exc_info=True,
        )
        return None
    pr_id = pull_request.get("id")
    if pr_id is None:
        return None

    agent_state = get_agent_state_from_pr_id(organization_id, repo.provider, pr_id)
    if agent_state is None:
        # No-op: missing runs are expected on regions that don't own the session
        # when webhooks are fanned out everywhere. Do not react/comment as
        # ineligible — that would false-positive against the region that does
        # own the Autofix run and is iterating successfully.
        metrics.incr("autofix.pr_iteration.comment_trigger.no_run")
        logger.info(
            "autofix.pr_iteration.comment_trigger.no_run",
            extra={"organization_id": organization_id, "pr_id": pr_id},
        )
        return None

    if not agent_state.repo_pr_states:
        # Found a Seer run for this PR, but it wasn't created by Autofix
        # (coding-agent handoff is the main case). Explain ineligibility.
        metrics.incr("autofix.pr_iteration.comment_trigger.ineligible_run")
        logger.info(
            "autofix.pr_iteration.comment_trigger.ineligible_run",
            extra={
                "organization_id": organization_id,
                "pr_id": pr_id,
                "run_id": agent_state.run_id,
            },
        )
        _comment_pr_iteration_ineligible(
            client,
            organization_id=organization_id,
            repo_id=repo.id,
            repo_name=repo.name,
            pr_number=pr_number,
            github_username=github_username,
            source_type=source.type,
            comment_id=comment.id,
        )
        return None

    try:
        scm = make_scm(organization_id, repo_id, referrer="seer")
    except Exception:
        logger.warning(
            "autofix.pr_iteration.comment_trigger.scm_init_failed",
            extra={"organization_id": organization_id, "repo_id": repo_id},
            exc_info=True,
        )
        return None

    if not _github_commenter_has_repo_write_access(scm, github_username):
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

    try_enqueue_autofix_feedback(
        run_id=agent_state.run_id,
        organization_id=organization_id,
        group_id=group_id,
        feedback=feedback_obj,
        referrer=AutofixReferrer.GITHUB_PR_COMMENT,
        run_state=agent_state,
    )
    trigger_consume_pr_iteration_feedback(
        run_id=agent_state.run_id,
        organization_id=organization_id,
        feedback=feedback_obj,
        run_state=agent_state,
    )

    metrics.incr("autofix.pr_iteration.comment_trigger.success")

    comment_id = comment.id
    if comment_id is None:
        return None

    _add_comment_reaction(
        scm,
        source_type=source.type,
        pr_number=pr_number,
        comment_id=comment_id,
        reaction="eyes",
    )

    logger.info(
        "autofix.pr_iteration.comment_trigger.success",
        extra={
            "organization_id": organization_id,
            "repo_id": repo_id,
        },
    )

    return None
