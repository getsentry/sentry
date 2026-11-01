from typing import Any
from unittest.mock import patch

from django.conf import settings

from sentry.roles.manager import RoleManager


def granular_roles_granting(*scopes: str) -> Any:
    """Patch every granular organization role to also grant `scopes`.

    For testing endpoints that accept a scope before any role grants it. Token scopes are
    limited to the member's role scopes, so without this such a token can't reach the
    endpoint. Use as a decorator or context manager, together with the
    `organizations:granular-permission-scopes` feature.
    """
    granular_roles = tuple(
        {**role, "scopes": {*role["scopes"], *scopes}} for role in settings.SENTRY_GRANULAR_ROLES
    )
    return patch(
        "sentry.roles.granular_manager",
        RoleManager(granular_roles, settings.SENTRY_TEAM_ROLES, settings.SENTRY_DEFAULT_ROLE),
    )
