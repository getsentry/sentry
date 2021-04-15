"""
Note: Also see letterAvatar.jsx. Anything changed in this file (how colors are
      selected, the svg, etc) will also need to be changed there.
"""
from typing import MutableMapping, Optional, Union
from urllib.parse import urlencode

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.utils.encoding import force_text
from django.utils.html import escape

from sentry.http import safe_urlopen
from sentry.utils.compat import map
from sentry.utils.hashlib import md5_text


def get_gravatar_url(
    email: Optional[str], size: Optional[int] = None, default: Optional[Union[int, str]] = "mm"
) -> str:
    if email is None:
        email = ""
    gravatar_url = "{}/avatar/{}".format(
        settings.SENTRY_GRAVATAR_BASE_URL,
        md5_text(email.lower()).hexdigest(),
    )

    properties: MutableMapping[str, Union[int, str]] = {}
    if size:
        properties["s"] = str(size)
    if default:
        properties["d"] = default
    if properties:
        gravatar_url += "?" + urlencode(properties)

    return gravatar_url


LETTER_AVATAR_COLORS = [
    "#4674ca",  # blue
    "#315cac",  # blue_dark
    "#57be8c",  # green
    "#3fa372",  # green_dark
    "#f9a66d",  # yellow_orange
    "#ec5e44",  # red
    "#e63717",  # red_dark
    "#f868bc",  # pink
    "#6c5fc7",  # purple
    "#4e3fb4",  # purple_dark
    "#57b1be",  # teal
    "#847a8c",  # gray
]

COLOR_COUNT = len(LETTER_AVATAR_COLORS)


def hash_user_identifier(identifier: str) -> int:
    identifier = force_text(identifier, errors="replace")
    return sum(map(ord, identifier))


def get_letter_avatar_color(identifier: str) -> str:
    hashed_id = hash_user_identifier(identifier)
    return LETTER_AVATAR_COLORS[hashed_id % COLOR_COUNT]


def get_letter_avatar(
    display_name: Optional[str],
    identifier: str,
    size: Optional[int] = None,
    use_svg: Optional[bool] = True,
) -> str:
    display_name = (display_name or "").strip() or "?"
    names = display_name.split(" ")
    initials = "{}{}".format(names[0][0], names[-1][0] if len(names) > 1 else "")
    initials = escape(initials.upper())
    color = get_letter_avatar_color(identifier)
    if use_svg:
        size_attrs = f'height="{size}" width="{size}"' if size else ""
        return (
            '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" {size_attrs}>'
            '<rect x="0" y="0" width="120" height="120" rx="15" ry="15" fill={color}></rect>'
            '<text x="50%" y="50%" font-size="65" dominant-baseline="central" text-anchor="middle" fill="#FFFFFF">'
            "{initials}"
            "</text>"
            "</svg>"
        ).format(color=color, initials=initials, size_attrs=size_attrs)
    else:
        size_attrs = f"height:{size}px;width:{size}px;" if size else ""
        font_size = "font-size:%spx;" % (size / 2) if size else ""
        line_height = "line-height:%spx;" % size if size else ""
        return (
            '<span class="html-avatar" '
            'style="background-color:{color};{size_attrs}{font_size}{line_height}">'
            "{initials}</span>"
        ).format(
            color=color,
            initials=initials,
            size_attrs=size_attrs,
            font_size=font_size,
            line_height=line_height,
        )


def get_email_avatar(
    display_name: Optional[str],
    identifier: str,
    size: Optional[int] = None,
    try_gravatar: Optional[bool] = True,
) -> str:
    if try_gravatar:
        try:
            validate_email(identifier)
        except ValidationError:
            pass
        else:
            try:
                resp = safe_urlopen(get_gravatar_url(identifier, default=404))
            except Exception:
                pass
            else:
                if resp.status_code == 200:
                    # default to mm if including in emails
                    gravatar_url = get_gravatar_url(identifier, size=size)
                    return f'<img class="avatar" src="{gravatar_url}">'
    return get_letter_avatar(display_name, identifier, size, use_svg=False)
