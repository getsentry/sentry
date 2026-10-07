from __future__ import annotations

import logging
from collections import Counter
from typing import TYPE_CHECKING

from scm.manager import SourceCodeManager

from sentry import features
from sentry.integrations.github.utils import is_github_rate_limit_sensitive
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.scm.factory import new as make_scm
from sentry.seer.autofix.autofix_agent import get_iterations, iteration_repos
from sentry.seer.autofix.pr_iteration.feedback import parse_feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubIssueComment,
    GithubPrCommentFeedbackSource,
    GithubPrReviewBodyFeedbackSource,
    GithubPrReviewCommentFeedbackSource,
)
from sentry.tasks.seer.pr_iteration import (
    _add_comment_reaction,
    _add_review_reaction,
    _delete_own_comment_eyes_reaction,
    _delete_own_review_eyes_reaction,
)
from sentry.utils import metrics
from sentry.utils.tracing import trace

if TYPE_CHECKING:
    from sentry.seer.agent.client_models import SeerRunState

logger = logging.getLogger(__name__)

PrCommentSource = (
    GithubPrCommentFeedbackSource
    | GithubPrReviewCommentFeedbackSource
    | GithubPrReviewBodyFeedbackSource
)


def _record_completion_reaction(outcome: str, amount: int = 1) -> None:
    metrics.incr(
        "autofix.on_completion_hook.completion_reaction",
        amount=amount,
        tags={"outcome": outcome},
    )


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


@trace
def react_to_completed_iteration(
    organization: Organization,
    run_id: int,
    state: SeerRunState,
) -> Counter[str]:
    outcomes: Counter[str] = Counter()

    def record(outcome: str, amount: int = 1) -> None:
        outcomes[outcome] += amount
        _record_completion_reaction(outcome, amount)

    if not features.has("organizations:autofix-pr-iteration-manual", organization=organization):
        return outcomes

    if state.status != "completed":
        return outcomes

    _, is_synced = state.has_code_changes()
    if not is_synced:
        record("not_synced")
        return outcomes

    iterations = get_iterations(state)
    raw = (iterations[-1].blocks[0].message.metadata or {}).get("feedback") if iterations else None
    if not raw:
        record("no_feedback")
        return outcomes

    sources = [
        feedback.source
        for feedback in parse_feedback(raw)
        if isinstance(feedback.source, PrCommentSource)
    ]
    if not sources:
        record("no_pr_comment_sources")
        return outcomes

    changed_repos = iteration_repos(iterations[-1])

    # Rate-limit-sensitive orgs skip the extra reaction-delete API calls.
    delete_eyes = not is_github_rate_limit_sensitive(organization.slug)

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
        pr_number = pr_state.pr_number

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
                if delete_eyes:
                    _delete_own_review_eyes_reaction(scm, pr_number=pr_number, review_id=review_id)
            case GithubPrCommentFeedbackSource(comment=GithubIssueComment(id=int() as comment_id)):
                _add_comment_reaction(
                    scm,
                    source_type=source.type,
                    pr_number=pr_number,
                    comment_id=comment_id,
                    reaction="hooray",
                )
                record("reacted")
                if delete_eyes:
                    _delete_own_comment_eyes_reaction(
                        scm, source_type=source.type, pr_number=pr_number, comment_id=comment_id
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
                if delete_eyes:
                    _delete_own_comment_eyes_reaction(
                        scm, source_type=source.type, pr_number=pr_number, comment_id=comment_id
                    )
            case _:
                record("no_comment_id")

    return outcomes
