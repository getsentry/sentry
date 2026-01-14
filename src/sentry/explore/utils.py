from __future__ import annotations

from sentry import features
from sentry.models.organization import Organization
from sentry.users.models.user import User


def is_logs_enabled(organization: Organization, actor: User | None = None) -> bool:
    """
    Check if logs are enabled for the given organization.
    This replaces individual feature flag checks for consolidated ourlogs features.
    """
    return features.has("organizations:ourlogs-enabled", organization, actor=actor)


def is_trace_metrics_enabled(organization: Organization, actor: User | None = None) -> bool:
    """
    Check if trace metrics are enabled for the given organization.
    This replaces individual feature flag checks for consolidated tracemetrics features.
    """
    return features.has("organizations:tracemetrics-enabled", organization, actor=actor)


def is_trace_metrics_alerts_enabled(organization: Organization, actor: User | None = None) -> bool:
    """
    Check if trace metrics alerts are enabled for the given organization.
    """
    return features.has(
        "organizations:tracemetrics-enabled", organization, actor=actor
    ) and features.has("organizations:tracemetrics-alerts", organization, actor=actor)
