from __future__ import annotations

from pydantic import BaseModel


class ReferencedIssueSignalDetails(BaseModel):
    """signal_details payload for PullRequestAttributionSignalType.REFERENCED_ISSUE.

    Captured from the PR title/body at webhook time; group IDs are the Sentry
    issues matched by find_referenced_groups().
    """

    group_ids: list[int]
