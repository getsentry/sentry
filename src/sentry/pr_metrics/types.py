from __future__ import annotations

from enum import StrEnum
from typing import Any


class ReferencedIssueWebhookKey(StrEnum):
    PR_BODY = "pr_body"
    PUSH = "push"  # commit messages; wired to the push webhook handler


def normalize_signal_details(signal_details: dict[str, Any] | None) -> dict[str, Any]:
    """Return the webhook-keyed form of ``signal_details``, promoting legacy rows.

    Existing rows written before the keyed schema was introduced store a plain
    ``{"group_ids": [...]}`` dict.  On the next write those rows are converted
    in-place; until then reads treat them as if they came from ``pr_body``.
    """
    if not signal_details:
        return {}
    if "group_ids" in signal_details and ReferencedIssueWebhookKey.PR_BODY not in signal_details:
        return {ReferencedIssueWebhookKey.PR_BODY: signal_details["group_ids"]}
    return dict(signal_details)


def get_referenced_group_ids(signal_details: dict[str, Any] | None) -> list[int]:
    """Return the deduplicated, sorted union of all group IDs across all webhook sources."""
    if not signal_details:
        return []
    details = normalize_signal_details(signal_details)
    seen: set[int] = set()
    for ids in details.values():
        if isinstance(ids, list):
            seen.update(ids)
    return sorted(seen)


def is_referenced_issue_valid(signal_details: dict[str, Any] | None) -> bool:
    """Return True if any webhook source still contributes at least one referenced group."""
    return bool(get_referenced_group_ids(signal_details))
