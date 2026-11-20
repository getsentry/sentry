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
