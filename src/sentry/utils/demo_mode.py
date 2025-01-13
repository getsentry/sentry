from sentry import options
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


def is_readonly_user(user: User | None) -> bool:
    if not options.get("demo-mode.enabled"):
        return False

    if not user:
        return False

    email = getattr(user, "email", None)

    return email in options.get("demo-mode.users")


def get_readonly_scopes() -> frozenset[str]:
    return READONLY_SCOPES
