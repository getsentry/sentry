"""
Permission helpers for preprod features.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sentry import features

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.users.models.user import RpcUser, User


def has_preprod_access(organization: Organization, user: User | RpcUser | None = None) -> bool:
    if organization.flags.early_adopter:
        return True
    return features.has("organizations:preprod-frontend-routes", organization, actor=user)
