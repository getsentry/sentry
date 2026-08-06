"""CI-green handling for a Seer-authored PR: undraft it, then ask for review.

``GreenCheckSuite`` owns the whole green path. Both side effects live here
because they are only ever reached through ``handle()`` — each has its own lock
and its own sticky ``SeerRun.extras`` marker, and they succeed, fail, and retry
independently of one another.

The marker semantics differ, and the difference matters:

``ready_for_review`` only skips duplicate GitHub undraft calls. It is sticky for
the run+repo: once set (we undrafted, or saw the PR already ready), later green
events — including new head SHAs — leave draft state alone, so a human who
re-drafts after our undraft keeps ownership.

``review_requests`` additionally avoids re-pinging a human: requesting review
again after an approve/dismiss clears ``requested_reviewers`` creates a new
``ReviewRequestedEvent`` and notifies them. Later green suites for the same run
must not do that. Terminal skips that will never request (``pr_not_open``,
``no_candidates``) also write a sticky marker with ``skipped: true`` so the
green-path SCM short-circuit (both markers set) can fire; request failures leave
the marker unset so the next green event retries.

We ask the best reviewer candidate (see ``reviewer_candidates``): the user who
triggered the run — the person most invested in the fix landing — or, for runs
without a resolvable triggering user (e.g. Night Shift), the best of the
fallback sources (suspect-commit author, code owners, recent committers), which
is what makes those PRs routable at all.

GitHub-only today (``MarkPullRequestDraftStateProtocol`` /
``RequestReviewProtocol``).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from django.utils import timezone
from scm import actions as scm_actions
from scm.manager import SourceCodeManager
from scm.types import (
    ActionResult,
    GetPullRequestProtocol,
    MarkPullRequestDraftStateProtocol,
    PullRequest,
    RequestReviewProtocol,
)

from sentry import features
from sentry.locks import locks
from sentry.seer.autofix.pr_iteration.check_suites import (
    ResolvedCheckSuite,
    check_suite_matches_pr_head,
    record_check_suite_skip,
    sweep_check_runs,
)
from sentry.seer.autofix.pr_iteration.constants import REVIEW_REQUEST_FLAG
from sentry.seer.autofix.pr_iteration.queue import peek_queued_autofix_feedback
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

# SeerRun.extras keys for the two green side effects.
READY_FOR_REVIEW_EXTRA = "ready_for_review"
REVIEW_REQUESTS_EXTRA = "review_requests"

# How many candidates to try when a request fails (e.g. the provider rejects
# a login without repo access) before giving up until the next green event.
MAX_REQUEST_ATTEMPTS = 3


@dataclass(frozen=True)
class GreenCheckSuiteContext:
    """Confirmed-green tip after SCM live-head match + check-run sweep."""

    resolved: GreenCheckSuite
    scm: SourceCodeManager
    pull_request: ActionResult[PullRequest]
    head_sha: str


@dataclass(frozen=True)
class GreenCheckSuite(ResolvedCheckSuite):
    """CI passed: undraft the PR and request a human review."""

    def _markers(self) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
        """The two sticky side-effect markers for this run+repo."""
        return (
            get_run_marker(self.seer_run, READY_FOR_REVIEW_EXTRA, self.repo_name),
            get_run_marker(self.seer_run, REVIEW_REQUESTS_EXTRA, self.repo_name),
        )

    def _wants_review_side_effects(self) -> bool:
        """Whether undraft / request-review still have work to do."""
        if not features.has(REVIEW_REQUEST_FLAG, self.organization):
            return False

        ready_for_review_marker, review_request_marker = self._markers()
        return ready_for_review_marker is None or review_request_marker is None

    def _wants_deferred_iteration_recheck(self) -> bool:
        """Whether a red suite left feedback parked waiting on this suite.

        A failing suite whose sweep still saw incomplete runs defers its consume
        by an hour (``CheckSuiteFeedbackSource.should_trigger``). This suite
        completing may be the run it was waiting on, so the queue is worth
        rechecking — independently of ``REVIEW_REQUEST_FLAG``, which only gates
        the undraft / review-request side effects.
        """
        if not features.has("organizations:autofix-pr-iteration", self.organization):
            return False

        return bool(peek_queued_autofix_feedback(self.autofix_run.run_state.run_id))

    def is_relevant(self) -> bool:
        return self._wants_review_side_effects() or self._wants_deferred_iteration_recheck()

    def confirm_green(self) -> GreenCheckSuiteContext | None:
        """SCM live-head match + check-run sweep. Call only when a side effect is needed."""
        # Lazy: scm.factory pulls in the integration handlers, which cycle back
        # through notifications.platform.templates.seer (ImportError on a
        # partially initialized module if hoisted).
        from sentry.scm.factory import new as make_scm

        try:
            scm = make_scm(self.organization.id, self.autofix_run.repository.id, referrer="seer")
        except Exception:
            _failed_green("scm_init_failed", self.log_extra)
            return None

        if not isinstance(scm, GetPullRequestProtocol):
            record_check_suite_skip("green", "unsupported_provider", self.log_extra)
            return None

        try:
            pull_request = scm_actions.get_pull_request(scm, str(self.pr_number))
        except Exception:
            _failed_green(
                "get_pull_request_failed", {**self.log_extra, "pr_number": self.pr_number}
            )
            return None

        head_match = check_suite_matches_pr_head(
            self.event, pr_head_sha=pull_request["data"]["head"].get("sha")
        )
        if not head_match.matched or not head_match.head_sha:
            record_check_suite_skip(
                "green", "stale_head", {**self.log_extra, "head_sha": head_match.head_sha}
            )
            return None

        sweep = sweep_check_runs(scm, head_match.head_sha, log_extra=self.log_extra)
        if sweep is None:
            record_check_suite_skip("green", "sweep_failed", self.log_extra)
            return None
        if not sweep.is_green:
            record_check_suite_skip(
                "green",
                "not_green",
                {
                    **self.log_extra,
                    "incomplete_count": sweep.incomplete,
                    "failed_count": sweep.failed,
                },
            )
            return None

        metrics.incr("autofix.pr_iteration.green_check_suite.confirmed")
        return GreenCheckSuiteContext(
            resolved=self,
            scm=scm,
            pull_request=pull_request,
            head_sha=head_match.head_sha,
        )

    def handle(self) -> None:
        # Read markers once → skip SCM if both done → confirm green → run only
        # the missing side effects. Undraft before review-request: GitHub may
        # CODEOWNERS-request after undraft; see TODO in ``_request_review``.
        wants_review = self._wants_review_side_effects()
        wants_recheck = self._wants_deferred_iteration_recheck()
        if not wants_review and not wants_recheck:
            return None

        ready_for_review_marker, review_request_marker = self._markers()

        # The recheck runs off this suite completing, not off the PR being
        # green: a red suite's feedback is still parked when the PR as a whole
        # is failing, which is exactly the case that needs to iterate.
        if wants_recheck:
            self._retrigger_deferred_iteration()

        if not wants_review:
            return None

        ctx = self.confirm_green()
        if ctx is None:
            return None

        if ready_for_review_marker is None:
            _mark_ready_for_review(ctx)

        if review_request_marker is None:
            _request_review(ctx)

        return None

    def _retrigger_deferred_iteration(self) -> None:
        """Re-evaluate feedback a red suite parked behind still-running checks.

        ``should_trigger`` re-sweeps: if checks are *still* incomplete it defers
        again, so this only pulls the consume forward once the tip has settled.
        The consume task pops the queue under a lock and no-ops on an empty one,
        so racing an already-scheduled activation is safe.
        """
        # Lazy: tasks.seer.pr_iteration → scm.factory → github → jira client,
        # which calls absolute_uri() at import time (needs the options cache).
        from sentry.tasks.seer.pr_iteration import trigger_consume_pr_iteration_feedback

        run_state = self.autofix_run.run_state
        for item in peek_queued_autofix_feedback(run_state.run_id):
            logger.info(
                "autofix.pr_iteration.green_check_suite.retrigger_deferred_consume",
                extra={**self.log_extra, "referrer": str(item.referrer)},
            )
            trigger_consume_pr_iteration_feedback(
                run_id=run_state.run_id,
                organization_id=self.organization.id,
                feedback=item.feedback,
                run_state=run_state,
            )


def _failed_green(reason: str, log_extra: dict[str, Any]) -> None:
    metrics.incr("autofix.pr_iteration.green_check_suite.failed", tags={"reason": reason})
    logger.warning(
        "autofix.pr_iteration.green_check_suite.failed",
        extra={**log_extra, "reason": reason},
        exc_info=True,
    )


# --------------------------------------------------------------------------- #
# Side effect 1: undraft the PR.
# --------------------------------------------------------------------------- #


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


def _ready_for_review_marker(seer_run: SeerRun, repo_name: str) -> dict[str, Any] | None:
    return get_run_marker(seer_run, READY_FOR_REVIEW_EXTRA, repo_name)


def _record_ready_for_review_marker(seer_run: SeerRun, repo_name: str, *, head_sha: str) -> None:
    record_run_marker(
        seer_run,
        READY_FOR_REVIEW_EXTRA,
        repo_name,
        {"marked_at": timezone.now().isoformat(), "head_sha": head_sha},
    )


def _mark_ready_for_review(ctx: GreenCheckSuiteContext) -> None:
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

    if _ready_for_review_marker(resolved.seer_run, resolved.repo_name) is not None:
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
            if _ready_for_review_marker(resolved.seer_run, resolved.repo_name) is not None:
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


# --------------------------------------------------------------------------- #
# Side effect 2: request a human review.
# --------------------------------------------------------------------------- #


def _skip_review(reason: str, log_extra: dict[str, Any]) -> None:
    metrics.incr("autofix.pr_iteration.review_request.skipped", tags={"reason": reason})
    logger.info(
        "autofix.pr_iteration.review_request.skipped", extra={**log_extra, "reason": reason}
    )


def _failed_review(reason: str, log_extra: dict[str, Any]) -> None:
    """Record an unexpected failure (vs. a skip, which is an expected condition)."""
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


def _request_review(ctx: GreenCheckSuiteContext) -> None:
    """Request review for an already-confirmed green tip (own lock + marker)."""
    resolved = ctx.resolved
    if _review_request_marker(resolved.seer_run, resolved.repo_name):
        _skip_review("already_requested", resolved.log_extra)
        return

    if not isinstance(ctx.scm, RequestReviewProtocol):
        _skip_review("unsupported_provider", resolved.log_extra)
        return

    if ctx.pull_request["data"]["state"] != "open" or ctx.pull_request["data"]["merged"]:
        # Sticky: closed/merged PRs will not become requestable on later greens.
        _record_review_request_skip_marker(
            resolved.seer_run,
            resolved.repo_name,
            head_sha=ctx.head_sha,
            reason="pr_not_open",
        )
        _skip_review("pr_not_open", resolved.log_extra)
        return

    raw_pr = ctx.pull_request["raw"]["data"] or {}
    # ``confirm_green`` snapshot: taken before ``_mark_ready_for_review`` undrafts.
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
        repository=resolved.autofix_run.repository,
        seer_run=resolved.seer_run,
        group_id=resolved.autofix_run.group_id,
        scm=ctx.scm,
        pr_number=resolved.pr_number,
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
        _skip_review("no_candidates", resolved.log_extra)
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
                _skip_review("already_requested", resolved.log_extra)
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
                # CODEOWNERS auto-request that landed before we confirmed green.
                # Record it so later green events short-circuit on the marker
                # pre-check, and don't rebuild the bystander effect by adding
                # a second person. (Post-undraft CODEOWNERS: see TODO above.)
                _record_review_request_marker(
                    resolved.seer_run,
                    resolved.repo_name,
                    head_sha=ctx.head_sha,
                    reviewers=sorted(requested_logins),
                    preexisting=True,
                )
                _skip_review("already_a_reviewer", resolved.log_extra)
                return

            for candidate in candidates[:MAX_REQUEST_ATTEMPTS]:
                try:
                    scm_actions.request_review(ctx.scm, str(resolved.pr_number), [candidate.login])
                    requested_candidate = candidate
                    break
                except Exception:
                    # E.g. the login has no access to this repo; a
                    # lower-ranked candidate may still be requestable.
                    _failed_review(
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
        _skip_review("run_deleted", resolved.log_extra)
        return
    except UnableToAcquireLock:
        _skip_review("locked", resolved.log_extra)
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
