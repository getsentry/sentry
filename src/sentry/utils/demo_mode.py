from django.contrib.auth.models import AnonymousUser

from sentry import options
from sentry.models.organization import Organization
from sentry.users.models.user import User

READONLY_SCOPES = frozenset(
    [
        "project:read",
        "org:read",
        "event:read",
        "member:read",
        "team:read",
        "project:releases",
        "alerts:read",
    ]
)


def is_demo_mode_enabled():
    return options.get("demo-mode.enabled")


def is_demo_user(user: User | AnonymousUser | None) -> bool:

    if not user:
        return False

    return user.id in options.get("demo-mode.users")


def is_demo_org(organization: Organization | None):

    if not organization:
        return False

    return organization.id in options.get("demo-mode.orgs")


def get_readonly_user():
    if not is_demo_mode_enabled():
        return None

    user_id = options.get("demo-mode.users")[0]
    return User.objects.get(id=user_id)


def get_readonly_scopes() -> frozenset[str]:
    return READONLY_SCOPES
