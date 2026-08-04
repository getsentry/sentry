"""Request a human review on a Seer-authored PR once its CI is green.

Called from the check-suite listener after ``bootstrap_green_check_suite``.
This module owns the review-request side effect: pick a reviewer, call SCM,
and record a ``review_requests`` marker.

That marker (+ lock) avoids duplicate GitHub calls *and* re-pinging: requesting
review again after an approve/dismiss clears ``requested_reviewers`` creates a
new ``ReviewRequestedEvent`` and notifies the human. Later green suites for the
same run must not do that. (Undraft's ``ready_for_review`` marker is sticky for
the run+repo so human re-drafts on later heads are left alone.)

Terminal skips that will never request (``pr_not_open``, ``no_candidates``)
also write a sticky marker with ``skipped: true`` so the green-path SCM
short-circuit (both markers set) can fire. Request failures leave the marker
unset so the next green event retries.

The ready-for-review marker is intentionally *not* a gate here — undraft and
review-request succeed/fail/retry independently.
"""

from __future__ import annotations

import logging
from typing import Any

from django.utils import timezone
from scm import actions as scm_actions
from scm.types import RequestReviewProtocol

from sentry.locks import locks
from sentry.seer.autofix.pr_iteration.check_suites import (
    REVIEW_REQUESTS_EXTRA,
    GreenCheckSuiteContext,
)
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


def _record_review_request_skip_marker(
    seer_run: SeerRun,
    repo_name: str,
    *,
    head_sha: str,
    reason: str,
) -> None:
    """Sticky "done, never requesting" marker for terminal skips.

    Same ``review_requests`` key as a successful request so the green-path
    SCM short-circuit (both markers present) still fires. Shape is distinct
    (``skipped`` + ``reason``) so analytics can tell skip-complete from
    request-complete.
    """
    record_run_marker(
        seer_run,
        REVIEW_REQUESTS_EXTRA,
        repo_name,
        {
            "skipped_at": timezone.now().isoformat(),
            "head_sha": head_sha,
            "skipped": True,
            "reason": reason,
        },
    )


