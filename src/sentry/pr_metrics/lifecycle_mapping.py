from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any

from dateutil.parser import parse as parse_date

from sentry.models.pullrequest import PullRequest, PullRequestLifecycleState
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def is_stale_pull_request_snapshot(
    stored: PullRequest,
    *,
    event_state: str | None,
    event_updated_at: datetime | None,
) -> bool:
    """Whether an SCM webhook payload describes an older PR state than what's stored.

    SCM webhooks are not ordered. Control silo forwards them to the cells through
    ``WebhookPayload`` rows; a delivery that fails is rescheduled with exponential
    backoff and lands minutes later, behind events that were originally after it.
    Each pull-request/merge-request payload carries a full snapshot of the PR, so
    replaying an older one rewrites lifecycle state backwards — leaving a PR shown as
    open in Sentry while it is merged upstream.

    Two independent checks, because neither subsumes the other:

    - ``merged`` is terminal at both providers, so any snapshot claiming otherwise is
      stale. Needing no stored timestamp, this also covers rows written before
      ``updated_at`` was recorded and events whose provider timestamps collide at the
      one-second resolution GitHub reports.
    - Everything else needs the payload timestamp: ``closed`` -> ``open`` is a real
      transition (a reopen), so only provider time tells a reopen from a replay. Equal
      timestamps are not stale — within one provider-side second the events can't be
      ordered, and letting the later delivery win preserves existing behaviour.

    Both are inert when the facts are missing (no stored ``updated_at``, no payload
    ``updated_at``), which is the pre-existing last-write-wins behaviour.
    """
    if (
        stored.state == PullRequestLifecycleState.MERGED
        and event_state != PullRequestLifecycleState.MERGED
    ):
        return True
    if stored.updated_at is None or event_updated_at is None:
        return False
    return event_updated_at < stored.updated_at


def update_pull_request_from_scm_snapshot(
    *,
    provider: str,
    organization_id: int,
    repository_id: int,
    key: int | str,
    defaults: Mapping[str, Any],
    event_state: str | None,
    event_updated_at: datetime | None,
) -> tuple[PullRequest, bool]:
    """Upsert a ``PullRequest`` from an SCM webhook snapshot, monotonically.

    Shared by the GitHub and GitLab pull/merge-request webhook handlers. A stale
    snapshot is dropped whole rather than field by field: every mutable column here —
    title, body, head sha, lifecycle state and timestamps — comes from the same
    point-in-time snapshot, so applying part of an outdated one would leave the row
    internally inconsistent.

    Returns ``(pull_request, created)``. A dropped snapshot returns the untouched
    stored row and ``False``, the same shape as an upsert that found nothing to change.
    """
    stored = PullRequest.objects.filter(
        organization_id=organization_id, repository_id=repository_id, key=key
    ).first()

    if stored is not None and is_stale_pull_request_snapshot(
        stored, event_state=event_state, event_updated_at=event_updated_at
    ):
        metrics.incr(
            "scm.webhook.pull_request.stale_snapshot", tags={"provider": provider}, sample_rate=1.0
        )
        logger.info(
            "scm.webhook.pull_request.stale_snapshot",
            extra={
                "provider": provider,
                "organization_id": organization_id,
                "repository_id": repository_id,
                "pr_key": str(key),
                "stored_state": stored.state,
                "stored_updated_at": stored.updated_at,
                "event_state": event_state,
                "event_updated_at": event_updated_at,
            },
        )
        return stored, False

    return PullRequest.objects.update_or_create(
        organization_id=organization_id,
        repository_id=repository_id,
        key=key,
        defaults=defaults,
    )


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
