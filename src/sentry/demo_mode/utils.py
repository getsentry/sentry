from typing import int
from django.contrib.auth.models import AnonymousUser

from sentry import options
from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcOrganization
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser

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


def is_demo_mode_enabled() -> bool:
    return options.get("demo-mode.enabled")


def is_demo_user(user: User | AnonymousUser | None | RpcUser) -> bool:

    if not user:
        return False

    return user.id in options.get("demo-mode.users")


def is_demo_org(organization: Organization | RpcOrganization | None) -> bool:

    if not organization:
        return False

    return organization.id in options.get("demo-mode.orgs")


def get_demo_org() -> Organization | None:
    if not is_demo_mode_enabled():
        return None

    org_id = options.get("demo-mode.orgs")[0]
    return Organization.objects.get(id=org_id)


def get_demo_user() -> User | None:
    if not is_demo_mode_enabled():
        return None

    user_id = options.get("demo-mode.users")[0]
    return User.objects.get(id=user_id)


def get_readonly_scopes() -> frozenset[str]:
    return READONLY_SCOPES
