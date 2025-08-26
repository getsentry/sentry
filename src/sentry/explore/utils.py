from __future__ import annotations

from sentry.models.organization import Organization


def is_logs_enabled(organization: Organization) -> bool:
    """
    Check if logs are enabled for the given organization.
    This replaces individual feature flag checks for consolidated ourlogs features.
    """
    return organization.get_feature("ourlogs-enabled")
