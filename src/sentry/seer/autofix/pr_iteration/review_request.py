"""Request a human review on a Seer-authored PR once its CI is green.

A review request from Seer must always mean "CI is green, ready to judge" so
that its requests stay trustworthy. We therefore only request a review after
every check run on the PR's current head has completed without failures.

We ask the best reviewer candidate (see ``reviewer_candidates``) — today
the user who triggered the run, the person most invested in the fix
landing.
"""

from __future__ import annotations

import logging
from typing import Any

import orjson
import sentry_sdk
from django.utils import timezone
from pydantic import ValidationError
from scm import actions as scm_actions
from scm.types import GetPullRequestProtocol, RequestReviewProtocol

from sentry import features
from sentry.locks import locks
from sentry.models.organization import Organization
from sentry.scm.types import CheckSuiteEvent
from sentry.seer.autofix.pr_iteration.check_suites import (
    GithubCheckSuiteEvent,
    check_suite_head_match,
    resolve_check_suite_autofix_run,
    resolve_check_suite_repositories,
    sweep_check_runs,
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

# Check-suite conclusions that can complete a fully green head. The suite event
# is only the trigger — the check-runs sweep across all of the head's suites is
# what actually confirms the PR is green.
GREEN_CONCLUSIONS = ("success", "neutral", "skipped")

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
    try:
        raw = orjson.loads(check_suite_event.subscription_event["event"])
        event = GithubCheckSuiteEvent.parse_obj(raw)
    except (orjson.JSONDecodeError, ValidationError, TypeError, ValueError) as e:
        # Malformed webhook payload — report and drop; do not fail the listener task.
        sentry_sdk.capture_exception(e)
        return

    # Green suites fire for every commit on every PR in every connected repo,
    # so gate on the flag (DB/cache only) before any Seer run lookup.
    organizations: dict[int, Organization] = {}
    flagged_repos = []
    for repo in resolve_check_suite_repositories(event):
        organization = organizations.get(repo.organization_id)
        if organization is None:
            try:
                organization = Organization.objects.get_from_cache(id=repo.organization_id)
            except Organization.DoesNotExist:
                continue
            organizations[repo.organization_id] = organization
        if features.has("organizations:autofix-pr-iteration-review-request", organization):
            flagged_repos.append(repo)
    if not flagged_repos:
        return

    autofix_run = resolve_check_suite_autofix_run(event, flagged_repos)
    # Sizes the funnel: of green events in flagged orgs, how many are Seer PRs.
    metrics.incr(
        "autofix.pr_iteration.review_request.run_resolved",
        tags={"found": str(autofix_run is not None).lower()},
    )
    if autofix_run is None:
        # Expected: webhooks fan out to every region, so a missing run usually
        # just means this region doesn't own the Autofix session.
        return
    organization = organizations[autofix_run.repository.organization_id]

    log_extra: dict[str, Any] = {
        "organization_id": autofix_run.repository.organization_id,
        "repo_id": autofix_run.repository.id,
        "run_id": autofix_run.run_state.run_id,
        "pr_id": autofix_run.pr_id,
    }

    head_match = check_suite_head_match(event, autofix_run.run_state)
    if not head_match.matched or not head_match.head_sha or not head_match.repo_name:
        # A green result for an older commit says nothing about the current head.
        _skip("stale_head", {**log_extra, "head_sha": head_match.head_sha})
        return

    seer_run = SeerRun.objects.filter(
        seer_run_state_id=autofix_run.run_state.run_id, organization=organization
    ).first()
    if seer_run is None:
        # Legacy runs predating SeerRun mirroring have no row to hold the marker.
        _skip("no_seer_run", log_extra)
        return
    if _review_request_marker(seer_run, head_match.repo_name):
        _skip("already_requested", log_extra)
        return

    pr_state = autofix_run.run_state.repo_pr_states.get(head_match.repo_name)
    pr_number = pr_state.pr_number if pr_state else None
    if pr_number is None:
        _skip("no_pr_number", log_extra)
        return

    # Importing the SCM factory while the check-suite listener module is
    # initialized pulls in integration handlers before options init.
    from sentry.scm.factory import new as make_scm

    try:
        scm = make_scm(organization.id, autofix_run.repository.id, referrer="seer")
    except Exception:
        _failed("scm_init_failed", log_extra)
        return

    sweep = sweep_check_runs(scm, head_match.head_sha, log_extra=log_extra)
    if sweep is None:
        # Couldn't confirm the head is green — never request a review on uncertainty.
        _skip("sweep_failed", log_extra)
        return
    if not sweep.is_green:
        _skip(
            "not_green",
            {**log_extra, "incomplete_count": sweep.incomplete, "failed_count": sweep.failed},
        )
        return

    if not isinstance(scm, GetPullRequestProtocol) or not isinstance(scm, RequestReviewProtocol):
        _skip("unsupported_provider", log_extra)
        return

    try:
        pull_request = scm_actions.get_pull_request(scm, str(pr_number))
    except Exception:
        _failed("get_pull_request_failed", {**log_extra, "pr_number": pr_number})
        return

    if pull_request["data"]["state"] != "open" or pull_request["data"]["merged"]:
        _skip("pr_not_open", log_extra)
        return

    raw_pr = pull_request["raw"]["data"] or {}
    requested_logins = {
        reviewer["login"].lower()
        for reviewer in (raw_pr.get("requested_reviewers") or [])
        if isinstance(reviewer, dict) and reviewer.get("login")
    }

    # Computed only now — lazily at decision time — because most green events
    # return before this point and the sources go stale.
    pr_author = (raw_pr.get("user") or {}).get("login")
    candidates = collect_reviewer_candidates(
        organization=organization,
        seer_run=seer_run,
        exclude_logins={pr_author} if pr_author else (),
        log_extra=log_extra,
    )
    metrics.incr(
        "autofix.pr_iteration.reviewer_candidates.computed",
        tags={"top_source": candidates[0].source if candidates else "none"},
    )
    if not candidates:
        _skip("no_candidates", log_extra)
        return

    # A suite completes once per app/workflow, so several green events can race
    # for the same head. Wait for the lock holder rather than dropping: after
    # the wait the marker re-check settles it — holder succeeded means we skip,
    # holder's request failed (marker unset) means this event retries.
    lock = locks.get(
        f"autofix:pr_iteration:review_request:{seer_run.id}",
        duration=30,
        name="autofix_pr_review_request",
    )
    requested_candidate: ReviewerCandidate | None = None
    try:
        with lock.blocking_acquire(initial_delay=0.5, timeout=10):
            seer_run.refresh_from_db()
            if _review_request_marker(seer_run, head_match.repo_name):
                _skip("already_requested", log_extra)
                return

            # Persist the ranked list with provenance: fallbacks for later
            # re-request, and the data to measure which source's reviewers
            # actually respond.
            record_reviewer_candidates_marker(
                seer_run,
                head_match.repo_name,
                head_sha=head_match.head_sha,
                candidates=candidates,
            )

            if any(c.login.lower() in requested_logins for c in candidates):
                # Someone we would pick is already on the hook — e.g. a
                # CODEOWNERS auto-request. Record it so later green events
                # short-circuit on the marker pre-check, and don't rebuild the
                # bystander effect by adding a second person.
                _record_review_request_marker(
                    seer_run,
                    head_match.repo_name,
                    head_sha=head_match.head_sha,
                    reviewers=sorted(requested_logins),
                    preexisting=True,
                )
                _skip("already_a_reviewer", log_extra)
                return

            for candidate in candidates[:MAX_REQUEST_ATTEMPTS]:
                try:
                    scm_actions.request_review(scm, str(pr_number), [candidate.login])
                    requested_candidate = candidate
                    break
                except Exception:
                    # E.g. the login has no access to this repo; a
                    # lower-ranked candidate may still be requestable.
                    _failed(
                        "request_review_failed",
                        {**log_extra, "pr_number": pr_number, "source": candidate.source},
                    )
            if requested_candidate is None:
                # Leave the marker unset so the next green event can retry.
                return

            _record_review_request_marker(
                seer_run,
                head_match.repo_name,
                head_sha=head_match.head_sha,
                reviewers=[requested_candidate.login],
            )
    except SeerRun.DoesNotExist:
        # The run was deleted between our lookup and the marker write (e.g.
        # cleanup); nothing is left to mark or dedupe against.
        _skip("run_deleted", log_extra)
        return
    except UnableToAcquireLock:
        _skip("locked", log_extra)
        return

    metrics.incr(
        "autofix.pr_iteration.review_request.requested",
        tags={"source": requested_candidate.source},
    )
    logger.info(
        "autofix.pr_iteration.review_request.requested",
        extra={**log_extra, "pr_number": pr_number, "reviewers": [requested_candidate.login]},
    )
