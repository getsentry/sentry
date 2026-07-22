"""Request a human review on a Seer-authored PR once its CI is green.

A review request from Seer must always mean "CI is green, ready to judge" so
that its requests stay trustworthy. CI green confirmation is owned by
``ci_green.mark_ci_green_for_check_suite`` (runs first in the check-suite
listener); this module only requests a review when that marker is present for
the PR's current head.

We ask the best reviewer candidate (see ``reviewer_candidates``) — today
the user who triggered the run, the person most invested in the fix
landing.
"""

from __future__ import annotations

import logging
from typing import Any

from django.utils import timezone
from scm import actions as scm_actions
from scm.types import RequestReviewProtocol

from sentry.locks import locks
from sentry.scm.types import CheckSuiteEvent
from sentry.seer.autofix.pr_iteration.check_suites import (
    GREEN_CONCLUSIONS,
    bootstrap_green_check_suite,
)
from sentry.seer.autofix.pr_iteration.ci_green import is_ci_green_for_head
from sentry.seer.autofix.pr_iteration.constants import REVIEW_REQUEST_FLAG
from sentry.seer.autofix.pr_iteration.reviewer_candidates import (
    ReviewerCandidate,
    collect_reviewer_candidates,
    record_reviewer_candidates_marker,
)
from sentry.seer.autofix.pr_iteration.run_markers import get_run_marker, record_run_marker
from sentry.seer.models.run import SeerRun
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger(__name__)

# Re-export for listeners/tests that historically imported this from here.
__all__ = (
    "GREEN_CONCLUSIONS",
    "REVIEW_REQUEST_FLAG",
    "REVIEW_REQUESTS_EXTRA",
    "request_review_for_green_check_suite",
)

# SeerRun.extras key holding review-request markers, keyed by repo full name
# (a run can open PRs in several repos). Each marker records requested_at,
# head_sha, and reviewers so double-fires never re-ping a human and later
# re-request logic can compare heads.
REVIEW_REQUESTS_EXTRA = "review_requests"

# How many candidates to try when a request fails (e.g. the provider rejects
# a login without repo access) before giving up until the next green event.
MAX_REQUEST_ATTEMPTS = 3


def _skip(reason: str, log_extra: dict[str, Any]) -> None:
    metrics.incr("autofix.pr_iteration.review_request.skipped", tags={"reason": reason})
    logger.info(
        "autofix.pr_iteration.review_request.skipped", extra={**log_extra, "reason": reason}
    )


def _failed(reason: str, log_extra: dict[str, Any]) -> None:
    """Record an unexpected failure (vs. a `_skip`, which is an expected condition)."""
    metrics.incr("autofix.pr_iteration.review_request.failed", tags={"reason": reason})
    logger.warning(
        "autofix.pr_iteration.review_request.failed",
        extra={**log_extra, "reason": reason},
        exc_info=True,
    )


def _review_request_marker(seer_run: SeerRun, repo_name: str) -> dict[str, Any] | None:
    return get_run_marker(seer_run, REVIEW_REQUESTS_EXTRA, repo_name)


def _record_review_request_marker(
    seer_run: SeerRun,
    repo_name: str,
    *,
    head_sha: str,
    reviewers: list[str],
    preexisting: bool = False,
) -> None:
    """Write the per-repo marker; caller must hold the run's review-request lock.

    ``preexisting`` records that the reviewers were already requested by someone
    else (e.g. a CODEOWNERS auto-request) rather than by us.
    """
    marker: dict[str, Any] = {
        "requested_at": timezone.now().isoformat(),
        "head_sha": head_sha,
        "reviewers": reviewers,
    }
    if preexisting:
        marker["preexisting"] = True
    record_run_marker(seer_run, REVIEW_REQUESTS_EXTRA, repo_name, marker)


