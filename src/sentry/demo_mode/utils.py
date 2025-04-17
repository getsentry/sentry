from django.contrib.auth.models import AnonymousUser

from sentry import options
from sentry.models.organization import Organization
from sentry.organizations.services.organization import organization_service
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


def get_demo_org():
    if not is_demo_mode_enabled():
        return None

    demo_orgs = options.get("demo-mode.orgs")

    if demo_orgs is None or len(demo_orgs) == 0:
        return None

    org_id = demo_orgs[0]

    return organization_service.get_org_by_id(
        id=org_id,
    )


def get_demo_user():
    if not is_demo_mode_enabled():
        return None

    demo_users = options.get("demo-mode.users")

    if demo_users is None or len(demo_users) == 0:
        return None

    user_id = demo_users[0]

    return User.objects.get(id=user_id)


def get_readonly_scopes() -> frozenset[str]:
    return READONLY_SCOPES
