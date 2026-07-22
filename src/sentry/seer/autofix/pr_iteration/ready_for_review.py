"""Undraft a Seer-authored PR once its tip is confirmed green.

Called from the check-suite listener after ``bootstrap_green_check_suite``.
Own lock + ``ready_for_review`` marker — unlike ``review_requests``, these only
skip duplicate GitHub undraft calls (undraft is idempotent when already ready).
Review-request's marker also prevents re-pinging on later green suites.

Not a gate for requesting review; the two side effects are independent.
GitHub-only today (``MarkPullRequestDraftStateProtocol``).
"""

from __future__ import annotations

import logging
from typing import Any

from django.utils import timezone
from scm import actions as scm_actions
from scm.types import MarkPullRequestDraftStateProtocol

from sentry.locks import locks
from sentry.seer.autofix.pr_iteration.check_suites import GreenCheckSuiteContext
from sentry.seer.autofix.pr_iteration.run_markers import get_run_marker, record_run_marker
from sentry.seer.models.run import SeerRun
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger(__name__)

# SeerRun.extras key: we successfully undrafted this head. Cheap skip for later
# green events — not needed for product correctness (undraft is idempotent).
READY_FOR_REVIEW_EXTRA = "ready_for_review"


def _skip(reason: str, log_extra: dict[str, Any]) -> None:
    metrics.incr("autofix.pr_iteration.ready_for_review.skipped", tags={"reason": reason})
    logger.info(
        "autofix.pr_iteration.ready_for_review.skipped",
        extra={**log_extra, "reason": reason},
    )


def _failed(reason: str, log_extra: dict[str, Any]) -> None:
    metrics.incr("autofix.pr_iteration.ready_for_review.failed", tags={"reason": reason})
    logger.warning(
        "autofix.pr_iteration.ready_for_review.failed",
        extra={**log_extra, "reason": reason},
        exc_info=True,
    )


def get_ready_for_review_marker(seer_run: SeerRun, repo_name: str) -> dict[str, Any] | None:
    return get_run_marker(seer_run, READY_FOR_REVIEW_EXTRA, repo_name)


def is_ready_for_review_for_head(seer_run: SeerRun, repo_name: str, head_sha: str) -> bool:
    marker = get_ready_for_review_marker(seer_run, repo_name)
    return marker is not None and marker.get("head_sha") == head_sha


def record_ready_for_review_marker(seer_run: SeerRun, repo_name: str, *, head_sha: str) -> None:
    record_run_marker(
        seer_run,
        READY_FOR_REVIEW_EXTRA,
        repo_name,
        {"marked_at": timezone.now().isoformat(), "head_sha": head_sha},
    )


def mark_ready_for_review(ctx: GreenCheckSuiteContext) -> None:
    """Undraft the PR for ``ctx.head_sha``.

    Lock + marker only avoid racing / repeating the GitHub undraft call.
    Stale-head filtering is done once in bootstrap (same as review-request).
    """
    if not isinstance(ctx.scm, MarkPullRequestDraftStateProtocol):
        # GitHub-only for now; review-request can still proceed without undraft.
        _skip("unsupported_provider", ctx.log_extra)
        return

    if is_ready_for_review_for_head(ctx.seer_run, ctx.repo_name, ctx.head_sha):
        # Already undrafted this head — skip another API call. Manual re-draft
        # of the same head is left alone (human owns it).
        _skip("already_marked", ctx.log_extra)
        return

    # Serialize concurrent green events so only one undraft call runs; the
    # marker then skips further events without hitting GitHub again.
    lock = locks.get(
        f"autofix:pr_iteration:ready_for_review:{ctx.seer_run.id}",
        duration=30,
        name="autofix_pr_ready_for_review",
    )
    try:
        with lock.blocking_acquire(initial_delay=0.5, timeout=10):
            ctx.seer_run.refresh_from_db()
            if is_ready_for_review_for_head(ctx.seer_run, ctx.repo_name, ctx.head_sha):
                _skip("already_marked", ctx.log_extra)
                return

            try:
                scm_actions.mark_pull_request_ready_for_review(ctx.scm, str(ctx.pr_number))
            except Exception:
                _failed("mark_ready_failed", {**ctx.log_extra, "pr_number": ctx.pr_number})
                return

            record_ready_for_review_marker(ctx.seer_run, ctx.repo_name, head_sha=ctx.head_sha)
            metrics.incr("autofix.pr_iteration.ready_for_review.marked")
            logger.info(
                "autofix.pr_iteration.ready_for_review.marked",
                extra={**ctx.log_extra, "head_sha": ctx.head_sha, "pr_number": ctx.pr_number},
            )
    except SeerRun.DoesNotExist:
        _skip("run_deleted", ctx.log_extra)
    except UnableToAcquireLock:
        _skip("locked", ctx.log_extra)