def request_review_for_green_check_suite(check_suite_event: CheckSuiteEvent) -> None:
    """Entry point from the check-suite listener for green suite conclusions."""
    ctx = bootstrap_green_check_suite(check_suite_event, metric_namespace="review_request")
    if ctx is None:
        return

    if _review_request_marker(ctx.seer_run, ctx.repo_name):
        _skip("already_requested", ctx.log_extra)
        return

    if not isinstance(ctx.scm, RequestReviewProtocol):
        _skip("unsupported_provider", ctx.log_extra)
        return

    # CI green confirmation lives in ``mark_ci_green_for_check_suite`` (runs
    # first in the listener). Never request a review without that marker for
    # the current head — that keeps "Seer asked for review" == "CI is green".
    if not is_ci_green_for_head(ctx.seer_run, ctx.repo_name, ctx.head_sha):
        _skip("ci_not_green", ctx.log_extra)
        return

    if ctx.pull_request["data"]["state"] != "open" or ctx.pull_request["data"]["merged"]:
        _skip("pr_not_open", ctx.log_extra)
        return

    raw_pr = ctx.pull_request["raw"]["data"] or {}
    requested_logins = {
        reviewer["login"].lower()
        for reviewer in (raw_pr.get("requested_reviewers") or [])
        if isinstance(reviewer, dict) and reviewer.get("login")
    }

    # Computed only now — lazily at decision time — because most green events
    # return before this point and the sources go stale.
    pr_author = (raw_pr.get("user") or {}).get("login")
    candidates = collect_reviewer_candidates(
        organization=ctx.organization,
        seer_run=ctx.seer_run,
        exclude_logins={pr_author} if pr_author else (),
        log_extra=ctx.log_extra,
    )
    metrics.incr(
        "autofix.pr_iteration.reviewer_candidates.computed",
        tags={"top_source": candidates[0].source if candidates else "none"},
    )
    if not candidates:
        _skip("no_candidates", ctx.log_extra)
        return

    # A suite completes once per app/workflow, so several green events can race
    # for the same head. Wait for the lock holder rather than dropping: after
    # the wait the marker re-check settles it — holder succeeded means we skip,
    # holder's request failed (marker unset) means this event retries.
    lock = locks.get(
        f"autofix:pr_iteration:review_request:{ctx.seer_run.id}",
        duration=30,
        name="autofix_pr_review_request",
    )
    requested_candidate: ReviewerCandidate | None = None
    try:
        with lock.blocking_acquire(initial_delay=0.5, timeout=10):
            ctx.seer_run.refresh_from_db()
            if _review_request_marker(ctx.seer_run, ctx.repo_name):
                _skip("already_requested", ctx.log_extra)
                return

            # Persist the ranked list with provenance: fallbacks for later
            # re-request, and the data to measure which source's reviewers
            # actually respond.
            record_reviewer_candidates_marker(
                ctx.seer_run,
                ctx.repo_name,
                head_sha=ctx.head_sha,
                candidates=candidates,
            )

            if any(c.login.lower() in requested_logins for c in candidates):
                # Someone we would pick is already on the hook — e.g. a
                # CODEOWNERS auto-request. Record it so later green events
                # short-circuit on the marker pre-check, and don't rebuild the
                # bystander effect by adding a second person.
                _record_review_request_marker(
                    ctx.seer_run,
                    ctx.repo_name,
                    head_sha=ctx.head_sha,
                    reviewers=sorted(requested_logins),
                    preexisting=True,
                )
                _skip("already_a_reviewer", ctx.log_extra)
                return

            for candidate in candidates[:MAX_REQUEST_ATTEMPTS]:
                try:
                    scm_actions.request_review(ctx.scm, str(ctx.pr_number), [candidate.login])
                    requested_candidate = candidate
                    break
                except Exception:
                    # E.g. the login has no access to this repo; a
                    # lower-ranked candidate may still be requestable.
                    _failed(
                        "request_review_failed",
                        {
                            **ctx.log_extra,
                            "pr_number": ctx.pr_number,
                            "source": candidate.source,
                        },
                    )
            if requested_candidate is None:
                # Leave the marker unset so the next green event can retry.
                return

            _record_review_request_marker(
                ctx.seer_run,
                ctx.repo_name,
                head_sha=ctx.head_sha,
                reviewers=[requested_candidate.login],
            )
    except SeerRun.DoesNotExist:
        # The run was deleted between our lookup and the marker write (e.g.
        # cleanup); nothing is left to mark or dedupe against.
        _skip("run_deleted", ctx.log_extra)
        return
    except UnableToAcquireLock:
        _skip("locked", ctx.log_extra)
        return

    metrics.incr(
        "autofix.pr_iteration.review_request.requested",
        tags={"source": requested_candidate.source},
    )
    logger.info(
        "autofix.pr_iteration.review_request.requested",
        extra={
            **ctx.log_extra,
            "pr_number": ctx.pr_number,
            "reviewers": [requested_candidate.login],
        },
    )
