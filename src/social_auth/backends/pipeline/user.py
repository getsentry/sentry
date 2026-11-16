from collections.abc import Callable, Mapping
from typing import Any, cast
from uuid import uuid4

from sentry.users.models.user import User
from social_auth.backends import SocialAuthBackend
from social_auth.django_compat import get_all_field_names
from social_auth.models import UserSocialAuth
from social_auth.utils import module_member, setting

slugify = cast(
    "Callable[[str], str]",
    module_member(setting("SOCIAL_AUTH_SLUGIFY_FUNCTION", "django.utils.text.slugify")),
)


def get_username(
    details: Mapping[str, Any],
    user: User | None = None,
    user_exists: Callable[..., bool] = UserSocialAuth.simple_user_exists,
    *args: object,
    **kwargs: object,
) -> dict[str, object]:
    """Return an username for new user. Return current user username
    if user was given.
    """
    if user:
        return {"username": UserSocialAuth.user_username(user)}

    email_as_username = setting("SOCIAL_AUTH_USERNAME_IS_FULL_EMAIL", False)
    uuid_length = setting("SOCIAL_AUTH_UUID_LENGTH", 16)
    do_slugify = setting("SOCIAL_AUTH_SLUGIFY_USERNAMES", False)

    if email_as_username and details.get("email"):
        username = details["email"]
    elif details.get("username"):
        username = str(details["username"])
    else:
        username = uuid4().hex

    max_length = UserSocialAuth.username_max_length()
    short_username = username[: max_length - uuid_length]
    final_username = UserSocialAuth.clean_username(username[:max_length])
    if do_slugify:
        final_username = slugify(final_username)

    # Generate a unique username for current user using username
    # as base but adding a unique hash at the end. Original
    # username is cut to avoid any field max_length.
    while user_exists(username=final_username):
        username = short_username + uuid4().hex[:uuid_length]
        username = username[:max_length]
        final_username = UserSocialAuth.clean_username(username)
        if do_slugify:
            final_username = slugify(final_username)
    return {"username": final_username}


def create_user(
    backend: SocialAuthBackend,
    details: Mapping[str, Any],
    response: Mapping[str, Any],
    uid: str,
    username: str | None,
    user: User | None = None,
    *args: object,
    **kwargs: object,
) -> dict[str, object] | None:
    """Create user. Depends on get_username pipeline."""
    if user:
        return {"user": user}
    if not username:
        return None

    # Avoid hitting field max length
    email = details.get("email")
    original_email: str | None = None
    if email and UserSocialAuth.email_max_length() < len(email):
        original_email = email
        email = ""

    return {
        "user": UserSocialAuth.create_user(username=username, email=email),
        "original_email": original_email,
        "is_new": True,
    }


def _ignore_field(name: str, is_new: bool = False) -> bool:
    if name in ("username", "id", "pk"):
        return True

    if not is_new and name in setting("SOCIAL_AUTH_PROTECTED_USER_FIELDS", []):
        return True
    return False


def django_orm_maxlength_truncate(
    backend: SocialAuthBackend,
    details: Mapping[str, Any],
    user: User | None = None,
    is_new: bool = False,
    *args: object,
    **kwargs: object,
) -> dict[str, dict[str, Any]] | None:
    """Truncate any value in details that corresponds with a field in the user
    model. Add this entry to the pipeline before update_user_details"""
    if user is None:
        return None
    out: dict[str, Any] = {}
    names = get_all_field_names(user)
    for name, value in details.items():
        if name in names and not _ignore_field(name, is_new):
            max_length = getattr(user._meta.get_field(name), "max_length", None)
            try:
                if max_length and len(value) > max_length:
                    value = value[:max_length]
            except TypeError:
                pass
        out[name] = value
    return {"details": out}


def update_user_details(
    backend: SocialAuthBackend,
    details: Mapping[str, Any],
    response: Mapping[str, Any],
    user: User | None = None,
    is_new: bool = False,
    *args: object,
    **kwargs: object,
) -> None:
    """Update user details using data from provider."""
    if user is None:
        return

    changed = False  # flag to track changes

    for name, value in details.items():
        # do not update username, it was already generated, do not update
        # configured fields if user already existed
        if not _ignore_field(name, is_new):
            if hasattr(user, name) and value and value != getattr(user, name, None):
                setattr(user, name, value)
                changed = True

    if changed and hasattr(user, "save"):
        user.save()
