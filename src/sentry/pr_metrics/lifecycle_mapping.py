from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any

from dateutil.parser import parse as parse_date

from sentry.models.pullrequest import PullRequestLifecycleState


def parse_scm_timestamp(value: str | None) -> datetime | None:
    """Parse a provider's ISO-8601 timestamp into a UTC datetime, or None if absent."""
    if not value:
        return None
    return parse_date(value).astimezone(timezone.utc)


def pull_request_lifecycle_state_from_github(pull_request: Mapping[str, Any]) -> str:
    """Map a GitHub PR payload to a ``PullRequestLifecycleState`` value.

    GitHub reports ``state`` as only "open"/"closed" alongside a separate
    ``merged`` flag; we fold the two into the richer lifecycle enum so a merged
    PR is stored as "merged" rather than an ambiguous "closed".
    """
    if pull_request.get("merged"):
        return PullRequestLifecycleState.MERGED
    if pull_request.get("state") == "closed":
        return PullRequestLifecycleState.CLOSED
    return PullRequestLifecycleState.OPEN


def map_gitlab_state_to_pullrequest_lifecycle(gitlab_state: str | None) -> str | None:
    return {
        "opened": PullRequestLifecycleState.OPEN,
        "closed": PullRequestLifecycleState.CLOSED,
        "merged": PullRequestLifecycleState.MERGED,
        "locked": PullRequestLifecycleState.LOCKED,
    }.get(gitlab_state or "")
