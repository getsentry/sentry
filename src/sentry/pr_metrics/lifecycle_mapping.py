from __future__ import annotations

import hashlib
import logging
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any

from dateutil.parser import parse as parse_date
from django.db import connections, router, transaction

from sentry.models.pullrequest import PullRequest, PullRequestLifecycleState
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def is_stale_pull_request_snapshot(
    stored: PullRequest,
    *,
    event_state: str | None,
    event_updated_at: datetime | None,
) -> bool:
    """Whether an SCM payload describes an older PR state than the stored row.

    Ordering comes from ``provider_updated_at``; arrival time says nothing about
    when the change happened.

    Neither rule subsumes the other. Timestamps are absent on rows predating the column
    and coarse at GitHub's one-second resolution, which terminal-``merged`` covers; and
    ``closed`` -> ``open`` is a real transition (a reopen) that only provider time
    separates from a replay. The event action can't stand in there: it says what
    triggered this event, not whether the ``reopened`` before it was delivered, so
    requiring that action would permanently reject every later payload on a PR whose
    reopen we missed. Equal timestamps are not stale — within one provider-side second
    there is no order to recover.
    """
    if (
        stored.state == PullRequestLifecycleState.MERGED
        and event_state != PullRequestLifecycleState.MERGED
    ):
        return True
    if stored.provider_updated_at is None or event_updated_at is None:
        return False
    return event_updated_at < stored.provider_updated_at


def is_stale_github_pull_request_payload(
    stored: PullRequest, pull_request: Mapping[str, Any]
) -> bool:
    """``is_stale_pull_request_snapshot`` for a caller holding only a GitHub payload.

    Exact rather than approximate: the row is re-read after ``PullRequestEventWebhook``
    has written it, so an accepted snapshot leaves ``provider_updated_at`` equal to
    the event (not stale) and a rejected one leaves it newer (still stale).
    """
    return is_stale_pull_request_snapshot(
        stored,
        event_state=pull_request_lifecycle_state_from_github(pull_request),
        event_updated_at=parse_scm_timestamp(pull_request.get("updated_at")),
    )


def _lock_pull_request_key(repository_id: int, key: int | str) -> None:
    """Serialize writers for one PR, including before its row exists.

    ``SELECT ... FOR UPDATE`` has nothing to lock until the row is there, so two first
    deliveries would both find nothing, both skip the staleness guard, and let the
    loser's ``update_or_create`` apply its defaults over the winner's insert. Keyed on
    ``(repository_id, key)`` — the unique constraint that arbitrates that race — and
    normalized through ``str`` so an ``int`` and ``str`` key hash alike.

    Transaction-scoped, so it releases on commit or rollback with no expiry to outlive
    the write, and holds no session state for a connection pooler to lose.

    Always taken before the row lock, and by this path alone. A writer that takes only
    the row lock (e.g. the pr_metrics stub) never waits on this one, so there is no
    cycle to deadlock on — this only serializes entry into the critical section.
    """
    digest = hashlib.blake2b(f"{repository_id}:{key}".encode(), digest_size=8).digest()
    lock_id = int.from_bytes(digest, "big", signed=True)
    with connections[router.db_for_write(PullRequest)].cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(%s)", [lock_id])


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

    A stale snapshot is dropped whole: every mutable column comes from one
    point-in-time snapshot, so applying part of an outdated one leaves the row
    inconsistent.

    Writers are serialized for the whole decision because a backlogged mailbox delivers
    ``hybridcloud.webhookpayload.worker_threads`` payloads at once, and GitHub buckets
    every ``pull_request`` event for a repo into one mailbox. Two deliveries for the
    same PR would otherwise both read the pre-write row and the older write would land
    last. Contention is per PR, between deliveries that have to serialize anyway.

    Returns ``(pull_request, created)``; a dropped snapshot returns the stored row
    unchanged.
    """
    with transaction.atomic(router.db_for_write(PullRequest)):
        _lock_pull_request_key(repository_id, key)
        # Redundant with the advisory lock for callers of this function, kept so the
        # row is still held against writers that create it by another path (e.g. the
        # pr_metrics stub) rather than relying on every writer knowing the convention.
        stored = (
            PullRequest.objects.select_for_update()
            .filter(organization_id=organization_id, repository_id=repository_id, key=key)
            .first()
        )

        if stored is not None and is_stale_pull_request_snapshot(
            stored, event_state=event_state, event_updated_at=event_updated_at
        ):
            metrics.incr(
                "scm.webhook.pull_request.stale_snapshot",
                tags={"provider": provider},
                sample_rate=1.0,
            )
            logger.info(
                "scm.webhook.pull_request.stale_snapshot",
                extra={
                    "provider": provider,
                    "organization_id": organization_id,
                    "repository_id": repository_id,
                    "pr_key": str(key),
                    "stored_state": stored.state,
                    "stored_provider_updated_at": stored.provider_updated_at,
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
