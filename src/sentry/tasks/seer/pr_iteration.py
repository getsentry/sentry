from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

import sentry_sdk
from scm import actions as scm_actions
from scm.errors import ResourceNotFound
from scm.manager import SourceCodeManager
from scm.types import (
    CreatePullRequestCommentReactionProtocol,
    CreateReviewCommentReactionProtocol,
    DeletePullRequestCommentReactionProtocol,
    DeleteReviewCommentReactionProtocol,
    DiffLine,
    GetAuthenticatedActorProtocol,
    GetPullRequestCommentReactionsProtocol,
    GetPullRequestReviewProtocol,
    GetRepositoryUserPermissionProtocol,
    GetReviewCommentReactionsProtocol,
    GetReviewCommentsProtocol,
    PaginationParams,
    Reaction,
    ReactionResult,
    ResourceId,
    Review,
    ReviewComment,
)
from taskbroker_client.retry import Retry

from sentry import options
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
from sentry.seer.autofix.pr_iteration.feedback import Feedback, automated_iteration_cap_reached
from sentry.seer.autofix.pr_iteration.feedback_sources.base import ConsumeTask
from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import CheckSuiteFeedbackSource
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubPrCommentFeedbackSource,
    GithubPrCommentFeedbackType,
    GithubPrCommentUser,
    GithubPrReviewBodyFeedbackSource,
    GithubPrReviewCommentFeedbackSource,
    GithubPullRequestReviewComment,
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
        # Keyed by (source class, id): issue-comment, review-comment, and review
        # (body) ids come from separate GitHub namespaces, so dedupe within each
        # concrete source type.
        seen_comment_keys: set[tuple[type, int]] = set()
        # Align with CheckSuiteFeedbackSource.should_consume: coalesce by
        # (suite id, updated_at). Legacy feedback without updated_at uses suite id.
        seen_check_suite_keys: set[tuple[int, str] | int] = set()
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
            comment_dedupe_id: int | None = None
            if isinstance(
                source, (GithubPrCommentFeedbackSource, GithubPrReviewCommentFeedbackSource)
            ):
                comment_dedupe_id = source.comment.id
            elif isinstance(source, GithubPrReviewBodyFeedbackSource):
                comment_dedupe_id = source.review_id

            if comment_dedupe_id is not None:
                key = (type(source), comment_dedupe_id)
                if key in seen_comment_keys:
                    continue
                seen_comment_keys.add(key)
            elif isinstance(source, CheckSuiteFeedbackSource):
                suite_key = source.check_suite_attempt_key()
                if suite_key in seen_check_suite_keys:
                    continue
                seen_check_suite_keys.add(suite_key)

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
            user=GithubPrCommentUser(login=author["username"] if author else None),
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
    author_is_bot: bool = False,
) -> None:
    """
    Resolve the Autofix run behind a submitted PR review and kick off an iteration.

    Runs async because it makes external GitHub and Seer calls: it fetches the PR
    to recover its GitHub id, looks up the agent run keyed on that id, fetches the
    review's inline comments and summary body, and triggers the iteration with the
    whole review as feedback. Unlike the comment path there is no ``@sentry``
    command gate — any submitted review with content is acted on — but the review
    author must have repo write/admin access, so an untrusted reviewer can't spend
    Autofix quota or inject feedback that rewrites the PR.

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
    if repo.provider is None:
        logger.warning("autofix.pr_iteration.review_trigger.no_provider", extra=log_extra)
        return None

    integration = integration_service.get_integration(integration_id=integration_id)
    if integration is None:
        logger.warning("autofix.pr_iteration.review_trigger.missing_integration", extra=log_extra)
        return None

    client = integration.get_installation(organization_id=organization_id).get_client()
    try:
        # Async task: the PR may be deleted, made private, or GitHub may return a
        # transient error between webhook receipt and execution.
        pull_request = client.get_pull_request(repo.name, str(pr_number))
    except ApiError:
        logger.warning(
            "autofix.pr_iteration.review_trigger.get_pull_request_failed",
            extra=log_extra,
            exc_info=True,
        )
        return None
    pr_id = pull_request.get("id")
    if pr_id is None:
        return None

    agent_state = get_agent_state_from_pr_id(organization_id, repo.provider, pr_id)
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

    try:
        scm = make_scm(organization_id, repo_id, referrer="seer")
    except Exception:
        logger.warning(
            "autofix.pr_iteration.review_trigger.scm_init_failed", extra=log_extra, exc_info=True
        )
        return None

    if not isinstance(scm, GetReviewCommentsProtocol) or not isinstance(
        scm, GetPullRequestReviewProtocol
    ):
        logger.warning("autofix.pr_iteration.review_trigger.unsupported_provider", extra=log_extra)
        return None

    # Gate on repo write access before fetching, enqueueing, or acking: a review
    # from someone without write/admin is silently dropped so an untrusted
    # reviewer can't spend Autofix quota or inject feedback that rewrites the PR.
    if not author_username or not _github_commenter_has_repo_write_access(scm, author_username):
        metrics.incr("autofix.pr_iteration.review_trigger.no_write_access")
        logger.info("autofix.pr_iteration.review_trigger.no_write_access", extra=log_extra)
        return None

    inline_comments = _fetch_all_review_comments(scm, pr_number=pr_number, review_id=review_id)
    review = _fetch_review_body(scm, pr_number=pr_number, review_id=review_id)
    review_body = (review.get("body") or "").strip() if review else None
    review_html_url = review.get("html_url") if review else None
    review_state = review.get("state") if review else None

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
        author_is_bot=author_is_bot,
    )
    if not feedback_items:
        logger.info("autofix.pr_iteration.review_trigger.no_feedback", extra=log_extra)
        return None

    group_id = agent_state.metadata.get("group_id") if agent_state.metadata else None
    if group_id is None:
        raise ValueError(f"Missing group id in agent run {agent_state.run_id}")

    for feedback_obj in feedback_items:
        try_enqueue_autofix_feedback(
            run_id=agent_state.run_id,
            organization_id=organization_id,
            group_id=group_id,
            feedback=feedback_obj,
            referrer=AutofixReferrer.GITHUB_PR_REVIEW,
            run_state=agent_state,
        )

    # A single consume pass drains everything queued above; trigger once using
    # the first item to decide the countdown (all share the same run).
    trigger_consume_pr_iteration_feedback(
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
        if source.comment.id is None or not source.should_consume(agent_state):
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
