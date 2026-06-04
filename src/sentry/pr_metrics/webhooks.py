"""GitHub webhook handling for the PR Merge Live Metrics pipeline.

Two independent processors are registered on
``PullRequestEventWebhook.WEBHOOK_EVENT_PROCESSORS``: ``handle_attribution`` and
``handle_emission``. They're separate (rather than one routing function) so the
webhook loop isolates each in its own try/except — a failure in one can't
suppress the other — and each carries its own feature flag and action gate.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import datetime
from typing import Any

from django.conf import settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from sentry import features
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.services.integration import RpcIntegration
from sentry.models.organization import Organization
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
    PullRequestLifecycleState,
)
from sentry.models.repository import Repository
from sentry.pr_metrics.attribution import record_attribution_signal
from sentry.pr_metrics.emit import (
    CLOSE_ACTION_CLOSED,
    CLOSE_ACTION_MERGED,
    emit_pr_metrics_row,
    needs_judge,
)
from sentry.pr_metrics.types import ReferencedIssueSignalDetails
from sentry.utils import metrics
from sentry.utils.groupreference import find_referenced_groups

logger = logging.getLogger(__name__)

# Actions that set attribution for who authored the PR. The PR author is fixed
# at creation time and never changes, so app attribution is a one-shot write.
_AUTHOR_ATTRIBUTION_ACTIONS = frozenset({"opened"})

# Actions that can affect what Sentry issues the PR references. "edited" covers
# body/title changes; "reopened" may follow a period of changes on the branch.
_REFERENCED_ISSUE_ATTRIBUTION_ACTIONS = frozenset({"opened", "reopened", "edited"})


def handle_attribution(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """Record PR attribution signals (GH-App author + referenced issues) from the payload."""
    pull_request = event.get("pull_request")
    action = event.get("action")
    github_user = (pull_request or {}).get("user")
    if not (action and github_user):
        return

    if action not in (_AUTHOR_ATTRIBUTION_ACTIONS | _REFERENCED_ISSUE_ATTRIBUTION_ACTIONS):
        return

    if not features.has("organizations:pr-metrics-attribution", organization):
        return

    pr = _get_pull_request(organization, repo, pull_request)
    if pr is None:
        return

    if action in _AUTHOR_ATTRIBUTION_ACTIONS:
        _write_author_attribution(pr, github_user)

    if action in _REFERENCED_ISSUE_ATTRIBUTION_ACTIONS:
        if action == "edited" and not _description_changed(event):
            return
        # pr is set, so the payload is present and non-null (subscript narrows it).
        _refresh_referenced_issue_attribution(pr, event["pull_request"], organization)


def handle_emission(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """Emit a metrics row on a terminal (close/merge) PR webhook for a tracked PR.

    GitHub fires a single ``closed`` action for both merges and plain closes; the
    ``merged`` flag disambiguates. All non-terminal actions are ignored.
    """
    if event.get("action") != "closed":
        return

    if not features.has("organizations:pr-metrics-emit", organization):
        return

    pr = _get_pull_request(organization, repo, event.get("pull_request"))
    if pr is None:
        return

    # pr is set, so the payload is present and non-null (subscript narrows it).
    pull_request = event["pull_request"]
    close_action = CLOSE_ACTION_MERGED if pull_request.get("merged") else CLOSE_ACTION_CLOSED

    # DB-side redelivery guard, *before* the needs_judge() fork: atomically claim
    # the PR's terminal transition. A redelivered close/merge finds the PR
    # already closed/merged and claims nothing, so it's dropped before any emit
    # *or* judge forward — a retry must never re-launch the pricey judge work.
    #
    # The claim is intentionally upstream of emit_pr_metrics_row's tracking gate:
    # claiming here, then skipping the emit for an untracked PR (or failing
    # afterwards), still consumes the one-shot claim, so later redeliveries won't
    # emit even if the PR becomes tracked in the meantime. We accept that — the
    # guard's job is to make the terminal event single-shot regardless of fork,
    # and not re-launching judge work outweighs recovering a missed emit. A PR's
    # attribution is established at/before open, so a close arriving untracked is
    # the rare case, not the norm.
    if not _claim_terminal_transition(pr, pull_request):
        metrics.incr("pr_metrics.emit.skipped", tags={"reason": "redelivery"})
        logger.info(
            "pr_metrics.emit.redelivery_dropped",
            extra={"organization_id": organization.id, "pull_request_id": pr.id},
        )
        return

    if needs_judge(pr):
        # The judge path (forward to Seer, emit on the judge result) isn't wired
        # yet, so fall through to immediate emit — a judge-eligible PR still
        # produces a verdict-less row rather than none.
        logger.info(
            "pr_metrics.emit.judge_path_not_implemented",
            extra={"organization_id": organization.id, "pull_request_id": pr.id},
        )

    emit_pr_metrics_row(pull_request=pr, close_action=close_action, payload=pull_request)


def _get_pull_request(
    organization: Organization, repo: Repository, pull_request: dict[str, Any] | None
) -> PullRequest | None:
    """Resolve the canonical PullRequest row for a webhook payload, or None.

    Returns None when the event carries no pull_request. Otherwise the row is
    upserted by ``PullRequestEventWebhook._handle`` before processors run, so a
    miss is unexpected — log it and let the caller bail.
    """
    if not pull_request:
        return None
    try:
        return PullRequest.objects.get(
            organization_id=organization.id,
            repository_id=repo.id,
            key=str(pull_request["number"]),
        )
    except PullRequest.DoesNotExist:
        logger.warning(
            "github.pr_metrics.pr_not_found",
            extra={"repository_id": repo.id, "pr_number": pull_request["number"]},
        )
        return None


def _claim_terminal_transition(pr: PullRequest, payload: dict[str, Any]) -> bool:
    """Atomically record the PR's close/merge; return False if already recorded.

    This is the redelivery guard. A conditional ``UPDATE`` flips the PR to a
    terminal lifecycle state only while ``closed_at`` is still null, so
    concurrent or redelivered close/merge events race for the one row and exactly
    one wins. Losers update zero rows and return False.

    ``closed_at`` is the claim marker: GitHub stamps it on both plain closes and
    merges, so "has this PR been closed/merged before" is exactly "is
    ``closed_at`` already set". Checking it in the ``UPDATE``'s ``WHERE`` clause
    (rather than a separate read) keeps the check-and-set a single atomic
    statement, immune to the race two redeliveries would otherwise open.
    """
    merged = bool(payload.get("merged"))
    updated = PullRequest.objects.filter(id=pr.id, closed_at__isnull=True).update(
        state=PullRequestLifecycleState.MERGED if merged else PullRequestLifecycleState.CLOSED,
        # GitHub always sends closed_at on a terminal event; fall back to now()
        # so the claim marker is never left null if a provider omits it.
        closed_at=_parse_timestamp(payload.get("closed_at")) or timezone.now(),
        merged_at=_parse_timestamp(payload.get("merged_at")) if merged else None,
    )
    return updated > 0


def _parse_timestamp(value: Any) -> datetime | None:
    """Parse a GitHub ISO-8601 timestamp, tolerating missing/malformed values."""
    if not value:
        return None
    try:
        return parse_datetime(value)
    except ValueError:
        return None


def _description_changed(event: Mapping[str, Any]) -> bool:
    changes = event.get("changes") or {}
    return "body" in changes or "title" in changes


def _detect_app_signal(github_user_id: int) -> PullRequestAttributionSignalType | None:
    seer_id = getattr(settings, "SEER_AUTOFIX_GITHUB_APP_USER_ID", None)
    sentry_id = getattr(settings, "SENTRY_GITHUB_APP_USER_ID", None)
    if github_user_id in (seer_id, sentry_id):
        return PullRequestAttributionSignalType.SENTRY_APP
    return None


def _write_author_attribution(pr: PullRequest, github_user: dict[str, Any]) -> None:
    signal_type = _detect_app_signal(github_user["id"])
    if signal_type is None:
        return
    record_attribution_signal(
        pull_request=pr,
        signal_type=signal_type,
        source=PullRequestAttributionSource.WEBHOOK_DATA,
    )


def _refresh_referenced_issue_attribution(
    pr: PullRequest,
    pull_request: dict[str, Any],
    organization: Organization,
) -> None:
    title = pull_request.get("title") or ""
    body = pull_request.get("body") or ""
    text = f"{title} {body}".strip()

    groups = find_referenced_groups(text, organization.id)

    if not groups:
        # Issue references were removed from the description — invalidate.
        PullRequestAttribution.objects.filter(
            pull_request=pr,
            signal_type=PullRequestAttributionSignalType.REFERENCED_ISSUE,
            source=PullRequestAttributionSource.WEBHOOK_DATA,
        ).update(is_valid=False)
        return

    details = ReferencedIssueSignalDetails(group_ids=sorted(g.id for g in groups))
    record_attribution_signal(
        pull_request=pr,
        signal_type=PullRequestAttributionSignalType.REFERENCED_ISSUE,
        source=PullRequestAttributionSource.WEBHOOK_DATA,
        signal_details=details.dict(),
    )
