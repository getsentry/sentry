"""Hand a Seer-authored PR to a human once automated CI-fix iterations run out.

When the last N PR iterations were all driven by failing check suites, the
iteration hard cap stops further automated attempts and the run would
otherwise go quiet. Instead, we assign the triggering user and post one
status comment so a human knows the PR needs their decision. We deliberately
do *not* request a review here — a review request from Seer must keep
meaning "CI is green, ready to judge".
"""

from __future__ import annotations

import logging
from typing import Any

from django.utils import timezone
from scm import actions as scm_actions
from scm.types import CreatePullRequestCommentProtocol, GetPullRequestProtocol, UpdateIssueProtocol

from sentry import features, options
from sentry.locks import locks
from sentry.models.organization import Organization
from sentry.seer.autofix.pr_iteration.check_suites import (
    CheckSuiteAutofixRun,
    GithubCheckSuiteEvent,
    check_suite_head_match,
)
from sentry.seer.autofix.pr_iteration.feedback import automated_iteration_cap_reached
from sentry.seer.autofix.pr_iteration.run_markers import get_run_marker, record_run_marker
from sentry.seer.models.run import SeerRun
from sentry.seer.utils import get_github_username_for_user
from sentry.users.services.user.service import user_service
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger(__name__)

# SeerRun.extras key holding cap-exhausted markers, keyed by repo full name
# (a run can open PRs in several repos). Each marker records what reached the
# human for one head, so duplicate suite events never re-ping them but a later
# cap exhaustion on a new head is handled afresh.
CAP_EXHAUSTED_EXTRA = "cap_exhausted"


def _skip(reason: str, log_extra: dict[str, Any]) -> None:
    metrics.incr("autofix.pr_iteration.cap_exhausted.skipped", tags={"reason": reason})
    logger.info("autofix.pr_iteration.cap_exhausted.skipped", extra={**log_extra, "reason": reason})


def _failed(reason: str, log_extra: dict[str, Any]) -> None:
    """Record an unexpected failure (vs. a `_skip`, which is an expected condition)."""
    metrics.incr("autofix.pr_iteration.cap_exhausted.failed", tags={"reason": reason})
    logger.warning(
        "autofix.pr_iteration.cap_exhausted.failed",
        extra={**log_extra, "reason": reason},
        exc_info=True,
    )


def _cap_exhausted_marker(seer_run: SeerRun, repo_name: str) -> dict[str, Any] | None:
    return get_run_marker(seer_run, CAP_EXHAUSTED_EXTRA, repo_name)


def _already_handed_off(seer_run: SeerRun, repo_name: str, head_sha: str) -> bool:
    """A marker only suppresses re-handling for the head it recorded.

    After a handoff the user can send Seer back (``@sentry <guidance>``); if
    that later streak exhausts the cap again, it does so on a new head, and
    the run would otherwise go quiet without ever telling them.
    """
    marker = _cap_exhausted_marker(seer_run, repo_name)
    return marker is not None and marker.get("head_sha") == head_sha


def _record_cap_exhausted_marker(
    seer_run: SeerRun,
    repo_name: str,
    *,
    head_sha: str,
    assignees: list[str],
    commented: bool,
    preexisting: bool = False,
) -> None:
    """Write the per-repo marker; caller must hold the repo's cap-exhausted lock.

    ``preexisting`` records that the user was already assigned by someone else
    rather than by us.
    """
    marker: dict[str, Any] = {
        "recorded_at": timezone.now().isoformat(),
        "head_sha": head_sha,
        "assignees": assignees,
        "commented": commented,
    }
    if preexisting:
        marker["preexisting"] = True
    record_run_marker(seer_run, CAP_EXHAUSTED_EXTRA, repo_name, marker)


def _status_comment_body(github_login: str) -> str:
    cap = options.get("autofix.pr-iteration.max-iterations")
    return (
        f"@{github_login} CI is still failing after {cap} automated "
        "fix attempts, so Seer has stopped iterating on this pull request. It needs a human "
        "decision — you can:\n\n"
        "- push a fix to this branch yourself,\n"
        "- comment `@sentry <guidance>` to send Seer back for another attempt, or\n"
        "- close this pull request if it is not worth pursuing."
    )


