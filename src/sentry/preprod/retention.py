from __future__ import annotations

from datetime import datetime, timedelta
from typing import TypedDict

from django.utils import timezone

from sentry import quotas
from sentry.constants import DataCategory
from sentry.models.organization import Organization

# The longest retention, in days, that preprod data can be given: thirteen months, the
# longest retention of any plan. Retention overrides have no upper bound, so longer ones
# are cut to this.
#
# Preprod objects in Objectstore are written with a TTL taken from this retention. The
# Objectstore use case configuration for preprod (in the ops repository) currently caps
# TTLs at 396 days, and Objectstore rejects a write with a longer one with a 400. That
# cap is configuration: if a contract ever needs a longer retention, raise it there
# first and then raise this value to match.
MAX_RETENTION_DAYS = 396

# The retention used where a number of days is required (an EAP item, an Objectstore
# TTL) and the organization's retention is unlimited.
DEFAULT_RETENTION_DAYS = 90


def get_retention_days(organization: Organization, category: DataCategory) -> int | None:
    """
    The organization's current retention for a preprod data category, in days, at most
    `MAX_RETENTION_DAYS`. `None` means the retention is unlimited, which is the case
    where no retention is configured (self-hosted).

    This is the retention of the organization's plan right now. Data that is already
    stored keeps the retention it was given when it was ingested.
    """
    days = quotas.backend.get_event_retention(organization=organization, category=category)
    if not days:
        return None
    return min(days, MAX_RETENTION_DAYS)


def get_retention_days_or_default(organization: Organization, category: DataCategory) -> int:
    """
    Like `get_retention_days`, with `DEFAULT_RETENTION_DAYS` in place of an unlimited
    retention.
    """
    return get_retention_days(organization, category) or DEFAULT_RETENTION_DAYS


class ArtifactExpiry(TypedDict):
    """The expiry columns of a `PreprodArtifact`."""

    date_expires: datetime | None
    date_size_analysis_expires: datetime | None


def get_artifact_retention_days(organization: Organization) -> int | None:
    """
    The organization's current retention for a whole artifact, in days: the longest one
    of the preprod data categories, because one artifact serves all of them. A build is
    analyzed for size and distributed from the same row and the same files.

    Snapshots have no data category of their own yet, so a snapshot artifact is retained
    like a build.
    """
    longest = 0
    for category in (DataCategory.SIZE_ANALYSIS, DataCategory.INSTALLABLE_BUILD):
        days = get_retention_days(organization, category)
        if days is None:
            return None
        longest = max(longest, days)
    return longest


def get_artifact_expiry(
    organization: Organization, date_added: datetime | None = None
) -> ArtifactExpiry:
    """
    The expiry of an artifact created at `date_added` (now, if not given) under the
    organization's current retention. A date is `None` where the retention is unlimited.

    Call this once, when the artifact is created, and store the result on it. The
    retention of an artifact is the one of the plan at the time it was ingested.
    """
    if date_added is None:
        date_added = timezone.now()

    def expiry(days: int | None) -> datetime | None:
        return None if days is None else date_added + timedelta(days=days)

    return ArtifactExpiry(
        date_expires=expiry(get_artifact_retention_days(organization)),
        date_size_analysis_expires=expiry(
            get_retention_days(organization, DataCategory.SIZE_ANALYSIS)
        ),
    )
