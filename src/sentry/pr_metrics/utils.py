"""Shared utilities for the PR Merge Live Metrics pipeline."""

from __future__ import annotations

from datetime import datetime

from sentry.models.grouplink import GroupLink
from sentry.models.pullrequest import PullRequest


def iso_or_none(value: datetime | None) -> str | None:
    """Serialize a persisted datetime to an ISO-8601 string, or None.

    Shared by the analytics row and the Seer judge request, which both encode the
    PR's optional timestamps the same way.
    """
    return value.isoformat() if value is not None else None


# Branch-prefix → provider hint. Claude-delegated PRs are opened by the Sentry
# GitHub app (no distinct author), so the branch prefix is the only usable signal.
DELEGATED_AGENT_BRANCH_PREFIXES: dict[str, str] = {
    "claude_code": "claude/",
    "github_copilot": "copilot/",
}

# GitHub bot login → provider hint. Copilot opens PRs as a distinct bot user;
# other providers rely on the branch prefix above.
DELEGATED_AGENT_AUTHOR_LOGINS: dict[str, str] = {
    "copilot-swe-agent[bot]": "github_copilot",
}


def resolved_group_ids(pull_request: PullRequest) -> list[int]:
    """Group IDs this PR resolves, from the resolving GroupLink rows.

    Sorted for a deterministic ordering; empty when the PR resolves no issues.
    """
    return sorted(
        GroupLink.objects.filter(
            linked_type=GroupLink.LinkedType.pull_request,
            relationship=GroupLink.Relationship.resolves,
            linked_id=pull_request.id,
        ).values_list("group_id", flat=True)
    )
