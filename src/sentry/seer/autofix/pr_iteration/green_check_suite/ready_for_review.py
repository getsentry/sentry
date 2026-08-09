"""Green side effect 1: undraft a Seer-authored PR.

The ``ready_for_review`` marker only skips duplicate GitHub undraft calls. It is
sticky for the run+repo: once set (we undrafted, or saw the PR already ready),
later green events — including new head SHAs — leave draft state alone, so a
human who re-drafts after our undraft keeps ownership.

GitHub-only today (``MarkPullRequestDraftStateProtocol``).
"""

from __future__ import annotations

import logging
from typing import Any

from django.utils import timezone
from scm import actions as scm_actions
from scm.types import MarkPullRequestDraftStateProtocol

from sentry.locks import locks
from sentry.seer.autofix.pr_iteration.green_check_suite.context import GreenCheckSuiteContext
from sentry.seer.autofix.pr_iteration.run_markers import get_run_marker, record_run_marker
from sentry.seer.models.run import SeerRun
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger(__name__)

# SeerRun.extras key for this side effect.
READY_FOR_REVIEW_EXTRA = "ready_for_review"


def _skip_ready(reason: str, log_extra: dict[str, Any]) -> None:
    metrics.incr("autofix.pr_iteration.ready_for_review.skipped", tags={"reason": reason})
    logger.info(
        "autofix.pr_iteration.ready_for_review.skipped",
        extra={**log_extra, "reason": reason},
    )


def _failed_ready(reason: str, log_extra: dict[str, Any]) -> None:
    metrics.incr("autofix.pr_iteration.ready_for_review.failed", tags={"reason": reason})
    logger.warning(
        "autofix.pr_iteration.ready_for_review.failed",
        extra={**log_extra, "reason": reason},
        exc_info=True,
    )


def ready_for_review_marker(seer_run: SeerRun, repo_name: str) -> dict[str, Any] | None:
    return get_run_marker(seer_run, READY_FOR_REVIEW_EXTRA, repo_name)


def _record_ready_for_review_marker(seer_run: SeerRun, repo_name: str, *, head_sha: str) -> None:
    record_run_marker(
        seer_run,
        READY_FOR_REVIEW_EXTRA,
        repo_name,
        {"marked_at": timezone.now().isoformat(), "head_sha": head_sha},
    )


def mark_ready_for_review(ctx: GreenCheckSuiteContext) -> None:
    """Undraft the PR for ``ctx.head_sha``.

    Lock + sticky marker avoid racing / repeating the GitHub undraft call.
    Stale-head filtering is done once in ``confirm_green`` (same as
    review-request).
    """
    resolved = ctx.resolved
    if not isinstance(ctx.scm, MarkPullRequestDraftStateProtocol):
        # GitHub-only for now; review-request can still proceed without undraft.
        _skip_ready("unsupported_provider", resolved.log_extra)
        return

    if ready_for_review_marker(resolved.seer_run, resolved.repo_name) is not None:
        # Already handled for this run+repo (any head). Manual re-draft after
        # our undraft is left alone — human owns draft state from here.
        _skip_ready("already_marked", resolved.log_extra)
        return

    # Serialize concurrent green events so only one undraft call runs; the
    # marker then skips further events without hitting GitHub again.
    lock = locks.get(
        f"autofix:pr_iteration:ready_for_review:{resolved.seer_run.id}",
        duration=30,
        name="autofix_pr_ready_for_review",
    )
    try:
        with lock.blocking_acquire(initial_delay=0.5, timeout=10):
            resolved.seer_run.refresh_from_db()
            if ready_for_review_marker(resolved.seer_run, resolved.repo_name) is not None:
                _skip_ready("already_marked", resolved.log_extra)
                return

            # ``confirm_green`` already fetched the PR. Skip the undraft API (and
            # its internal GET) when there's nothing to do — still records the
            # sticky marker so later green suites don't keep confirming SCM.
            pr_data = ctx.pull_request["data"]
            if pr_data["state"] != "open" or pr_data["merged"]:
                _record_ready_for_review_marker(
                    resolved.seer_run, resolved.repo_name, head_sha=ctx.head_sha
                )
                _skip_ready("pr_not_open", resolved.log_extra)
                return

            raw_pr = ctx.pull_request["raw"]["data"] or {}
            if raw_pr.get("draft") is False:
                _record_ready_for_review_marker(
                    resolved.seer_run, resolved.repo_name, head_sha=ctx.head_sha
                )
                _skip_ready("not_draft", resolved.log_extra)
                return

            try:
                scm_actions.mark_pull_request_ready_for_review(ctx.scm, str(resolved.pr_number))
            except Exception:
                _failed_ready(
                    "mark_ready_failed",
                    {**resolved.log_extra, "pr_number": resolved.pr_number},
                )
                return

            _record_ready_for_review_marker(
                resolved.seer_run, resolved.repo_name, head_sha=ctx.head_sha
            )
            metrics.incr("autofix.pr_iteration.ready_for_review.marked")
            logger.info(
                "autofix.pr_iteration.ready_for_review.marked",
                extra={
                    **resolved.log_extra,
                    "head_sha": ctx.head_sha,
                    "pr_number": resolved.pr_number,
                },
            )
    except SeerRun.DoesNotExist:
        _skip_ready("run_deleted", resolved.log_extra)
    except UnableToAcquireLock:
        _skip_ready("locked", resolved.log_extra)
