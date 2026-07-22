"""Detect when a Seer PR's CI is green, undraft it, and record that on the run.

Green check-suite webhooks are the trigger; a sweep across every check run on
the PR's current head is the confirmation. Once confirmed we:

1. Mark the PR ready for review (no-op if already undrafted).
2. Persist a durable ``ci_green`` marker on ``SeerRun.extras`` (keyed by repo),
   so review-request can trust "CI is green for this head" without re-sweeping.

The marker is written only after a successful undraft — same pattern as
review-request — so a failed SCM call leaves the marker unset and the next
green event retries.

Gated by ``REVIEW_REQUEST_FLAG`` (same flag as draft-on-create and requesting
review).
"""

from __future__ import annotations

import logging
from typing import Any

import orjson
import sentry_sdk
from django.utils import timezone
from pydantic import ValidationError
from scm import actions as scm_actions
from scm.manager import SourceCodeManager
from scm.types import MarkPullRequestDraftStateProtocol

from sentry import features
from sentry.locks import locks
from sentry.models.organization import Organization
from sentry.scm.types import CheckSuiteEvent
from sentry.seer.autofix.pr_iteration.check_suites import (
    GithubCheckSuiteEvent,
    check_suite_matches_pr_head,
    resolve_check_suite_autofix_run,
    resolve_check_suite_repositories,
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
    try:
        raw = orjson.loads(check_suite_event.subscription_event["event"])
        event = GithubCheckSuiteEvent.parse_obj(raw)
    except (orjson.JSONDecodeError, ValidationError, TypeError, ValueError) as e:
        sentry_sdk.capture_exception(e)
        return

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
        if features.has(REVIEW_REQUEST_FLAG, organization):
            flagged_repos.append(repo)
    if not flagged_repos:
        return

    autofix_run = resolve_check_suite_autofix_run(event, flagged_repos)
    metrics.incr(
        "autofix.pr_iteration.ci_green.run_resolved",
        tags={"found": str(autofix_run is not None).lower()},
    )
    if autofix_run is None:
        return
    organization = organizations[autofix_run.repository.organization_id]

    log_extra: dict[str, Any] = {
        "organization_id": autofix_run.repository.organization_id,
        "repo_id": autofix_run.repository.id,
        "run_id": autofix_run.run_state.run_id,
        "pr_id": autofix_run.pr_id,
    }

    repo_name = event.repository.full_name
    pr_state = autofix_run.run_state.repo_pr_states.get(repo_name) if repo_name else None
    pr_number = pr_state.pr_number if pr_state else None
    if not repo_name or pr_number is None:
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

    # Match against the live PR head — run_state.commit_sha can lag pushes.
    try:
        pull_request = scm_actions.get_pull_request(scm, str(pr_number))
    except Exception:
        _failed("get_pull_request_failed", {**log_extra, "pr_number": pr_number})
        return
    head_match = check_suite_matches_pr_head(
        event, pr_head_sha=pull_request["data"]["head"].get("sha")
    )
    if not head_match.matched or not head_match.head_sha:
        _skip("stale_head", {**log_extra, "head_sha": head_match.head_sha})
        return

    seer_run = SeerRun.objects.filter(
        seer_run_state_id=autofix_run.run_state.run_id, organization=organization
    ).first()
    if seer_run is None:
        _skip("no_seer_run", log_extra)
        return

    if is_ci_green_for_head(seer_run, repo_name, head_match.head_sha):
        _skip("already_marked", log_extra)
        return

    sweep = sweep_check_runs(scm, head_match.head_sha, log_extra=log_extra)
    if sweep is None:
        _skip("sweep_failed", log_extra)
        return
    if not sweep.is_green:
        _skip(
            "not_green",
            {**log_extra, "incomplete_count": sweep.incomplete, "failed_count": sweep.failed},
        )
        return

    # Several green suite events can race for the same head. Wait for the lock
    # holder rather than dropping: after the wait the marker re-check settles
    # it — holder succeeded means we skip, holder's undraft failed (marker
    # unset) means this event retries.
    lock = locks.get(
        f"autofix:pr_iteration:ci_green:{seer_run.id}",
        duration=30,
        name="autofix_pr_ci_green",
    )
    try:
        with lock.blocking_acquire(initial_delay=0.5, timeout=10):
            seer_run.refresh_from_db()
            if is_ci_green_for_head(seer_run, repo_name, head_match.head_sha):
                _skip("already_marked", log_extra)
                return

            if not _mark_ready_with_scm(scm=scm, pr_number=pr_number, log_extra=log_extra):
                # Leave the marker unset so the next green event can retry.
                return

            record_ci_green_marker(seer_run, repo_name, head_sha=head_match.head_sha)
            metrics.incr("autofix.pr_iteration.ci_green.marked")
            logger.info(
                "autofix.pr_iteration.ci_green.marked",
                extra={**log_extra, "head_sha": head_match.head_sha},
            )
    except SeerRun.DoesNotExist:
        _skip("run_deleted", log_extra)
    except UnableToAcquireLock:
        _skip("locked", log_extra)


def _mark_ready_with_scm(
    *,
    scm: SourceCodeManager,
    pr_number: int,
    log_extra: dict[str, Any],
) -> bool:
    if not isinstance(scm, MarkPullRequestDraftStateProtocol):
        _skip("unsupported_provider", {**log_extra, "pr_number": pr_number})
        return False
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