def assign_user_for_exhausted_cap(
    event: GithubCheckSuiteEvent, resolved: CheckSuiteAutofixRun
) -> None:
    """Entry point from the check-suite listener when a failing suite won't iterate."""
    organization_id = resolved.repository.organization_id
    try:
        organization = Organization.objects.get_from_cache(id=organization_id)
    except Organization.DoesNotExist:
        return
    if not features.has("organizations:autofix-pr-iteration-cap-assign", organization):
        return

    log_extra: dict[str, Any] = {
        "organization_id": organization_id,
        "repo_id": resolved.repository.id,
        "run_id": resolved.run_state.run_id,
        "pr_id": resolved.pr_id,
    }

    head_match = check_suite_head_match(event, resolved.run_state)
    if not head_match.matched or not head_match.head_sha or not head_match.repo_name:
        # A failure on an older commit says nothing about the current head.
        _skip("stale_head", {**log_extra, "head_sha": head_match.head_sha})
        return

    if not automated_iteration_cap_reached(resolved.run_state):
        # The listener only hands over cap-blocked events; re-check anyway so
        # this stays safe to call from other paths.
        logger.info("autofix.pr_iteration.cap_exhausted.cap_not_reached", extra=log_extra)
        return

    seer_run = SeerRun.objects.filter(
        seer_run_state_id=resolved.run_state.run_id, organization=organization
    ).first()
    if seer_run is None:
        # Legacy runs predating SeerRun mirroring have no row to hold the marker.
        _skip("no_seer_run", log_extra)
        return
    if seer_run.user_id is None:
        # System runs (e.g. Night Shift) have no user to hand the PR to; how
        # often this fires sizes the need for candidate-reviewer selection.
        _skip("no_triggering_user", log_extra)
        return
    if _already_handed_off(seer_run, head_match.repo_name, head_match.head_sha):
        _skip("already_handed_off", log_extra)
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
    github_login = get_github_username_for_user(user, organization.id, referrer="pr_cap_exhausted")
    if not github_login:
        _skip("no_github_login", log_extra)
        return

    # Importing the SCM factory while the check-suite listener module is
    # initialized pulls in integration handlers before options init.
    from sentry.scm.factory import new as make_scm

    try:
        scm = make_scm(organization.id, resolved.repository.id, referrer="seer")
    except Exception:
        _failed("scm_init_failed", log_extra)
        return

    if (
        not isinstance(scm, GetPullRequestProtocol)
        or not isinstance(scm, UpdateIssueProtocol)
        or not isinstance(scm, CreatePullRequestCommentProtocol)
    ):
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
    existing_assignees = [
        assignee["login"]
        for assignee in (raw_pr.get("assignees") or [])
        if isinstance(assignee, dict) and assignee.get("login")
    ]
    already_assigned = github_login.lower() in {login.lower() for login in existing_assignees}

    # A suite completes once per app/workflow, so several failing events can
    # race for the same head. Wait for the lock holder rather than dropping:
    # after the wait the marker re-check settles it — holder succeeded means we
    # skip, holder's handoff failed (marker unset) means this event retries.
    # Scoped per repo — markers are per-repo and written atomically, so on a
    # multi-repo run one repo's handoff must not stall another's.
    lock = locks.get(
        f"autofix:pr_iteration:cap_exhausted:{seer_run.id}:{head_match.repo_name}",
        duration=30,
        name="autofix_pr_cap_exhausted",
    )
    try:
        with lock.blocking_acquire(initial_delay=0.5, timeout=10):
            seer_run.refresh_from_db()
            if _already_handed_off(seer_run, head_match.repo_name, head_match.head_sha):
                _skip("already_handed_off", log_extra)
                return

            newly_assigned = False
            if not already_assigned:
                try:
                    # The issues PATCH replaces the assignee list wholesale, so
                    # merge with whoever is already assigned.
                    scm_actions.update_issue(
                        scm, str(pr_number), assignees=[*existing_assignees, github_login]
                    )
                    newly_assigned = True
                except Exception:
                    # Best effort — e.g. the user may not be assignable in this
                    # repo; the @-mention in the comment still notifies them.
                    _failed("assign_failed", {**log_extra, "pr_number": pr_number})
            assigned = already_assigned or newly_assigned

            commented = False
            try:
                scm_actions.create_pull_request_comment(
                    scm, str(pr_number), _status_comment_body(github_login)
                )
                commented = True
            except Exception:
                _failed("comment_failed", {**log_extra, "pr_number": pr_number})

            if not newly_assigned and not commented:
                # Nothing new reached the human — a preexisting assignment
                # doesn't tell them Seer stopped — so leave the marker unset
                # and let the next failing suite retry.
                return

            _record_cap_exhausted_marker(
                seer_run,
                head_match.repo_name,
                head_sha=head_match.head_sha,
                assignees=[github_login] if assigned else [],
                commented=commented,
                preexisting=already_assigned,
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
        "autofix.pr_iteration.cap_exhausted.handed_off",
        tags={"assigned": str(assigned).lower(), "commented": str(commented).lower()},
    )
    logger.info(
        "autofix.pr_iteration.cap_exhausted.handed_off",
        extra={**log_extra, "pr_number": pr_number, "assigned": assigned, "commented": commented},
    )
