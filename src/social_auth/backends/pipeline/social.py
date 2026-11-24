from collections.abc import Mapping
from typing import Any

from django.db import IntegrityError

from sentry.users.models.user import User
from social_auth.backends import SocialAuthBackend
from social_auth.models import UserSocialAuth


def social_auth_user(
    backend: SocialAuthBackend,
    uid: str,
    user: User,
    *args: object,
    **kwargs: object,
) -> dict[str, object]:
    """
    Return UserSocialAuth details.
    """
    social_user = UserSocialAuth.get_social_auth(backend.name, uid, user)
    return {"social_user": social_user, "user": user, "new_association": False}


def associate_user(
    backend: SocialAuthBackend,
    user: User | None,
    uid: str,
    social_user: UserSocialAuth | None = None,
    *args: object,
    **kwargs: object,
) -> dict[str, object] | None:
    """Associate user social account with user instance."""
    if social_user or not user:
        return None

    try:
        social = UserSocialAuth.create_social_auth(user, uid, backend.name)
    except IntegrityError:
        # Protect for possible race condition, those bastard with FTL
        # clicking capabilities, check issue #131:
        #   https://github.com/omab/django-social-auth/issues/131
        return social_auth_user(backend, uid, user, social_user=social_user, *args, **kwargs)
    else:
        return {"social_user": social, "user": social.user, "new_association": True}


def load_extra_data(
    backend: SocialAuthBackend,
    details: Mapping[str, Any],
    response: Mapping[str, Any],
    uid: str,
    user: User,
    social_user: UserSocialAuth | None = None,
    *args: object,
    **kwargs: object,
) -> dict[str, object] | None:
    """Load extra data from provider and store it on current UserSocialAuth
    extra_data field.
    """
    social_user = social_user or UserSocialAuth.get_social_auth(backend.name, uid, user)
    if social_user:
        extra_data = backend.extra_data(user, uid, response, details)
        if kwargs.get("original_email") and "email" not in extra_data:
            extra_data["email"] = kwargs.get("original_email")
        if extra_data and social_user.extra_data != extra_data:
            if social_user.extra_data:
                social_user.extra_data.update(extra_data)
            else:
                social_user.extra_data = extra_data
            social_user.save()
        return {"social_user": social_user}
    return None
