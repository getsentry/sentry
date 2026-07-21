"""Request a human review on a Seer-authored PR once its CI is green.

A review request from Seer must always mean "CI is green, ready to judge" so
that its requests stay trustworthy. We therefore only request a review after
every check run on the PR's current head has completed without failures, and
we request the user who triggered the run — the person most invested in the
fix landing.
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
from sentry.seer.models.run import SeerRun
from sentry.seer.utils import get_github_username_for_user
from sentry.users.services.user.service import user_service
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
    return ((seer_run.extras or {}).get(REVIEW_REQUESTS_EXTRA) or {}).get(repo_name)


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

    resolved = resolve_check_suite_autofix_run(event, flagged_repos)
    # Sizes the funnel: of green events in flagged orgs, how many are Seer PRs.
    metrics.incr(
        "autofix.pr_iteration.review_request.run_resolved",
        tags={"found": str(resolved is not None).lower()},
    )
    if resolved is None:
        # Expected: webhooks fan out to every region, so a missing run usually
        # just means this region doesn't own the Autofix session.
        return
    organization = organizations[resolved.repository.organization_id]

    log_extra: dict[str, Any] = {
        "organization_id": resolved.repository.organization_id,
        "repo_id": resolved.repository.id,
        "run_id": resolved.run_state.run_id,
        "pr_id": resolved.pr_id,
    }

    head_match = check_suite_head_match(event, resolved.run_state)
    if not head_match.matched or not head_match.head_sha or not head_match.repo_name:
        # A green result for an older commit says nothing about the current head.
        _skip("stale_head", {**log_extra, "head_sha": head_match.head_sha})
        return

    seer_run = SeerRun.objects.filter(
        seer_run_state_id=resolved.run_state.run_id, organization=organization
    ).first()
    if seer_run is None:
        # Legacy runs predating SeerRun mirroring have no row to hold the marker.
        _skip("no_seer_run", log_extra)
        return
    if seer_run.user_id is None:
        # System runs (e.g. Night Shift) have no triggering user to ask.
        _skip("no_triggering_user", log_extra)
        return
    if _review_request_marker(seer_run, head_match.repo_name):
        _skip("already_requested", log_extra)
        return

    pr_state = resolved.run_state.repo_pr_states.get(head_match.repo_name)
    pr_number = pr_state.pr_number if pr_state else None
    if pr_number is None:
        _skip("no_pr_number", log_extra)
        return

    user = user_service.get_user(user_id=seer_run.user_id)
    if user is None:
        _skip("user_not_found", log_extra)
        return
    github_login = get_github_username_for_user(user, organization.id, referrer="pr_review_request")
    if not github_login:
        _skip("no_github_login", log_extra)
        return
    # A list so future candidate selection (e.g. night-shift routing via code
    # ownership or blame) can request several users; today it's the triggering
    # user alone.
    scm_users = [github_login]

    # Importing the SCM factory while the check-suite listener module is
    # initialized pulls in integration handlers before options init.
    from sentry.scm.factory import new as make_scm

    try:
        scm = make_scm(organization.id, resolved.repository.id, referrer="seer")
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

    # Drop anyone already on the hook — e.g. a CODEOWNERS auto-request.
    raw_pr = pull_request["raw"]["data"] or {}
    requested_logins = {
        reviewer["login"].lower()
        for reviewer in (raw_pr.get("requested_reviewers") or [])
        if isinstance(reviewer, dict) and reviewer.get("login")
    }
    scm_users = [scm_user for scm_user in scm_users if scm_user.lower() not in requested_logins]
    if not scm_users:
        _skip("already_a_reviewer", log_extra)
        return

    # A suite completes once per app/workflow, so several green events can race
    # for the same head; the lock plus a marker re-check makes sure only one of
    # them pings the human.
    lock = locks.get(
        f"autofix:pr_iteration:review_request:{seer_run.id}",
        duration=30,
        name="autofix_pr_review_request",
    )
    try:
        with lock.acquire():
            seer_run.refresh_from_db()
            if _review_request_marker(seer_run, head_match.repo_name):
                _skip("already_requested", log_extra)
                return

            try:
                scm_actions.request_review(scm, str(pr_number), scm_users)
            except Exception:
                # Leave the marker unset so the next green event can retry.
                _failed("request_review_failed", {**log_extra, "pr_number": pr_number})
                return

            extras = dict(seer_run.extras or {})
            markers = dict(extras.get(REVIEW_REQUESTS_EXTRA) or {})
            markers[head_match.repo_name] = {
                "requested_at": timezone.now().isoformat(),
                "head_sha": head_match.head_sha,
                "reviewers": scm_users,
            }
            extras[REVIEW_REQUESTS_EXTRA] = markers
            seer_run.update(extras=extras)
    except UnableToAcquireLock:
        _skip("locked", log_extra)
        return

    metrics.incr("autofix.pr_iteration.review_request.requested")
    logger.info(
        "autofix.pr_iteration.review_request.requested",
        extra={**log_extra, "pr_number": pr_number},
    )
