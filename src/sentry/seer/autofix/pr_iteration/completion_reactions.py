from __future__ import annotations

import logging
from collections import Counter
from collections.abc import Callable, Iterable, Iterator
from typing import TYPE_CHECKING

from scm.manager import SourceCodeManager
from scm.types import Reaction
from sentry_sdk import traces

from sentry.integrations.github.utils import is_github_rate_limit_sensitive
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.scm.factory import new as make_scm
from sentry.seer.autofix.pr_iteration.feedback import Feedback, parse_feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubIssueComment,
    GithubPrCommentFeedbackSource,
    GithubPrReviewBodyFeedbackSource,
    GithubPrReviewCommentFeedbackSource,
)
from sentry.seer.autofix.pr_iteration.iterations import get_iterations, iteration_repos
from sentry.seer.autofix.pr_iteration.out_of_credits import pr_iteration_out_of_credits
from sentry.seer.autofix.pr_iteration.run_markers import get_seer_run
from sentry.tasks.seer.pr_iteration import (
    _add_comment_reaction,
    _add_review_reaction,
    _delete_own_comment_reactions,
    _delete_own_review_reactions,
)
from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.seer.agent.client_models import SeerRunState

logger = logging.getLogger(__name__)

PrCommentSource = (
    GithubPrCommentFeedbackSource
    | GithubPrReviewCommentFeedbackSource
    | GithubPrReviewBodyFeedbackSource
)

OUT_OF_CREDITS_REACTION: Reaction = "confused"
_PENDING_REACTIONS: tuple[Reaction, ...] = ("eyes", OUT_OF_CREDITS_REACTION)


def _record_completion_reaction(outcome: str, amount: int = 1) -> None:
    metrics.incr(
        "autofix.on_completion_hook.completion_reaction",
        amount=amount,
        tags={"outcome": outcome},
    )


def _recorder(outcomes: Counter[str]) -> Callable[[str], None]:
    def record(outcome: str) -> None:
        outcomes[outcome] += 1
        _record_completion_reaction(outcome)

    return record


def _pr_comment_sources(feedback: Iterable[Feedback]) -> list[PrCommentSource]:
    return [item.source for item in feedback if isinstance(item.source, PrCommentSource)]


def _repo_name_for_feedback(
    state: SeerRunState,
    source: PrCommentSource,
    run_id: int,
    organization_id: int,
) -> str | None:
    repo_name = getattr(source, "repo_name", None)
    if repo_name is not None:
        return repo_name
    if len(state.repo_pr_states) == 1:
        logger.info(
            "autofix.on_completion_hook.completion_reaction.legacy_repo_inference",
            extra={"run_id": run_id, "organization_id": organization_id},
        )
        return next(iter(state.repo_pr_states))
    logger.warning(
        "autofix.on_completion_hook.completion_reaction.repo_unresolved",
        extra={"run_id": run_id, "organization_id": organization_id},
    )
    return None


def _reaction_targets(
    organization: Organization,
    run_id: int,
    state: SeerRunState,
    sources: Iterable[PrCommentSource],
    record: Callable[[str], None],
) -> Iterator[tuple[PrCommentSource, str, SourceCodeManager, int]]:
    """Each source with its repo name, SCM client and PR number. Records why any are skipped."""
    scm_by_repo: dict[str, SourceCodeManager] = {}
    for source in sources:
        repo_name = _repo_name_for_feedback(state, source, run_id, organization.id)
        if repo_name is None:
            record("no_repo_name")
            continue

        scm = scm_by_repo.get(repo_name)
        if scm is None:
            repo, resolution = Repository.objects.resolve_active(
                organization_id=organization.id,
                name=repo_name,
                normalized_provider=None,
            )
            if repo is None:
                logger.warning(
                    "autofix.on_completion_hook.completion_reaction.repo_not_found",
                    extra={
                        "run_id": run_id,
                        "organization_id": organization.id,
                        "resolution": resolution,
                    },
                )
                record("repo_not_found")
                continue
            try:
                scm = make_scm(organization.id, repo.id, referrer="seer")
            except Exception:
                logger.warning(
                    "autofix.on_completion_hook.completion_reaction.scm_init_failed",
                    extra={"run_id": run_id, "organization_id": organization.id},
                    exc_info=True,
                )
                record("scm_init_failed")
                continue
            scm_by_repo[repo_name] = scm

        pr_state = state.repo_pr_states.get(repo_name)
        if not pr_state or not pr_state.pr_number:
            record("no_pr_number")
            continue

        yield source, repo_name, scm, pr_state.pr_number


def _stopped_on_credits(organization: Organization, run_id: int, state: SeerRunState) -> bool:
    """Whether Seer credits stopped the latest iteration before its changes reached the PR."""
    out_of_credits = pr_iteration_out_of_credits(
        state, get_seer_run(run_id=run_id, organization_id=organization.id)
    )
    return out_of_credits is not None and out_of_credits.unfinished_action is not None


