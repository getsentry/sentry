from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import TypedDict

from django.utils import timezone

from sentry import quotas
from sentry.constants import DataCategory
from sentry.models.organization import Organization

logger = logging.getLogger(__name__)

# Thirteen months. Retention overrides have no upper bound, so longer ones are cut to
# this and logged as an error.
# If an organization needs longer retention, just update this value and the Objectstore cap
# defined in the `getsentry/ops` repo in `k8s/services/objectstore/_values.yaml`.
MAX_RETENTION_DAYS = 396

# Used when no retention is configured, which only happens on self-hosted.
DEFAULT_RETENTION_DAYS = 90


def get_retention_days(organization: Organization, category: DataCategory) -> int:
    """The organization's current retention for a preprod data category, in days."""
    days = (
        quotas.backend.get_event_retention(organization=organization, category=category)
        or DEFAULT_RETENTION_DAYS
    )
    if days > MAX_RETENTION_DAYS:
        logger.error(
            "preprod.retention.exceeds_max",
            extra={
                "organization_id": organization.id,
                "category": category.api_name(),
                "retention_days": days,
                "max_retention_days": MAX_RETENTION_DAYS,
            },
        )
        return MAX_RETENTION_DAYS
    return days


class ArtifactExpiry(TypedDict):
    """The expiry columns of a build `PreprodArtifact`."""

    date_expires: datetime
    date_size_analysis_expires: datetime


def get_artifact_retention_days(organization: Organization) -> int:
    """
    The organization's current retention for a whole build, in days: the longest one of
    Size Analysis and Build Distribution, because a build is analyzed for size and
    distributed from the same row and the same files.
    """
    return max(
        get_retention_days(organization, DataCategory.SIZE_ANALYSIS),
        get_retention_days(organization, DataCategory.INSTALLABLE_BUILD),
    )


def get_artifact_expiry(
    organization: Organization, date_added: datetime | None = None
) -> ArtifactExpiry:
    """
    The expiry of a build created at `date_added` (now, if not given) under the
    organization's current retention. Snapshots use `get_snapshot_expiry`.

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


class SnapshotExpiry(TypedDict):
    """The expiry column of a snapshot `PreprodArtifact`, which has no size analysis."""

    date_expires: datetime


def get_snapshot_retention_days(organization: Organization) -> int:
    """
    The organization's current retention for snapshots, in days.

    Snapshots have their own data category, `SNAPSHOT_IMAGE`, but no retention is
    configured for it yet. Until then the Size Analysis retention stands in for it, as it
    matches the snapshot retention intended on every plan.
    """
    return get_retention_days(organization, DataCategory.SIZE_ANALYSIS)


def get_snapshot_expiry(
    organization: Organization, date_added: datetime | None = None
) -> SnapshotExpiry:
    """
    The expiry of a snapshot created at `date_added` (now, if not given) under the
    organization's current retention. Call this once, when the snapshot is created, and
    store the result on it.

    It covers only the snapshot's row and its manifests. Its images are shared with other
    snapshots and expire on their own in Objectstore.
    """
    if date_added is None:
        date_added = timezone.now()

    return SnapshotExpiry(
        date_expires=date_added + timedelta(days=get_snapshot_retention_days(organization))
    )
