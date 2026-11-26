from __future__ import annotations

import logging

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
