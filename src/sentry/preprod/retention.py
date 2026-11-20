from __future__ import annotations

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
