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
from sentry.seer.autofix.pr_iteration.feedback import parse_feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubPrCommentFeedbackSource,
    GithubPrReviewCommentFeedbackSource,
)
from sentry.seer.autofix.pr_iteration.iterations import get_iterations
from sentry.tasks.seer.pr_iteration import (
    UnsupportedProviderError,
    _add_comment_reaction,
    _delete_own_comment_eyes_reaction,
    _resolve_review_comment_threads,
)
from sentry.utils import metrics
from sentry.utils.tracing import trace

if TYPE_CHECKING:
    from sentry.seer.agent.client_models import SeerRunState

logger = logging.getLogger(__name__)


def _record_completion_reaction(outcome: str, amount: int = 1) -> None:
    metrics.incr(
        "autofix.on_completion_hook.completion_reaction",
        amount=amount,
        tags={"outcome": outcome},
    )


def _repo_name_for_feedback(
    state: SeerRunState,
    source: GithubPrCommentFeedbackSource | GithubPrReviewCommentFeedbackSource,
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

    sources: list[GithubPrCommentFeedbackSource | GithubPrReviewCommentFeedbackSource] = []
    for feedback in parse_feedback(raw):
        if isinstance(
            feedback.source,
            (GithubPrCommentFeedbackSource, GithubPrReviewCommentFeedbackSource),
        ):
            sources.append(feedback.source)
    if not sources:
        record("no_pr_comment_sources")
        return outcomes

    rate_limit_sensitive = is_github_rate_limit_sensitive(organization.slug)
    delete_eyes = not rate_limit_sensitive

    scm_by_repo: dict[str, SourceCodeManager] = {}
    resolve_by_repo_pr: dict[tuple[str, int], list[str]] = {}
    for source in sources:
        comment_id = source.comment.id
        if comment_id is None:
            record("no_comment_id")
            continue

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

        source_type = source.type
        if source_type == "github-pr-comment":
            _add_comment_reaction(
                scm,
                source_type=source_type,
                pr_number=pr_number,
                comment_id=comment_id,
                reaction="hooray",
            )
            record("reacted")
        elif source_type == "github-pr-review-comment" and not rate_limit_sensitive:
            unique_id = getattr(source.comment, "unique_id", None)
            if unique_id is None:
                record("resolve_no_unique_id")
            else:
                resolve_by_repo_pr.setdefault((repo_name, pr_number), []).append(unique_id)
        if delete_eyes:
            _delete_own_comment_eyes_reaction(
                scm,
                source_type=source_type,
                pr_number=pr_number,
                comment_id=comment_id,
            )

    if rate_limit_sensitive and any(
        source.type == "github-pr-review-comment" for source in sources
    ):
        record("resolve_rate_limited")

    for (repo_name, pr_number), unique_ids in resolve_by_repo_pr.items():
        log_extra = {
            "run_id": run_id,
            "organization_id": organization.id,
            "repo_name": repo_name,
            "pr_number": pr_number,
            "comment_count": len(unique_ids),
        }
        try:
            result = _resolve_review_comment_threads(
                scm_by_repo[repo_name],
                pr_number=pr_number,
                comment_unique_ids=unique_ids,
            )
        except UnsupportedProviderError:
            logger.warning(
                "autofix.on_completion_hook.completion_reaction.resolve_unsupported_provider",
                extra=log_extra,
                exc_info=True,
            )
            record("resolve_unsupported_provider")
            continue
        except Exception:
            logger.exception(
                "autofix.on_completion_hook.completion_reaction.resolve_failed",
                extra=log_extra,
            )
            record("resolve_failed")
            continue

        resolve_outcomes = {
            "resolved": result.resolved,
            "resolve_skipped_already_resolved": result.already_resolved,
            "resolve_thread_not_found": result.not_found,
        }
        for outcome, amount in resolve_outcomes.items():
            if amount:
                record(outcome, amount)

    return outcomes
