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
