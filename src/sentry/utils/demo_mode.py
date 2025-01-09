from sentry import options
from sentry.models.organization import Organization
from sentry.users.models.user import User


def is_readonly_user(user: User | None) -> bool:
    if not options.get("demo-mode.enabled"):
        return False

    if not user:
        return False

    email = getattr(user, "email", None)

    if email:
        return True

    return email in options.get("demo-mode.users")


def is_demo_org(organization: Organization | None):
    if not options.get("demo-mode.enabled"):
        return False

    if not organization:
        return False

    return organization.id in options.get("demo-mode.orgs")


def get_readonly_user():
    if not options.get("demo-mode.enabled"):
        return None

    email = options.get("demo-mode.users")[0]
    return User.objects.get(email=email)
