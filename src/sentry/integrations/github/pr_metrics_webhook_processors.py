from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from django.conf import settings

from sentry import features
from sentry.models.organization import Organization
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
)
from sentry.pr_metrics.attribution import record_attribution_signal
from sentry.pr_metrics.types import ReferencedIssueSignalDetails
from sentry.utils.groupreference import find_referenced_groups

logger = logging.getLogger(__name__)

# Actions that set attribution for who authored the PR. The PR author is fixed
# at creation time and never changes, so app attribution is a one-shot write.
_APP_ATTRIBUTION_ACTIONS = frozenset({"opened"})

# Actions that can affect what Sentry issues the PR references. "edited" covers
# body/title changes; "reopened" may follow a period of changes on the branch.
_REFERENCED_ISSUE_ATTRIBUTION_ACTIONS = frozenset({"opened", "reopened", "edited"})


def handle_webhook_for_pr_metrics(
    organization: Organization,
    action: str,
    pull_request: dict[str, Any],
    github_user: dict[str, Any],
    repository_id: int,
    event: Mapping[str, Any],
) -> None:
    if action not in (_APP_ATTRIBUTION_ACTIONS | _REFERENCED_ISSUE_ATTRIBUTION_ACTIONS):
        return

    if not features.has("organizations:pr-metrics-attribution", organization):
        return

    try:
        pr = PullRequest.objects.get(
            organization_id=organization.id,
            repository_id=repository_id,
            key=str(pull_request["number"]),
        )
    except PullRequest.DoesNotExist:
        logger.warning(
            "github.pr_metrics.attribution.pr_not_found",
            extra={"repository_id": repository_id, "pr_number": pull_request["number"]},
        )
        return

    if action in _APP_ATTRIBUTION_ACTIONS:
        _write_app_attribution(pr, github_user)

    if action in _REFERENCED_ISSUE_ATTRIBUTION_ACTIONS:
        if action == "edited" and not _description_changed(event):
            return
        _refresh_referenced_issue_attribution(pr, pull_request, organization)


def _description_changed(event: Mapping[str, Any]) -> bool:
    changes = event.get("changes") or {}
    return "body" in changes or "title" in changes


def _detect_app_signal(github_user_id: int) -> PullRequestAttributionSignalType | None:
    seer_id = getattr(settings, "SEER_AUTOFIX_GITHUB_APP_USER_ID", None)
    sentry_id = getattr(settings, "SENTRY_GITHUB_APP_USER_ID", None)
    if github_user_id in (seer_id, sentry_id):
        return PullRequestAttributionSignalType.SENTRY_APP
    return None


def _write_app_attribution(pr: PullRequest, github_user: dict[str, Any]) -> None:
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
