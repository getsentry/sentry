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
from typing import Any

from django.conf import settings

from sentry import features
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.services.integration import RpcIntegration
from sentry.models.organization import Organization
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
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
    if not pull_request:
        return

    action = event.get("action")
    github_user = pull_request.get("user")
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
        _refresh_referenced_issue_attribution(pr, pull_request, organization)


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
    pull_request = event.get("pull_request")
    if not pull_request:
        return

    if event.get("action") != "closed":
        return

    if not features.has("organizations:pr-metrics-emit", organization):
        return

    pr = _get_pull_request(organization, repo, pull_request)
    if pr is None:
        return

    close_action = CLOSE_ACTION_MERGED if pull_request.get("merged") else CLOSE_ACTION_CLOSED

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
    organization: Organization, repo: Repository, pull_request: dict[str, Any]
) -> PullRequest | None:
    """Resolve the canonical PullRequest row for a webhook payload, or None.

    The row is upserted by ``PullRequestEventWebhook._handle`` before processors
    run, so a miss is unexpected — log it and let the caller bail.
    """
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
