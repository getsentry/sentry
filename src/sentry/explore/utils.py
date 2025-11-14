from __future__ import annotations
from typing import int

from sentry import features
from sentry.models.organization import Organization
from sentry.users.models.user import User


def is_logs_enabled(organization: Organization, actor: User | None = None) -> bool:
    """
    Check if logs are enabled for the given organization.
    This replaces individual feature flag checks for consolidated ourlogs features.
    """
    return features.has("organizations:ourlogs-enabled", organization, actor=actor)
