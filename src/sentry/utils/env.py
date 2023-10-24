import sys
from enum import IntEnum

from django.conf import settings


def in_test_environment() -> bool:
    return "pytest" in sys.argv[0] or "vscode" in sys.argv[0]


def is_split_db() -> bool:
    if len(settings.DATABASES) != 1:  # type: ignore
        return True
    for db in settings.DATABASES.values():  # type: ignore
        if db["NAME"] in {"region", "control"}:
            return True
    return False


class AuthComponent(IntEnum):
    API_KEY_BACKED_AUTH = 1
    SENTRY_APP_BACKED_AUTH = 2
    API_TOKEN_BACKED_AUTH = 3
    ORG_AUTH_TOKEN_BACKED_AUTH = 4
    EMAIL_BACKED_AUTH = 5
    SOCIAL_BACKED_AUTH = 6


def should_use_rpc_user(component: AuthComponent) -> bool:
    from sentry import options
    from sentry.silo import SiloMode

    return (
        SiloMode.get_current_mode() != SiloMode.MONOLITH
        or options.get("hybrid_cloud.authentication.use_rpc_user") >= int(component)
        or in_test_environment()
    )


def should_use_authenticated_token(component: AuthComponent) -> bool:
    from sentry import options
    from sentry.silo import SiloMode

    return (
        SiloMode.get_current_mode() != SiloMode.MONOLITH
        or options.get("hybrid_cloud.authentication.use_authenticated_token") >= int(component)
        or in_test_environment()
    )
