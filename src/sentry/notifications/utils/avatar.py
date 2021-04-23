from django.urls import reverse
from django.utils.html import escape

from sentry.models import User, UserAvatar
from sentry.utils.assets import get_asset_url
from sentry.utils.avatar import get_email_avatar
from sentry.utils.http import absolute_uri


def get_user_avatar_url(user: User, size: int = 20) -> str:
    try:
        avatar = UserAvatar.objects.get(user=user)
    except UserAvatar.DoesNotExist:
        return ""

    url = reverse("sentry-user-avatar-url", args=[avatar.ident])
    if size:
        url = f"{url}?s={int(size)}"
    return str(absolute_uri(url))


def get_sentry_avatar_url() -> str:
    url = "/images/sentry-email-avatar.png"
    return str(absolute_uri(get_asset_url("sentry", url)))


def avatar_as_html(user: User) -> str:
    if not user:
        return '<img class="avatar" src="{}" width="20px" height="20px" />'.format(
            escape(get_sentry_avatar_url())
        )
    avatar_type = user.get_avatar_type()
    if avatar_type == "upload":
        return f'<img class="avatar" src="{escape(get_user_avatar_url(user))}" />'
    elif avatar_type == "letter_avatar":
        return get_email_avatar(user.get_display_name(), user.get_label(), 20, False)
    else:
        return get_email_avatar(user.get_display_name(), user.get_label(), 20, True)
