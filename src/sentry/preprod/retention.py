from __future__ import annotations

from sentry import quotas
from sentry.constants import DataCategory
from sentry.models.organization import Organization

# Thirteen months. Retention overrides have no upper bound, so longer ones are cut to
# this. It matches the TTL cap of the preprod use case in Objectstore (set in ops), which
# rejects writes with a longer TTL.
MAX_RETENTION_DAYS = 396

# Used when no retention is configured, which only happens on self-hosted.
DEFAULT_RETENTION_DAYS = 90


def get_retention_days(organization: Organization, category: DataCategory) -> int:
    """The organization's current retention for a preprod data category, in days."""
    days = quotas.backend.get_event_retention(organization=organization, category=category)
    return min(days or DEFAULT_RETENTION_DAYS, MAX_RETENTION_DAYS)
