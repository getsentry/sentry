from urllib.parse import urlencode

from django import template
from django.template import Context
from django.urls import reverse

from sentry.models.organizationmember import OrganizationMember
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service
from sentry.utils.avatar import get_email_avatar, get_gravatar_url, get_letter_avatar
from sentry.utils.http import absolute_uri

register = template.Library()


# Adapted from http://en.gravatar.com/site/implement/images/django/
# The "mm" default is for the grey, "mystery man" icon. See:
#   http://en.gravatar.com/site/implement/images/
@register.simple_tag(takes_context=True)
def gravatar_url(context: Context, email: str, size: int, default: str = "mm") -> str:
    return get_gravatar_url(email, size, default)


@register.simple_tag(takes_context=True)
def letter_avatar_svg(
    context: Context, display_name: str, identifier: str, size: int | None = None
) -> str:
    return get_letter_avatar(display_name, identifier, size=size)


@register.simple_tag(takes_context=True)
def profile_photo_url(context: Context, user_id: int, size: int | None = None) -> str | None:
    user_avatar = user_service.get_user_avatar(user_id=user_id)

    if not user_avatar:
        return None
    url = reverse("sentry-user-avatar-url", args=[user_avatar.ident])
    if size:
        url += "?" + urlencode({"s": size})
    return absolute_uri(url)


# Don't use this in any situations where you're rendering more
# than 1-2 avatars. It will make a request for every user!
@register.simple_tag(takes_context=True)
def email_avatar(
    context: Context,
    display_name: str,
    identifier: str,
    size: int | None = None,
    try_gravatar: bool = True,
) -> str:
    return get_email_avatar(display_name, identifier, size, try_gravatar)


@register.inclusion_tag("sentry/partial/avatar.html")
def avatar(user: User | RpcUser | OrganizationMember, size: int = 36) -> dict[str, object]:
    # user can be User or OrganizationMember
    email: str | None
    user_id: int | None
    if isinstance(user, (User, RpcUser)):
        user_id = user.id
        email = user.email
    else:
        user_id = user.user_id
        email = user.email
        if user_id:
            email = getattr(user, "user").email

    return {
        "email": email,
        "user_id": user_id,
        "size": size,
        "avatar_type": user.get_avatar_type(),
        "display_name": user.get_display_name(),
        "label": user.get_label(),
    }


@register.inclusion_tag("sentry/partial/avatar.html")
def avatar_for_email(
    user: User | RpcUser | OrganizationMember, size: int = 36
) -> dict[str, object]:
    # user can be User or OrganizationMember
    email: str | None
    user_id: int | None
    if isinstance(user, (User, RpcUser)):
        user_id = user.id
        email = user.email
    else:
        user_id = user.user_id
        email = user.email
        if user_id:
            email = getattr(user, "user").email
    return {
        "for_email": True,
        "email": email,
        "user_id": user_id,
        "size": size,
        "avatar_type": user.get_avatar_type(),
        "display_name": user.get_display_name(),
        "label": user.get_label(),
    }
