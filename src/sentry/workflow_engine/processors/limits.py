"""
This module provides utilities for querying the configured limits for a given organization.
"""

from dataclasses import dataclass

from django.conf import settings

from sentry.models.organization import Organization


@dataclass(frozen=True)
class OrganizationLimits:
    """
    Limits for an organization.

    Currently incomplete; should include all configured limits we intend to enforce.
    """

    # Maximum number of allowed Snuba query subscriptions for the organization.
    max_query_subscriptions: int


def get_organization_limits(org: Organization) -> OrganizationLimits:
    return OrganizationLimits(
        max_query_subscriptions=settings.MAX_QUERY_SUBSCRIPTIONS_PER_ORG,
    )
