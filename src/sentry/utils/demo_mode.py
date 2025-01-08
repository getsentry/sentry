from sentry import options
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