def request_review_from_context(ctx: GreenCheckSuiteContext) -> None:
    """Request review for an already-confirmed green tip (own lock + marker)."""
    resolved = ctx.resolved
    if _review_request_marker(resolved.seer_run, resolved.repo_name):
        _skip("already_requested", resolved.log_extra)
        return

    if not isinstance(ctx.scm, RequestReviewProtocol):
        _skip("unsupported_provider", resolved.log_extra)
        return

    if ctx.pull_request["data"]["state"] != "open" or ctx.pull_request["data"]["merged"]:
        # Sticky: closed/merged PRs will not become requestable on later greens.
        _record_review_request_skip_marker(
            resolved.seer_run,
            resolved.repo_name,
            head_sha=ctx.head_sha,
            reason="pr_not_open",
        )
        _skip("pr_not_open", resolved.log_extra)
        return

    raw_pr = ctx.pull_request["raw"]["data"] or {}
    # Bootstrap snapshot: taken before ``mark_ready_for_review`` undrafts.
    # TODO(race): Undraft can make GitHub CODEOWNERS-request reviewers after
    # this snapshot. There is no public API for the draft "will be requested"
    # preview; refetching PR files + parsing CODEOWNERS on every green suite
    # is expensive. Alternatives to explore: (1) reuse ownership grammar /
    # ``codeowners_match`` to resolve owners from base CODEOWNERS + PR files
    # and treat that as preexisting, (2) wait/poll to attenuate the race, or
    # (3) handle ``pull_request.review_requested`` retrospectively and skip /
    # undo a duplicate Seer ping. Until then we only see reviewers already on
    # the pre-undraft PR (often empty for drafts).
    requested_logins = {
        reviewer["login"].lower()
        for reviewer in (raw_pr.get("requested_reviewers") or [])
        if isinstance(reviewer, dict) and reviewer.get("login")
    }

    # Computed only now — lazily at decision time — because most green events
    # return before this point and the sources go stale.
    pr_author = (raw_pr.get("user") or {}).get("login")
    candidates = collect_reviewer_candidates(
        organization=resolved.organization,
        seer_run=resolved.seer_run,
        exclude_logins={pr_author} if pr_author else (),
        log_extra=resolved.log_extra,
    )
    metrics.incr(
        "autofix.pr_iteration.reviewer_candidates.computed",
        tags={"top_source": candidates[0].source if candidates else "none"},
    )
    if not candidates:
        # Sticky: night-shift / no-user runs will not grow candidates later.
        _record_review_request_skip_marker(
            resolved.seer_run,
            resolved.repo_name,
            head_sha=ctx.head_sha,
            reason="no_candidates",
        )
        _skip("no_candidates", resolved.log_extra)
        return

    # A suite completes once per app/workflow, so several green events can race
    # for the same head. Wait for the lock holder rather than dropping: after
    # the wait the marker re-check settles it — holder succeeded means we skip,
    # holder's request failed (marker unset) means this event retries.
    lock = locks.get(
        f"autofix:pr_iteration:review_request:{resolved.seer_run.id}",
        duration=30,
        name="autofix_pr_review_request",
    )
    requested_candidate: ReviewerCandidate | None = None
    try:
        with lock.blocking_acquire(initial_delay=0.5, timeout=10):
            resolved.seer_run.refresh_from_db()
            if _review_request_marker(resolved.seer_run, resolved.repo_name):
                _skip("already_requested", resolved.log_extra)
                return

            # Persist the ranked list with provenance: fallbacks for later
            # re-request, and the data to measure which source's reviewers
            # actually respond.
            record_reviewer_candidates_marker(
                resolved.seer_run,
                resolved.repo_name,
                head_sha=ctx.head_sha,
                candidates=candidates,
            )

            if any(c.login.lower() in requested_logins for c in candidates):
                # Someone we would pick is already on the hook — e.g. a
                # CODEOWNERS auto-request that landed before bootstrap. Record
                # it so later green events short-circuit on the marker
                # pre-check, and don't rebuild the bystander effect by adding
                # a second person. (Post-undraft CODEOWNERS: see TODO above.)
                _record_review_request_marker(
                    resolved.seer_run,
                    resolved.repo_name,
                    head_sha=ctx.head_sha,
                    reviewers=sorted(requested_logins),
                    preexisting=True,
                )
                _skip("already_a_reviewer", resolved.log_extra)
                return

            for candidate in candidates[:MAX_REQUEST_ATTEMPTS]:
                try:
                    scm_actions.request_review(ctx.scm, str(resolved.pr_number), [candidate.login])
                    requested_candidate = candidate
                    break
                except Exception:
                    # E.g. the login has no access to this repo; a
                    # lower-ranked candidate may still be requestable.
                    _failed(
                        "request_review_failed",
                        {
                            **resolved.log_extra,
                            "pr_number": resolved.pr_number,
                            "source": candidate.source,
                        },
                    )
            if requested_candidate is None:
                # Leave the marker unset so the next green event can retry.
                return

            _record_review_request_marker(
                resolved.seer_run,
                resolved.repo_name,
                head_sha=ctx.head_sha,
                reviewers=[requested_candidate.login],
            )
    except SeerRun.DoesNotExist:
        # The run was deleted between our lookup and the marker write (e.g.
        # cleanup); nothing is left to mark or dedupe against.
        _skip("run_deleted", resolved.log_extra)
        return
    except UnableToAcquireLock:
        _skip("locked", resolved.log_extra)
        return

    metrics.incr(
        "autofix.pr_iteration.review_request.requested",
        tags={"source": requested_candidate.source},
    )
    logger.info(
        "autofix.pr_iteration.review_request.requested",
        extra={
            **resolved.log_extra,
            "pr_number": resolved.pr_number,
            "reviewers": [requested_candidate.login],
        },
    )
