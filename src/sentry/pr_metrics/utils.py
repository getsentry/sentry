"""Shared utilities for the PR Merge Live Metrics pipeline."""

from __future__ import annotations

from sentry.models.grouplink import GroupLink
from sentry.models.pullrequest import PullRequest


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
