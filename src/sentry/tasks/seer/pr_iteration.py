from __future__ import annotations

import logging
from collections.abc import Collection
from dataclasses import dataclass
from datetime import timedelta
from enum import StrEnum
from typing import Any, NamedTuple
from uuid import uuid4

import sentry_sdk
from scm import actions as scm_actions
from scm.errors import ResourceNotFound, SCMError
from scm.helpers import iter_all_pages
from scm.manager import SourceCodeManager
from scm.types import (
    Author,
    CreatePullRequestCommentProtocol,
    CreatePullRequestCommentReactionProtocol,
    CreateReviewCommentReactionProtocol,
    DeletePullRequestCommentReactionProtocol,
    DeleteReviewCommentReactionProtocol,
    DiffLine,
    GetAuthenticatedActorProtocol,
    GetPullRequestCommentReactionsProtocol,
    GetPullRequestProtocol,
    GetPullRequestReviewProtocol,
    GetPullRequestReviewThreadsProtocol,
    GetRepositoryUserPermissionProtocol,
    GetReviewCommentReactionsProtocol,
    GetReviewCommentsProtocol,
    PaginationParams,
    Reaction,
    ReactionResult,
    ResolveReviewThreadProtocol,
    ResourceId,
    Review,
    ReviewComment,
    ReviewThread,
)
from taskbroker_client.retry import Retry
from taskbroker_client.state import current_task

from sentry import options
from sentry.cache import default_cache
from sentry.integrations.utils.scm_actors import find_user_for_scm_actor
from sentry.locks import locks
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequest
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
from sentry.seer.autofix.commit_author import commit_author_for_feedback
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.constants import PR_ITERATION_PROVIDER
from sentry.seer.autofix.pr_iteration.feedback import Feedback, automated_iteration_cap_reached
from sentry.seer.autofix.pr_iteration.feedback_sources.base import (
    ConsumeTask,
    ConsumeTriggerSource,
    TriggerDecision,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import CheckSuiteFeedbackSource
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubPrCommentFeedbackSource,
    GithubPrCommentFeedbackType,
    GithubPrCommentUser,
    GithubPrReviewBodyFeedbackSource,
    GithubPrReviewCommentFeedbackSource,
    GithubPullRequestReviewComment,
)
from sentry.seer.autofix.pr_iteration.logs import PrIterationLogContext
from sentry.seer.autofix.pr_iteration.missing_permissions import (
    block_iteration_for_missing_permissions,
    post_missing_permissions_comment,
)
from sentry.seer.autofix.pr_iteration.pause import (
    is_pr_iteration_paused,
    pause_pr_iteration,
    record_pause_blocked,
)
from sentry.seer.autofix.pr_iteration.queue import (
    QueuedAutofixFeedback,
    clear_queued_autofix_feedback,
    count_queued_autofix_feedback,
    pop_queued_autofix_feedback,
    try_enqueue_autofix_feedback,
)
from sentry.seer.models import SeerApiError, SeerPermissionError
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.users.services.user.model import RpcUser
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

STOPPED_PR_ITERATION_COMMENT = "Seer stopped iterating on this Autofix run."

STOP_PR_ITERATION_FAILED_COMMENT = (
    "Seer could not stop iteration on this Autofix run. Close this pull request to stop the work."
)

# Answers a repeat `@sentry stop iterating`. Feedback that lands on a stopped run
# gets no reply at all — the stop asked Seer to go quiet, not to keep talking.
ALREADY_PAUSED_PR_ITERATION_COMMENT = "Iteration was already paused."

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


def _get_feedback_actor_user_id(items: list[QueuedAutofixFeedback]) -> int | None:
    actor_user_ids = {item.actor_user_id for item in items}
    if len(actor_user_ids) == 1:
        return actor_user_ids.pop()
    return None


def _organization_for_gate(run_id: int, organization_id: int) -> Organization | None:
    try:
        return Organization.objects.get_from_cache(id=organization_id)
    except Organization.DoesNotExist:
        logger.warning(
            "autofix.pr_iteration.trigger_consume.organization_not_found",
            extra={"run_id": run_id, "organization_id": organization_id},
        )
        return None


def trigger_consume_pr_iteration_feedback(
    *,
    log_ctx: PrIterationLogContext,
    run_id: int,
    organization_id: int,
    feedback: Feedback,
    run_state: SeerRunState,
    bypass: bool = False,
    delay: int | None = None,
    triggered_by: str = "feedback",
) -> None:
    if is_pr_iteration_paused(run_id=run_id, organization_id=organization_id):
        record_pause_blocked("trigger_consume")
        log_ctx.info(
            "autofix.pr_iteration.feedback.trigger",
            triggered_by=triggered_by,
            outcome="not_triggered",
            reason="paused",
            countdown=None,
            trigger_id=None,
            bypass=bypass,
            delay=delay,
            feedback_source=feedback.source.type,
            feedback_id=feedback.feedback_id,
            **feedback.source.log_fields(run_state),
        )
        return

    # Gate ahead of should_trigger: that can defer an hour behind an incomplete
    # check-run sweep, and the "accept these permissions" comment has to reach
    # the user while they are still looking at the failing PR. Blocking here
    # also leaves the feedback in the queue, so the API can see there is CI we
    # would have acted on and the work resumes once the permissions land.
    organization = _organization_for_gate(run_id, organization_id)
    if organization is not None and block_iteration_for_missing_permissions(
        organization=organization, run_id=run_id, state=run_state, log_ctx=log_ctx
    ):
        log_ctx.info(
            "autofix.pr_iteration.feedback.trigger",
            triggered_by=triggered_by,
            outcome="not_triggered",
            reason="missing_github_permissions",
            countdown=None,
            trigger_id=None,
            bypass=bypass,
            delay=delay,
            feedback_source=feedback.source.type,
            feedback_id=feedback.feedback_id,
            **feedback.source.log_fields(run_state),
        )
        return

    if bypass:
        decision = TriggerDecision(task=ConsumeTask.Now, reason="bypass")
        trigger_source = ConsumeTriggerSource.GREEN_CHECK_SUITE_DEFER
    else:
        decision = feedback.source.should_trigger(run_state)
        trigger_source = (
            ConsumeTriggerSource.TIME_LIMIT_DEFER
            if isinstance(decision.task, ConsumeTask.Later)
            else ConsumeTriggerSource.FEEDBACK
        )

    countdown = None
    trigger_id = None

    if decision.task is not None:
        countdown = delay if delay is not None else decision.task.countdown()
        trigger_id = uuid4().hex
        consume_queued_autofix_feedback.apply_async(
            kwargs={
                "run_id": run_id,
                "organization_id": organization_id,
                "trigger_id": trigger_id,
                "trigger_source": trigger_source,
            },
            countdown=countdown,
        )

    if decision.task is None:
        outcome = "not_triggered"
    elif countdown:
        outcome = "delayed"
    else:
        outcome = "triggered"

    log_ctx.info(
        "autofix.pr_iteration.feedback.trigger",
        triggered_by=triggered_by,
        outcome=outcome,
        reason=decision.reason,
        countdown=countdown,
        trigger_id=trigger_id,
        trigger_source=trigger_source,
        bypass=bypass,
        delay=delay,
        feedback_source=feedback.source.type,
        feedback_id=feedback.feedback_id,
        **feedback.source.log_fields(run_state),
    )


