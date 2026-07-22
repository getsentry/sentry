"""Detect when a Seer PR's CI is green, undraft it, and record that on the run.

Green check-suite webhooks are the trigger; a sweep across every check run on
the PR's current head is the confirmation. Once confirmed we:

1. Mark the PR ready for review (no-op if already undrafted).
2. Persist a durable ``ci_green`` marker on ``SeerRun.extras`` (keyed by repo),
   so review-request can trust "CI is green for this head" without re-sweeping.

The marker is written only after a successful undraft — same pattern as
review-request — so a failed SCM call leaves the marker unset and the next
green event retries.

Undraft requires ``MarkPullRequestDraftStateProtocol`` (GitHub-only today).
Other providers skip as unsupported until they implement it.

Gated by ``REVIEW_REQUEST_FLAG`` (same flag as draft-on-create and requesting
review).
"""

from __future__ import annotations

import logging
from typing import Any

from django.utils import timezone
from scm import actions as scm_actions
from scm.types import MarkPullRequestDraftStateProtocol

from sentry import features
from sentry.locks import locks
from sentry.models.organization import Organization
from sentry.scm.types import CheckSuiteEvent
from sentry.seer.autofix.pr_iteration.check_suites import (
    bootstrap_green_check_suite,
    sweep_check_runs,
)
from sentry.seer.autofix.pr_iteration.constants import REVIEW_REQUEST_FLAG
from sentry.seer.autofix.pr_iteration.run_markers import get_run_marker, record_run_marker
from sentry.seer.models.run import SeerRun
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger(__name__)

# SeerRun.extras key holding CI-green markers, keyed by repo full name.
CI_GREEN_EXTRA = "ci_green"


def _skip(reason: str, log_extra: dict[str, Any]) -> None:
    metrics.incr("autofix.pr_iteration.ci_green.skipped", tags={"reason": reason})
    logger.info("autofix.pr_iteration.ci_green.skipped", extra={**log_extra, "reason": reason})


def _failed(reason: str, log_extra: dict[str, Any]) -> None:
    metrics.incr("autofix.pr_iteration.ci_green.failed", tags={"reason": reason})
    logger.warning(
        "autofix.pr_iteration.ci_green.failed",
        extra={**log_extra, "reason": reason},
        exc_info=True,
    )


def should_open_autofix_pr_as_draft(organization: Organization) -> bool:
    """Open Autofix PRs as draft when the review-request / CI-green flow is enabled."""
    return features.has(REVIEW_REQUEST_FLAG, organization)


def get_ci_green_marker(seer_run: SeerRun, repo_name: str) -> dict[str, Any] | None:
    return get_run_marker(seer_run, CI_GREEN_EXTRA, repo_name)


def is_ci_green_for_head(seer_run: SeerRun, repo_name: str, head_sha: str) -> bool:
    marker = get_ci_green_marker(seer_run, repo_name)
    return marker is not None and marker.get("head_sha") == head_sha


def record_ci_green_marker(seer_run: SeerRun, repo_name: str, *, head_sha: str) -> None:
    record_run_marker(
        seer_run,
        CI_GREEN_EXTRA,
        repo_name,
        {"marked_at": timezone.now().isoformat(), "head_sha": head_sha},
    )


def mark_ci_green_for_check_suite(check_suite_event: CheckSuiteEvent) -> None:
    """Entry point from the check-suite listener for green suite conclusions."""
    ctx = bootstrap_green_check_suite(check_suite_event, metric_namespace="ci_green")
    if ctx is None:
        return

    # Draft/undraft is GitHub-only until other providers implement the protocol.
    if not isinstance(ctx.scm, MarkPullRequestDraftStateProtocol):
        _skip("unsupported_provider", ctx.log_extra)
        return

    # Already confirmed for this head. If someone re-drafts the same head
    # manually we leave it alone — ownership transferred to the human.
    if is_ci_green_for_head(ctx.seer_run, ctx.repo_name, ctx.head_sha):
        _skip("already_marked", ctx.log_extra)
        return

    sweep = sweep_check_runs(ctx.scm, ctx.head_sha, log_extra=ctx.log_extra)
    if sweep is None:
        _skip("sweep_failed", ctx.log_extra)
        return
    if not sweep.is_green:
        _skip(
            "not_green",
            {
                **ctx.log_extra,
                "incomplete_count": sweep.incomplete,
                "failed_count": sweep.failed,
            },
        )
        return

    # Several green suite events can race for the same head. Wait for the lock
    # holder rather than dropping: after the wait the marker re-check settles
    # it — holder succeeded means we skip, holder's undraft failed (marker
    # unset) means this event retries.
    lock = locks.get(
        f"autofix:pr_iteration:ci_green:{ctx.seer_run.id}",
        duration=30,
        name="autofix_pr_ci_green",
    )
    try:
        with lock.blocking_acquire(initial_delay=0.5, timeout=10):
            ctx.seer_run.refresh_from_db()
            if is_ci_green_for_head(ctx.seer_run, ctx.repo_name, ctx.head_sha):
                _skip("already_marked", ctx.log_extra)
                return

            if not _mark_ready_with_scm(
                scm=ctx.scm, pr_number=ctx.pr_number, log_extra=ctx.log_extra
            ):
                # Leave the marker unset so the next green event can retry.
                return

            record_ci_green_marker(ctx.seer_run, ctx.repo_name, head_sha=ctx.head_sha)
            metrics.incr("autofix.pr_iteration.ci_green.marked")
            logger.info(
                "autofix.pr_iteration.ci_green.marked",
                extra={**ctx.log_extra, "head_sha": ctx.head_sha},
            )
    except SeerRun.DoesNotExist:
        _skip("run_deleted", ctx.log_extra)
    except UnableToAcquireLock:
        _skip("locked", ctx.log_extra)


def _mark_ready_with_scm(
    *,
    scm: MarkPullRequestDraftStateProtocol,
    pr_number: int,
    log_extra: dict[str, Any],
) -> bool:
    try:
        # Idempotent: no-op when the PR is already ready for review.
        scm_actions.mark_pull_request_ready_for_review(scm, str(pr_number))
    except Exception:
        _failed("mark_ready_failed", {**log_extra, "pr_number": pr_number})
        return False
    metrics.incr("autofix.pr_iteration.ci_green.marked_ready")
    logger.info(
        "autofix.pr_iteration.ci_green.marked_ready",
        extra={**log_extra, "pr_number": pr_number},
    )
    return True