def _react_out_of_credits(
    organization: Organization,
    run_id: int,
    state: SeerRunState,
    sources: Iterable[PrCommentSource],
    record: Callable[[str], None],
) -> None:
    """Swap Seer's :eyes: for :confused: on feedback that credits stopped it from addressing."""
    # Rate-limit-sensitive orgs skip the extra reaction-delete API calls.
    delete_eyes = not is_github_rate_limit_sensitive(organization.slug)

    for source, _, scm, pr_number in _reaction_targets(
        organization, run_id, state, sources, record
    ):
        match source:
            case GithubPrReviewBodyFeedbackSource(review_id=int() as review_id):
                _add_review_reaction(
                    scm, pr_number=pr_number, review_id=review_id, reaction=OUT_OF_CREDITS_REACTION
                )
                if delete_eyes:
                    _delete_own_review_reactions(
                        scm, pr_number=pr_number, review_id=review_id, reactions=("eyes",)
                    )
            case (
                GithubPrCommentFeedbackSource(comment=GithubIssueComment(id=int() as comment_id))
                | GithubPrReviewCommentFeedbackSource(
                    comment=GithubIssueComment(id=int() as comment_id)
                )
            ):
                _add_comment_reaction(
                    scm,
                    source_type=source.type,
                    pr_number=pr_number,
                    comment_id=comment_id,
                    reaction=OUT_OF_CREDITS_REACTION,
                )
                if delete_eyes:
                    _delete_own_comment_reactions(
                        scm,
                        source_type=source.type,
                        pr_number=pr_number,
                        comment_id=comment_id,
                        reactions=("eyes",),
                    )
            case _:
                record("no_comment_id")
                continue
        record("reacted_out_of_credits")


@traces.trace
def react_to_feedback_held_for_credits(
    organization: Organization,
    run_id: int,
    state: SeerRunState,
    feedback: Iterable[Feedback],
) -> Counter[str]:
    """Mark PR comments whose feedback Seer credits refused to run, so they don't keep :eyes:."""
    outcomes: Counter[str] = Counter()
    _react_out_of_credits(
        organization, run_id, state, _pr_comment_sources(feedback), _recorder(outcomes)
    )
    return outcomes


@traces.trace
def react_to_completed_iteration(
    organization: Organization,
    run_id: int,
    state: SeerRunState,
) -> Counter[str]:
    """React to the latest iteration's PR comments once its turn ends: :tada: when its
    changes are pushed, or :confused: when Seer credits stopped it first."""
    outcomes: Counter[str] = Counter()
    record = _recorder(outcomes)

    is_synced = state.status == "completed" and state.has_code_changes()[1]
    if not is_synced and not _stopped_on_credits(organization, run_id, state):
        if state.status == "completed":
            record("not_synced")
        return outcomes

    iterations = get_iterations(state)
    raw = (iterations[-1].blocks[0].message.metadata or {}).get("feedback") if iterations else None
    if not raw:
        record("no_feedback")
        return outcomes

    sources = _pr_comment_sources(parse_feedback(raw))
    if not sources:
        record("no_pr_comment_sources")
        return outcomes

    if not is_synced:
        _react_out_of_credits(organization, run_id, state, sources, record)
        return outcomes

    changed_repos = iteration_repos(iterations[-1])

    # Rate-limit-sensitive orgs skip the extra reaction-delete API calls.
    delete_pending = not is_github_rate_limit_sensitive(organization.slug)

    for source, repo_name, scm, pr_number in _reaction_targets(
        organization, run_id, state, sources, record
    ):
        match source:
            case GithubPrReviewBodyFeedbackSource(review_id=int() as review_id):
                # Same rule as the review's inline comments: :tada: only if this repo changed.
                if repo_name in changed_repos:
                    _add_review_reaction(
                        scm, pr_number=pr_number, review_id=review_id, reaction="hooray"
                    )
                    record("reacted")
                else:
                    record("react_skipped_no_changes")
                if delete_pending:
                    _delete_own_review_reactions(
                        scm, pr_number=pr_number, review_id=review_id, reactions=_PENDING_REACTIONS
                    )
            case GithubPrCommentFeedbackSource(comment=GithubIssueComment(id=int() as comment_id)):
                _add_comment_reaction(
                    scm,
                    source_type=source.type,
                    pr_number=pr_number,
                    comment_id=comment_id,
                    reaction="hooray",
                )
                record("reacted")
                if delete_pending:
                    _delete_own_comment_reactions(
                        scm,
                        source_type=source.type,
                        pr_number=pr_number,
                        comment_id=comment_id,
                        reactions=_PENDING_REACTIONS,
                    )
            case GithubPrReviewCommentFeedbackSource(
                comment=GithubIssueComment(id=int() as comment_id)
            ):
                # Inline review comments only get the :tada: if this iteration committed to their repo.
                if repo_name in changed_repos:
                    _add_comment_reaction(
                        scm,
                        source_type=source.type,
                        pr_number=pr_number,
                        comment_id=comment_id,
                        reaction="hooray",
                    )
                    record("reacted")
                else:
                    record("react_skipped_no_changes")
                if delete_pending:
                    _delete_own_comment_reactions(
                        scm,
                        source_type=source.type,
                        pr_number=pr_number,
                        comment_id=comment_id,
                        reactions=_PENDING_REACTIONS,
                    )
            case _:
                record("no_comment_id")

    return outcomes