def _dropped_feedback(feedback: Feedback, reason: str) -> dict[str, Any]:
    """Name one dropped item, and why. ``feedback_id`` already carries its type."""
    return {"id": feedback.feedback_id, "reason": reason}


@instrumented_task(
    name="sentry.tasks.autofix.comment_on_missing_permissions",
    namespace=seer_tasks,
    processing_deadline_duration=60,
    retry=Retry(on=(UnableToAcquireLock,), times=3, delay=5),
)
def comment_on_missing_permissions(
    run_id: int,
    organization_id: int,
    repo_name: str,
    pr_number: int,
    pr_id: int | None,
    integration_id: int,
    *args: Any,
    **kwargs: Any,
) -> None:
    """Tell the user which GitHub permissions Seer needs on one blocked PR.

    Split out of the gate in ``trigger_consume_pr_iteration_feedback`` so the
    GitHub call never runs inside a webhook task's deadline or the synchronous
    autofix endpoint. Retries on ``UnableToAcquireLock`` instead of waiting on
    the lock, so a losing activation requeues rather than parking a worker.
    """
    organization = _organization_for_gate(run_id, organization_id)
    if organization is None:
        return

    # TODO: avoid this round trip. The state is fetched only so the comment logs
    # carry the same run identity as the rest of the flow; the gate already has
    # it and could hand the identity over in the task args instead.
    try:
        state = fetch_run_status(run_id, organization)
    except (SeerApiError, ValueError):
        logger.warning(
            "autofix.pr_iteration.missing_permissions.run_state_not_found",
            extra={"run_id": run_id, "organization_id": organization_id},
        )
        return

    group_id = state.metadata.get("group_id") if state.metadata else None
    post_missing_permissions_comment(
        organization=organization,
        run_id=run_id,
        repo_name=repo_name,
        pr_number=pr_number,
        pr_id=pr_id,
        integration_id=integration_id,
        log_ctx=PrIterationLogContext.for_run(logger, state, organization_id, group_id),
    )


@instrumented_task(
    name="sentry.tasks.autofix.consume_queued_feedback",
    namespace=seer_tasks,
    processing_deadline_duration=60,
    retry=Retry(on=(UnableToAcquireLock,), times=3, delay=5),
)
def consume_queued_autofix_feedback(
    run_id: int,
    organization_id: int,
    trigger_id: str | None = None,
    trigger_source: str | None = None,
    *args: Any,
    **kwargs: Any,
) -> None:
    """Drain the run's feedback queue into an iteration.

    Deliberately does **not** re-check the org's GitHub App permissions. That
    gate lives at queue time in ``trigger_consume_pr_iteration_feedback``, which
    refuses to schedule this task at all when a permission is missing — and it
    has to live there, so the "accept these permissions" comment reaches the
    user immediately rather than an hour later behind a deferred consume.

    So there is **no defence in depth here**: an activation scheduled before the
    permissions lapsed will run a doomed iteration, whose tool calls fail
    against GitHub. Re-checking would mean a ``peek`` plus a ``should_consume``
    per queued item just to decide whether to check, and ``should_consume``
    walks every iteration's blocks — too expensive to pay on every consume for
    a narrow race.
    """
    # Accept unused *args/**kwargs so in-flight activations queued with retired
    # kwargs (e.g. group_id) still deserialize after the signature change.
    # ``trigger_id`` / ``trigger_source`` are optional: activations queued
    # before they existed arrive without them.
    lock = locks.get(
        f"autofix:feedback:lock:{run_id}",
        duration=60,
        name="autofix_feedback",
    )

    with lock.acquire():
        # A task with a countdown can start after the pause.
        if is_pr_iteration_paused(run_id=run_id, organization_id=organization_id):
            record_pause_blocked("consume")
            clear_queued_autofix_feedback(run_id)
            logger.info(
                "autofix.pr_iteration.consume_feedback.skipped",
                extra={
                    "run_id": run_id,
                    "organization_id": organization_id,
                    "trigger_id": trigger_id,
                    "reason": "paused",
                },
            )
            return

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
        log_ctx = PrIterationLogContext.for_run(logger, state, organization_id, group_id)
        task_state = current_task()
        log_ctx.info(
            "autofix.pr_iteration.consume_feedback.started",
            run_status=state.status,
            trigger_id=trigger_id,
            trigger_source=trigger_source,
            activation_id=task_state.id if task_state else None,
        )

        try:
            _drain_queued_autofix_feedback(
                log_ctx=log_ctx,
                run_id=run_id,
                organization_id=organization_id,
                group_id=group_id,
                state=state,
                trigger_id=trigger_id,
                trigger_source=trigger_source,
            )
        except Exception as e:
            log_ctx.error(
                "autofix.pr_iteration.consume_feedback.failed",
                error_type=type(e).__name__,
            )
            raise


