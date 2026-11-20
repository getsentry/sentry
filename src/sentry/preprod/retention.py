from __future__ import annotations

from datetime import datetime, timedelta
from typing import TYPE_CHECKING, TypedDict

from django.db.models import Q
from django.utils import timezone

from sentry import quotas
from sentry.constants import DataCategory
from sentry.models.organization import Organization

if TYPE_CHECKING:
    from sentry.preprod.models import PreprodArtifact

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

# The retention used where none is configured, which is only the case for a self-hosted
# instance that does not set one.
DEFAULT_RETENTION_DAYS = 90


def get_retention_days(organization: Organization, category: DataCategory) -> int:
    """
    The organization's current retention for a preprod data category, in days, at most
    `MAX_RETENTION_DAYS`.

    This is the retention of the organization's plan right now. Data that is already
    stored keeps the retention it was given when it was ingested.
    """
    days = quotas.backend.get_event_retention(organization=organization, category=category)
    return min(days or DEFAULT_RETENTION_DAYS, MAX_RETENTION_DAYS)


class ArtifactExpiry(TypedDict):
    """The expiry columns of a `PreprodArtifact`."""

    date_expires: datetime
    date_size_analysis_expires: datetime


def get_artifact_retention_days(organization: Organization) -> int:
    """
    The organization's current retention for a whole artifact, in days: the longest one
    of the preprod data categories, because one artifact serves all of them. A build is
    analyzed for size and distributed from the same row and the same files.

    Snapshots have no data category of their own yet, so a snapshot artifact is retained
    like a build.
    """
    return max(
        get_retention_days(organization, DataCategory.SIZE_ANALYSIS),
        get_retention_days(organization, DataCategory.INSTALLABLE_BUILD),
    )


def get_artifact_expiry(
    organization: Organization, date_added: datetime | None = None
) -> ArtifactExpiry:
    """
    The expiry of an artifact created at `date_added` (now, if not given) under the
    organization's current retention.

    Call this once, when the artifact is created, and store the result on it. The
    retention of an artifact is the one of the plan at the time it was ingested.
    """
    if date_added is None:
        date_added = timezone.now()

    return ArtifactExpiry(
        date_expires=date_added + timedelta(days=get_artifact_retention_days(organization)),
        date_size_analysis_expires=date_added
        + timedelta(days=get_retention_days(organization, DataCategory.SIZE_ANALYSIS)),
    )


def is_expired(artifact: PreprodArtifact) -> bool:
    """
    Whether the artifact is past its `date_expires` and must no longer be served.

    An artifact without one was created before the column existed and is not backfilled
    yet. It is deleted by age instead, by the `--days` of the `cleanup` command.
    """
    return artifact.date_expires is not None and artifact.date_expires <= timezone.now()


def is_size_analysis_expired(artifact: PreprodArtifact, organization: Organization) -> bool:
    """
    Whether the artifact's size analysis is past its retention and must no longer be
    served.

    This is decided by the date stamped on the artifact when it was created. An
    artifact without one (created before the column existed and not backfilled yet)
    falls back to what applied before the column existed: the organization's current
    retention, counted from `date_added`.
    """
    now = timezone.now()
    if artifact.date_size_analysis_expires is not None:
        return artifact.date_size_analysis_expires <= now

    days = get_retention_days(organization, DataCategory.SIZE_ANALYSIS)
    return artifact.date_added < now - timedelta(days=days)


def unexpired_artifacts() -> Q:
    """A filter for the artifacts for which `is_expired` does not hold."""
    return Q(date_expires__isnull=True) | Q(date_expires__gt=timezone.now())


def unexpired_size_analysis(organization: Organization) -> Q:
    """
    A filter for the organization's artifacts for which `is_size_analysis_expired` does
    not hold.
    """
    now = timezone.now()
    days = get_retention_days(organization, DataCategory.SIZE_ANALYSIS)
    return Q(date_size_analysis_expires__gt=now) | Q(
        date_size_analysis_expires__isnull=True,
        date_added__gte=now - timedelta(days=days),
    )