def _drain_queued_autofix_feedback(
    *,
    log_ctx: PrIterationLogContext,
    run_id: int,
    organization_id: int,
    group_id: int | None,
    state: SeerRunState,
    trigger_id: str | None,
    trigger_source: str | None,
) -> None:
    """Pop this run's queued feedback and hand whatever survives to the agent."""
    group = (
        Group.objects.filter(id=group_id, project__organization_id=organization_id).first()
        if group_id
        else None
    )
    if group is None:
        log_ctx.error("autofix.pr_iteration.consume_feedback.group_not_found", exc_info=False)
        return

    if state.status == "processing":
        log_ctx.info(
            "autofix.pr_iteration.consume_feedback.drain",
            outcome="skipped",
            reason="run_processing",
            run_status=state.status,
            trigger_id=trigger_id,
            trigger_source=trigger_source,
            left_queued_count=count_queued_autofix_feedback(run_id),
        )
        return

    queued_items = pop_queued_autofix_feedback(run_id)
    if not queued_items:
        log_ctx.info(
            "autofix.pr_iteration.consume_feedback.drain",
            outcome="skipped",
            reason="empty_queue",
            run_status=state.status,
            trigger_id=trigger_id,
            trigger_source=trigger_source,
        )
        return

    consumable_items: list[QueuedAutofixFeedback] = []
    feedback_items = []
    dropped: list[dict[str, Any]] = []
    # Keyed by (source class, id): issue-comment, review-comment, and review
    # (body) ids come from separate GitHub namespaces, so dedupe within each
    # concrete source type.
    seen_comment_keys: set[tuple[type, int]] = set()
    # Align with CheckSuiteFeedbackSource.should_consume: coalesce by
    # (suite id, updated_at). Legacy feedback without updated_at uses suite id.
    seen_check_suite_keys: set[tuple[int, str] | int] = set()
    for item in queued_items:
        source = item.feedback.source
        consume = source.should_consume(state)
        if not consume.ok:
            dropped.append(_dropped_feedback(item.feedback, consume.reason))
            continue

        comment_dedupe_id: int | None = None
        if isinstance(source, (GithubPrCommentFeedbackSource, GithubPrReviewCommentFeedbackSource)):
            comment_dedupe_id = source.comment.id
        elif isinstance(source, GithubPrReviewBodyFeedbackSource):
            comment_dedupe_id = source.review_id

        if comment_dedupe_id is not None:
            key = (type(source), comment_dedupe_id)
            if key in seen_comment_keys:
                dropped.append(_dropped_feedback(item.feedback, "duplicate_comment"))
                continue
            seen_comment_keys.add(key)
        elif isinstance(source, CheckSuiteFeedbackSource):
            suite_key = source.check_suite_attempt_key()
            if suite_key in seen_check_suite_keys:
                dropped.append(_dropped_feedback(item.feedback, "duplicate_check_suite"))
                continue
            seen_check_suite_keys.add(suite_key)

        consumable_items.append(item)
        feedback_items.append(item.feedback)

    if not feedback_items:
        log_ctx.info(
            "autofix.pr_iteration.consume_feedback.drain",
            outcome="skipped",
            reason="no_consumable_feedback",
            run_status=state.status,
            trigger_id=trigger_id,
            trigger_source=trigger_source,
            queued_count=len(queued_items),
            dropped=dropped,
        )
        return

    referrer = _get_feedback_referrer(consumable_items)
    actor_user_id = _get_feedback_actor_user_id(consumable_items)
    log_ctx.info(
        "autofix.pr_iteration.consume_feedback.drain",
        outcome="drained",
        reason="ok",
        run_status=state.status,
        trigger_id=trigger_id,
        trigger_source=trigger_source,
        queued_count=len(queued_items),
        consumable_count=len(feedback_items),
        dropped=dropped,
        feedback_ids=[item.feedback.feedback_id for item in consumable_items],
        referrer=referrer.value,
        actor_user_id=actor_user_id,
    )

    # a drain (from the log above) with no trigger autofix agent below it means this call never came back.
    try:
        trigger_autofix_agent(
            group=group,
            step=AutofixStep.PR_ITERATION,
            referrer=referrer,
            run_id=run_id,
            user_context="\n\n".join(item.text for item in feedback_items),
            feedback=feedback_items,
            actor_user_id=actor_user_id,
            commit_author=commit_author_for_feedback(feedback_items, organization_id),
        )
    except (
        PrIterationNoPullRequestException,
        PrIterationNotEnabledException,
        SeerPermissionError,
    ) as error:
        log_ctx.info(
            "autofix.pr_iteration.consume_feedback.trigger_agent",
            outcome="skipped",
            reason=type(error).__name__,
            error=str(error),
            trigger_id=trigger_id,
            trigger_source=trigger_source,
        )
        return

    log_ctx.info(
        "autofix.pr_iteration.consume_feedback.trigger_agent",
        outcome="started",
        trigger_id=trigger_id,
        trigger_source=trigger_source,
    )
    metrics.incr(
        "autofix.pr_iteration.consume_feedback.triggered",
        tags={"trigger_source": trigger_source or "unknown"},
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


def _delete_own_comment_eyes_reaction(
    scm: SourceCodeManager,
    *,
    source_type: GithubPrCommentFeedbackType,
    pr_number: int,
    comment_id: int,
) -> None:
    """Remove the :eyes: we added at trigger time, completing the :eyes:->:tada: swap.

    Both top-level PR comments and inline review comments get the trigger-time
    :eyes:, so both are cleaned up here. GitHub keeps issue-comment and
    review-comment reactions in separate namespaces, so the get/delete calls are
    dispatched off ``source_type``.
    """
    if not isinstance(scm, GetAuthenticatedActorProtocol):
        logger.warning("autofix.pr_iteration.completion_reaction.unsupported_provider")
        return

    def _own_eyes_reaction_ids(reactions: list[ReactionResult], actor_id: ResourceId) -> list[str]:
        return [
            str(reaction["id"])
            for reaction in reactions
            if reaction["content"] == "eyes"
            and (author := reaction.get("author")) is not None
            and author["id"] == actor_id
        ]

    try:
        actor = scm_actions.get_authenticated_actor(scm)
        actor_id = actor["data"]["id"]

        # GitHub keeps issue-comment and review-comment reactions in separate
        # namespaces, so the get/delete calls are dispatched off ``source_type``.
        if source_type == "github-pr-review-comment":
            if not (
                isinstance(scm, GetReviewCommentReactionsProtocol)
                and isinstance(scm, DeleteReviewCommentReactionProtocol)
            ):
                logger.warning("autofix.pr_iteration.completion_reaction.unsupported_provider")
                return
            result = scm_actions.get_review_comment_reactions(scm, str(pr_number), str(comment_id))
            for reaction_id in _own_eyes_reaction_ids(result["data"], actor_id):
                scm_actions.delete_review_comment_reaction(
                    scm, str(pr_number), str(comment_id), reaction_id
                )
        else:
            if not (
                isinstance(scm, GetPullRequestCommentReactionsProtocol)
                and isinstance(scm, DeletePullRequestCommentReactionProtocol)
            ):
                logger.warning("autofix.pr_iteration.completion_reaction.unsupported_provider")
                return
            result = scm_actions.get_pull_request_comment_reactions(
                scm, str(pr_number), str(comment_id)
            )
            for reaction_id in _own_eyes_reaction_ids(result["data"], actor_id):
                scm_actions.delete_pull_request_comment_reaction(
                    scm, str(pr_number), str(comment_id), reaction_id
                )
    except Exception:
        logger.exception("autofix.pr_iteration.completion_reaction.delete_eyes_failed")


class UnsupportedProviderError(Exception):
    """The SCM provider can't resolve review threads."""


@dataclass
class ResolveReviewThreadsResult:
    resolved: int = 0
    already_resolved: int = 0
    not_found: int = 0


def _resolve_review_comment_threads(
    scm: SourceCodeManager,
    *,
    pr_number: int,
    comment_unique_ids: Collection[str],
) -> ResolveReviewThreadsResult:
    """Resolve the review threads of this iteration's inline comments (CW-1688).

    Raises ``UnsupportedProviderError`` when the provider lacks the review-thread
    protocols, and lets SCM failures propagate; the caller logs both with its own
    run/org/repo context.
    """
    if not (
        isinstance(scm, ResolveReviewThreadProtocol)
        and isinstance(scm, GetPullRequestReviewThreadsProtocol)
    ):
        raise UnsupportedProviderError(type(scm).__name__)

    threads: list[ReviewThread] = []
    # Empty starting cursor so GitHub's GraphQL first page is `after: null`.
    for page in iter_all_pages(
        lambda pagination: scm_actions.get_pull_request_review_threads(
            scm, str(pr_number), pagination
        ),
        per_page=100,
        cursor="",
    ):
        threads.extend(page["data"])

    thread_by_comment: dict[str, ReviewThread] = {}
    for thread in threads:
        for comment in thread["comments"]:
            unique_id = comment.get("unique_id")
            if unique_id is not None:
                thread_by_comment[unique_id] = thread

    outcome = ResolveReviewThreadsResult()
    thread_ids_to_resolve: set[ResourceId] = set()
    already_resolved_ids: set[ResourceId] = set()
    for comment_unique_id in comment_unique_ids:
        owning_thread = thread_by_comment.get(comment_unique_id)
        if owning_thread is None:
            outcome.not_found += 1
            continue
        if owning_thread["is_resolved"]:
            already_resolved_ids.add(owning_thread["id"])
        else:
            thread_ids_to_resolve.add(owning_thread["id"])

    outcome.already_resolved = len(already_resolved_ids)
    for thread_id in thread_ids_to_resolve:
        scm_actions.resolve_review_thread(scm, str(pr_number), str(thread_id))
        outcome.resolved += 1
    return outcome


def _comment_pr_iteration_ineligible(
    scm: SourceCodeManager,
    *,
    organization_id: int,
    repo_id: int,
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

    if comment_id is not None:
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

            if not isinstance(scm, CreatePullRequestCommentProtocol):
                logger.warning(
                    "autofix.pr_iteration.comment_trigger.ineligible_unsupported_provider",
                    extra=log_extra,
                )
                return

            try:
                scm_actions.create_pull_request_comment(
                    scm,
                    str(pr_number),
                    _ineligible_pr_iteration_comment_body(github_username),
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


def _ack_pr_command(
    scm: SourceCodeManager,
    *,
    organization_id: int,
    pr_number: int,
    comment_id: int | None,
    source_type: GithubPrCommentFeedbackType,
    reaction: Reaction,
    body: str,
    command: str,
) -> None:
    """Answer an ``@sentry`` command with a reaction on it and a reply on the PR.

    The reply is best-effort: a command whose work already landed shouldn't fail
    on the acknowledgement of it.
    """
    if comment_id is not None:
        _add_comment_reaction(
            scm,
            source_type=source_type,
            pr_number=pr_number,
            comment_id=comment_id,
            reaction=reaction,
        )

    if not isinstance(scm, CreatePullRequestCommentProtocol):
        return

    try:
        scm_actions.create_pull_request_comment(scm, str(pr_number), body)
    except Exception:
        logger.warning(
            "autofix.pr_iteration.comment_trigger.comment_failed",
            extra={
                "organization_id": organization_id,
                "pr_number": pr_number,
                "command": command,
            },
            exc_info=True,
        )


def _fetch_pr_id(scm: GetPullRequestProtocol, pr_number: int) -> int | None:
    """Recover a PR's provider-global id from its repo-scoped number.

    The fallback behind ``PullRequest.objects.get_or_fetch_external_id``, so it
    runs only when the row has no ``external_id`` yet. Both trigger tasks run
    async, meaning the PR may have been deleted or made private, or the provider
    may return a transient error, between webhook receipt and execution —
    ``SCMError`` propagates to the caller, which is where the drop is logged.

    ``internal_id`` is typed as a string id across providers, so a payload that
    isn't a base-10 integer is possible in principle and is not storable in
    ``external_id``. Treated as a miss rather than an exception: the caller
    already handles ``None`` as "no id available", and a crashing task would
    retry into the same unparseable payload.
    """
    pull_request = scm_actions.get_pull_request(scm, str(pr_number))
    internal_id = pull_request["data"]["internal_id"]
    try:
        return int(internal_id)
    except (TypeError, ValueError):
        logger.warning(
            "autofix.pr_iteration.pr_id.unparseable_internal_id",
            extra={"pr_number": pr_number, "internal_id": internal_id},
        )
        return None


class PrCommentRunOutcome(StrEnum):
    MISSING_REPO = "missing_repo"
    UNSUPPORTED_PROVIDER = "unsupported_provider"
    PR_FETCH_FAILED = "pr_fetch_failed"
    NO_RUN = "no_run"
    INELIGIBLE_RUN = "ineligible_run"
    SCM_INIT_FAILED = "scm_init_failed"
    UNAUTHORIZED = "unauthorized"
    PAUSE_FAILED = "pause_failed"


# The iterate task counts these three outcomes only.
_COMMENT_TRIGGER_COUNTED_OUTCOMES = frozenset(
    {
        PrCommentRunOutcome.NO_RUN,
        PrCommentRunOutcome.INELIGIBLE_RUN,
        PrCommentRunOutcome.UNAUTHORIZED,
    }
)


class ResolvedPrCommentRun(NamedTuple):
    agent_state: SeerRunState
    scm: SourceCodeManager
    actor_user: RpcUser | None


def _resolve_run_for_pr_comment(
    *,
    organization_id: int,
    repo_id: int,
    integration_id: int,
    pr_number: int,
    github_username: str,
    comment_id: int | None,
    source_type: GithubPrCommentFeedbackType,
    command: str,
    explain_ineligible: bool,
    external_id: str | int | None = None,
) -> ResolvedPrCommentRun | PrCommentRunOutcome:
    """Resolve the Autofix run behind a PR comment and gate on repo write access.

    The iterate command and the stop command share this gate, so these logs name
    the caller with a ``command`` tag rather than a message of their own.

    ``explain_ineligible`` decides whether an ineligible run is answered on the PR
    at all. A cell can only see its own Seer, so it cannot tell "no Autofix
    created this PR" from "none did *here*" — and one GitHub delivery reaches
    every cell holding an org on the installation. The stop command therefore
    stays silent and leaves the answer to the cell that owns the run.
    """
    repo = Repository.objects.filter(id=repo_id, organization_id=organization_id).first()
    if repo is None:
        logger.info(
            "autofix.pr_iteration.comment_trigger.missing_repo",
            extra={"organization_id": organization_id, "repo_id": repo_id, "command": command},
        )
        return PrCommentRunOutcome.MISSING_REPO

    if repo.provider != PR_ITERATION_PROVIDER:
        # Everything below reads the provider off the constant rather than the
        # repo, so this is where the two are held to be the same thing. The entry
        # point already rejects anything else, which makes reaching this a
        # disagreement between that gate and this task rather than ordinary
        # traffic — hence warning, and hence the provider in `extra`.
        logger.warning(
            "autofix.pr_iteration.comment_trigger.unsupported_provider",
            extra={
                "organization_id": organization_id,
                "repo_id": repo.id,
                "provider": repo.provider,
                "command": command,
            },
        )
        return PrCommentRunOutcome.UNSUPPORTED_PROVIDER

    try:
        scm = make_scm(organization_id, repo_id, referrer="seer")
    except Exception:
        logger.warning(
            "autofix.pr_iteration.comment_trigger.scm_init_failed",
            extra={"organization_id": organization_id, "repo_id": repo_id, "command": command},
            exc_info=True,
        )
        return PrCommentRunOutcome.SCM_INIT_FAILED

    if not isinstance(scm, GetPullRequestProtocol):
        logger.warning(
            "autofix.pr_iteration.comment_trigger.unsupported_provider",
            extra={"organization_id": organization_id, "repo_id": repo_id, "command": command},
        )
        return PrCommentRunOutcome.UNSUPPORTED_PROVIDER

    try:
        # The issue_comment payload behind an `@sentry` mention carries only the
        # PR number, but Seer's run lookup is keyed on GitHub's numeric PR id.
        # The mapping lives on ``PullRequest.external_id``; the provider call
        # runs only when no webhook (or earlier write-back) has stored it yet.
        pr_id = PullRequest.objects.get_or_fetch_external_id(
            organization_id=organization_id,
            repository_id=repo.id,
            key=str(pr_number),
            fetch=lambda: _fetch_pr_id(scm, pr_number),
        )
    except SCMError:
        logger.warning(
            "autofix.pr_iteration.comment_trigger.get_pull_request_failed",
            extra={"organization_id": organization_id, "pr_number": pr_number, "command": command},
            exc_info=True,
        )
        return PrCommentRunOutcome.PR_FETCH_FAILED
    if pr_id is None:
        return PrCommentRunOutcome.PR_FETCH_FAILED

    agent_state = get_agent_state_from_pr_id(organization_id, PR_ITERATION_PROVIDER, pr_id)
    if agent_state is None:
        # No-op: missing runs are expected on regions that don't own the session
        # when webhooks are fanned out everywhere. Do not react/comment as
        # ineligible — that would false-positive against the region that does
        # own the Autofix run and is iterating successfully.
        logger.info(
            "autofix.pr_iteration.comment_trigger.no_run",
            extra={"organization_id": organization_id, "pr_id": pr_id, "command": command},
        )
        return PrCommentRunOutcome.NO_RUN

    if not agent_state.repo_pr_states:
        # Found a Seer run for this PR, but it wasn't created by Autofix
        # (coding-agent handoff is the main case).
        logger.info(
            "autofix.pr_iteration.comment_trigger.ineligible_run",
            extra={
                "organization_id": organization_id,
                "pr_id": pr_id,
                "run_id": agent_state.run_id,
                "command": command,
            },
        )
        if explain_ineligible:
            _comment_pr_iteration_ineligible(
                scm,
                organization_id=organization_id,
                repo_id=repo.id,
                pr_number=pr_number,
                github_username=github_username,
                source_type=source_type,
                comment_id=comment_id,
            )
        return PrCommentRunOutcome.INELIGIBLE_RUN

    if not _github_commenter_has_repo_write_access(scm, github_username):
        logger.info(
            "autofix.pr_iteration.comment_trigger.unauthorized",
            extra={
                "organization_id": organization_id,
                "github_username": github_username,
                "command": command,
            },
        )
        return PrCommentRunOutcome.UNAUTHORIZED

    actor_user = find_user_for_scm_actor(
        organization_id=organization_id,
        integration_id=integration_id,
        username=github_username,
        external_id=external_id,
    )
    return ResolvedPrCommentRun(agent_state=agent_state, scm=scm, actor_user=actor_user)


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

    resolved = _resolve_run_for_pr_comment(
        organization_id=organization_id,
        repo_id=repo_id,
        integration_id=integration_id,
        pr_number=pr_number,
        github_username=github_username,
        comment_id=comment.id,
        source_type=source.type,
        command="iterate",
        explain_ineligible=True,
        external_id=comment.user.id if comment.user else None,
    )
    if isinstance(resolved, PrCommentRunOutcome):
        if resolved in _COMMENT_TRIGGER_COUNTED_OUTCOMES:
            metrics.incr(f"autofix.pr_iteration.comment_trigger.{resolved.value}")
        return None

    agent_state = resolved.agent_state
    if is_pr_iteration_paused(run_id=agent_state.run_id, organization_id=organization_id):
        # `@sentry stop iterating` already stopped this run, and nothing restarts
        # it, so consume would drop whatever we queued here. Write nothing at all:
        # a reaction on feedback that will never be read is an ack of work that
        # won't happen, and the stop asked Seer to go quiet on this PR.
        record_pause_blocked("comment_trigger")
        logger.info(
            "autofix.pr_iteration.comment_trigger.paused",
            extra={"organization_id": organization_id, "run_id": agent_state.run_id},
        )
        return None

    group_id = agent_state.metadata.get("group_id") if agent_state.metadata else None
    if group_id is None:
        raise ValueError(f"Missing group id in agent run {agent_state.run_id}")

    log_ctx = PrIterationLogContext.for_run(logger, agent_state, organization_id, group_id)
    try_enqueue_autofix_feedback(
        log_ctx=log_ctx,
        run_id=agent_state.run_id,
        organization_id=organization_id,
        group_id=group_id,
        feedback=feedback_obj,
        referrer=AutofixReferrer.GITHUB_PR_COMMENT,
        run_state=agent_state,
        actor_user_id=resolved.actor_user.id if resolved.actor_user else None,
    )
    trigger_consume_pr_iteration_feedback(
        log_ctx=log_ctx,
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
        resolved.scm,
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


@instrumented_task(
    name="sentry.tasks.autofix.pause_pr_iteration_from_comment",
    namespace=seer_tasks,
    processing_deadline_duration=65,
    retry=Retry(times=1),
)
def pause_pr_iteration_from_comment(
    *,
    organization_id: int,
    repo_id: int,
    integration_id: int,
    pr_number: int,
    comment_id: int | None,
    github_username: str,
) -> None:
    """
    Resolve the Autofix run behind ``pr_number`` and stop its PR iteration.

    Gates the commenter on repo write access, then acknowledges the stop with a
    reaction and a comment on the pull request.
    """
    resolved = _resolve_run_for_pr_comment(
        organization_id=organization_id,
        repo_id=repo_id,
        integration_id=integration_id,
        pr_number=pr_number,
        github_username=github_username,
        comment_id=comment_id,
        source_type="github-pr-comment",
        # An ineligible run means no cell-local Autofix PR, which is also what a
        # non-owning cell sees for a perfectly healthy run. Writing nothing keeps
        # this command's ack coming from one cell.
        command="stop",
        explain_ineligible=False,
    )
    if isinstance(resolved, PrCommentRunOutcome):
        metrics.incr("autofix.pr_iteration.stop_command", tags={"outcome": resolved.value})
        return None

    run_id = resolved.agent_state.run_id
    if is_pr_iteration_paused(run_id=run_id, organization_id=organization_id):
        # `pause_pr_iteration` is idempotent and reports success either way, so
        # ask first — repeating the stop confirmation would credit this comment
        # with a stop it didn't perform. Nothing resumes a run, so a paused run
        # stays paused and this is not a race worth locking.
        metrics.incr("autofix.pr_iteration.stop_command", tags={"outcome": "already_paused"})
        _ack_pr_command(
            resolved.scm,
            organization_id=organization_id,
            pr_number=pr_number,
            comment_id=comment_id,
            source_type="github-pr-comment",
            reaction="+1",
            body=ALREADY_PAUSED_PR_ITERATION_COMMENT,
            command="stop",
        )
        return None

    paused = pause_pr_iteration(
        run_id=run_id,
        organization_id=organization_id,
        actor_user_id=resolved.actor_user.id if resolved.actor_user else None,
    )
    reaction: Reaction = "+1"
    body = STOPPED_PR_ITERATION_COMMENT
    if paused:
        metrics.incr("autofix.pr_iteration.stop_command", tags={"outcome": "success"})
    else:
        # The run has no SeerRun row for the stop marker to land on, so it
        # predates mirroring or was deleted mid-command. Logged at error to
        # raise it in Sentry: the comment below is the user's way out, not a
        # state we intend to keep serving.
        logger.error(
            "autofix.pr_iteration.stop_command.pause_failed",
            extra={"organization_id": organization_id, "run_id": run_id},
        )
        metrics.incr(
            "autofix.pr_iteration.stop_command",
            tags={"outcome": PrCommentRunOutcome.PAUSE_FAILED.value},
        )
        reaction = "confused"
        body = STOP_PR_ITERATION_FAILED_COMMENT

    _ack_pr_command(
        resolved.scm,
        organization_id=organization_id,
        pr_number=pr_number,
        comment_id=comment_id,
        source_type="github-pr-comment",
        reaction=reaction,
        body=body,
        command="stop",
    )

    return None


_REVIEW_PAGE_SIZE = 100


def _fetch_all_review_comments(
    scm: GetReviewCommentsProtocol,
    *,
    pr_number: int,
    review_id: int,
) -> list[ReviewComment]:
    """Page through every inline comment attached to a submitted review."""
    comments: list[ReviewComment] = []
    page = 1
    while True:
        pagination: PaginationParams = {"cursor": str(page), "per_page": _REVIEW_PAGE_SIZE}
        result = scm_actions.get_review_comments(scm, str(pr_number), str(review_id), pagination)
        batch = result["data"]
        comments.extend(batch)
        if len(batch) < _REVIEW_PAGE_SIZE:
            return comments
        page += 1


def _fetch_review_body(
    scm: GetPullRequestReviewProtocol,
    *,
    pr_number: int,
    review_id: int,
) -> Review | None:
    """Fetch the submitted review (for its summary body) directly by id."""
    try:
        result = scm_actions.get_pull_request_review(scm, str(pr_number), str(review_id))
    except ResourceNotFound:
        return None
    return result["data"]


def _diff_line_number(diff_line: DiffLine | None) -> int | None:
    """Flatten an SCM ``DiffLine`` to a single line number for display.

    A ``DiffLine`` carries the line's position on the head and/or base side of the
    diff (see ``scm.types.DiffLine``). The anchor is display context only, so
    prefer the head (post-image) side and fall back to the base side.
    """
    if not diff_line:
        return None
    return diff_line.get("head") or diff_line.get("base")


def _build_review_feedback(
    inline_comments: list[ReviewComment],
    review_body: str | None,
    *,
    review_id: int,
    review_html_url: str | None,
    review_state: str | None,
    review_author: Author | None,
    author_is_bot: bool,
) -> list[Feedback]:
    """Normalize a submitted review into feedback items.

    Each inline comment becomes an anchored ``GithubPrReviewCommentFeedbackSource``
    (command gate relaxed) and the review's summary body, if any, becomes its own
    non-anchored ``GithubPrReviewBodyFeedbackSource``. Every item carries the
    shared ``review_id`` so the UI can group them under one review; the review's
    ``review_state`` (approved / changes requested / commented) lives on the body
    source, the review's own representation.

    ``author_is_bot`` marks the resulting feedback as automated so it counts
    toward the automated-iteration streak cap (see ``automated_iteration_cap_reached``).
    """
    feedback: list[Feedback] = []

    for comment in inline_comments:
        author = comment.get("author")
        # The SCM-normalized ``ReviewComment`` carries ``file_path`` / ``author``
        # / ``url`` while the reusable source reads the webhook-shaped ``path`` /
        # ``user`` / ``html_url``, so map the fields explicitly before constructing
        # it. ``line`` / ``start_line`` are ``DiffLine`` dicts now, so flatten to a
        # line number.
        review_comment = GithubPullRequestReviewComment(
            id=int(comment["id"]),
            body=comment.get("body"),
            html_url=comment.get("url"),
            path=comment.get("file_path"),
            line=_diff_line_number(comment.get("line")),
            start_line=_diff_line_number(comment.get("start_line")),
            diff_hunk=comment.get("diff_hunk"),
            user=GithubPrCommentUser(
                id=author["id"] if author else None,
                login=author["username"] if author else None,
            ),
            unique_id=comment.get("unique_id"),
        )
        source = GithubPrReviewCommentFeedbackSource(
            comment=review_comment,
            review_id=review_id,
            author_is_bot=author_is_bot,
        )
        feedback.append(Feedback(source=source))

    if review_body:
        body_source = GithubPrReviewBodyFeedbackSource(
            review_id=review_id,
            review_state=review_state,
            body=review_body,
            html_url=review_html_url,
            user=GithubPrCommentUser(
                id=review_author["id"] if review_author else None,
                login=review_author["username"] if review_author else None,
            ),
            author_is_bot=author_is_bot,
        )
        feedback.append(Feedback(source=body_source))

    return feedback


@instrumented_task(
    name="sentry.tasks.autofix.trigger_pr_iteration_from_review",
    namespace=seer_tasks,
    processing_deadline_duration=65,
    retry=Retry(times=1),
)
def trigger_pr_iteration_from_review(
    *,
    organization_id: int,
    repo_id: int,
    integration_id: int,
    pr_number: int,
    review_id: int,
    author_username: str | None = None,
    author_external_id: str | int | None = None,
    author_is_bot: bool = False,
    delivery_authenticated: bool = True,
) -> None:
    """
    Resolve the Autofix run behind a submitted PR review and kick off an iteration.

    Runs async because it makes external GitHub and Seer calls: it fetches the PR
    to recover its GitHub id, looks up the agent run keyed on that id, fetches the
    review's inline comments and summary body, and triggers the iteration with the
    whole review as feedback. Unlike the comment path there is no ``@sentry``
    command gate — any submitted review with content is acted on — but a human
    review author must have repo write/admin access, so an untrusted reviewer can't
    spend Autofix quota or inject feedback that rewrites the PR.

    ``author_is_bot`` reviews (test-coverage bots and the like) count toward the
    automated-iteration streak cap and are dropped once it's reached; human
    reviews always drive an iteration and reset that streak.
    """
    log_extra = {
        "organization_id": organization_id,
        "repo_id": repo_id,
        "pr_number": pr_number,
        "review_id": review_id,
        "author_username": author_username,
        "author_is_bot": author_is_bot,
    }

    repo = Repository.objects.filter(id=repo_id, organization_id=organization_id).first()
    if repo is None:
        logger.info("autofix.pr_iteration.review_trigger.missing_repo", extra=log_extra)
        return None

    if repo.provider != PR_ITERATION_PROVIDER:
        # See the matching guard in `trigger_pr_iteration_from_comment`: the
        # provider read below comes from the constant, so it is held equal to the
        # repo's here, before any external call.
        logger.warning(
            "autofix.pr_iteration.review_trigger.unsupported_provider",
            extra={**log_extra, "provider": repo.provider},
        )
        return None

    try:
        scm = make_scm(organization_id, repo_id, referrer="seer")
    except Exception:
        logger.warning(
            "autofix.pr_iteration.review_trigger.scm_init_failed", extra=log_extra, exc_info=True
        )
        return None

    if (
        not isinstance(scm, GetPullRequestProtocol)
        or not isinstance(scm, GetReviewCommentsProtocol)
        or not isinstance(scm, GetPullRequestReviewProtocol)
    ):
        logger.warning("autofix.pr_iteration.review_trigger.unsupported_provider", extra=log_extra)
        return None

    try:
        # The pull_request_review payload carries only the PR number, but Seer's
        # run lookup is keyed on GitHub's numeric PR id. A pull_request webhook
        # on this PR has almost certainly written ``external_id`` already, so
        # the fetch is the exception rather than the rule.
        pr_id = PullRequest.objects.get_or_fetch_external_id(
            organization_id=organization_id,
            repository_id=repo.id,
            key=str(pr_number),
            fetch=lambda: _fetch_pr_id(scm, pr_number),
        )
    except SCMError:
        logger.warning(
            "autofix.pr_iteration.review_trigger.get_pull_request_failed",
            extra=log_extra,
            exc_info=True,
        )
        return None
    if pr_id is None:
        return None

    agent_state = get_agent_state_from_pr_id(organization_id, PR_ITERATION_PROVIDER, pr_id)
    if agent_state is None or not agent_state.repo_pr_states:
        metrics.incr("autofix.pr_iteration.review_trigger.no_run")
        logger.info(
            "autofix.pr_iteration.review_trigger.no_run",
            extra={**log_extra, "pr_id": pr_id},
        )
        return None

    # Only bot reviews are capped: once the last N iterations were all automated,
    # stop letting bots (test-coverage comments and the like) drive further ones —
    # they'd loop forever without human input. A human review always proceeds and
    # resets that streak. Bail before enqueueing or acking so we don't :eyes:-ack
    # inline comments that never produce an iteration.
    if author_is_bot and automated_iteration_cap_reached(agent_state):
        metrics.incr("autofix.pr_iteration.review_trigger.max_iterations_reached")
        logger.info(
            "autofix.pr_iteration.review_trigger.max_iterations_reached",
            extra={
                **log_extra,
                "max_iterations": options.get("autofix.pr-iteration.max-iterations"),
            },
        )
        return None

    # Bots skip the write-access gate: a bot account is never a repo collaborator.
    # An unauthenticated delivery can forge the bot flag, so it stays gated.
    actor_user: RpcUser | None = None
    if author_is_bot and delivery_authenticated:
        metrics.incr("autofix.pr_iteration.review_trigger.write_access_gate_skipped")
    elif not author_username or not _github_commenter_has_repo_write_access(scm, author_username):
        metrics.incr("autofix.pr_iteration.review_trigger.no_write_access")
        logger.info("autofix.pr_iteration.review_trigger.no_write_access", extra=log_extra)
        return None
    else:
        actor_user = find_user_for_scm_actor(
            organization_id=organization_id,
            integration_id=integration_id,
            username=author_username,
            external_id=author_external_id,
        )

    inline_comments = _fetch_all_review_comments(scm, pr_number=pr_number, review_id=review_id)
    review = _fetch_review_body(scm, pr_number=pr_number, review_id=review_id)
    review_body = (review.get("body") or "").strip() if review else None
    review_html_url = review.get("html_url") if review else None
    review_state = review.get("state") if review else None
    review_author = review.get("author") if review else None

    # Skip genuinely empty reviews — no body text AND no inline comments — there
    # is nothing to act on (e.g. a bare approve with no message). A review with
    # any content (even "looks good") is passed through to the agent.
    if not review_body and not inline_comments:
        logger.info("autofix.pr_iteration.review_trigger.empty_review", extra=log_extra)
        return None

    feedback_items = _build_review_feedback(
        inline_comments,
        review_body,
        review_id=review_id,
        review_html_url=review_html_url,
        review_state=review_state,
        review_author=review_author,
        author_is_bot=author_is_bot,
    )
    if not feedback_items:
        logger.info("autofix.pr_iteration.review_trigger.no_feedback", extra=log_extra)
        return None

    group_id = agent_state.metadata.get("group_id") if agent_state.metadata else None
    if group_id is None:
        raise ValueError(f"Missing group id in agent run {agent_state.run_id}")

    log_ctx = PrIterationLogContext.for_run(logger, agent_state, organization_id, group_id)
    for feedback_obj in feedback_items:
        try_enqueue_autofix_feedback(
            log_ctx=log_ctx,
            run_id=agent_state.run_id,
            organization_id=organization_id,
            group_id=group_id,
            feedback=feedback_obj,
            referrer=AutofixReferrer.GITHUB_PR_REVIEW,
            run_state=agent_state,
            actor_user_id=actor_user.id if actor_user else None,
        )

    # A single consume pass drains everything queued above; trigger once using
    # the first item to decide the countdown (all share the same run).
    trigger_consume_pr_iteration_feedback(
        log_ctx=log_ctx,
        run_id=agent_state.run_id,
        organization_id=organization_id,
        feedback=feedback_items[0],
        run_state=agent_state,
    )

    # Ack each inline comment with :eyes:, mirroring the single-comment path (the
    # review body has no reaction target). Gate on should_consume so we don't ack a
    # comment consume will drop as stale.
    # TODO: doesn't cover consume's other drop paths (group missing, processing,
    # cap hit mid-drain) — reconcile with consume's outcome later.
    for feedback_obj in feedback_items:
        source = feedback_obj.source
        if not isinstance(source, GithubPrReviewCommentFeedbackSource):
            continue
        if source.comment.id is None or not source.should_consume(agent_state).ok:
            continue
        _add_comment_reaction(
            scm,
            source_type="github-pr-review-comment",
            pr_number=pr_number,
            comment_id=int(source.comment.id),
            reaction="eyes",
        )

    metrics.incr("autofix.pr_iteration.review_trigger.success")
    logger.info("autofix.pr_iteration.review_trigger.success", extra=log_extra)

    return None
