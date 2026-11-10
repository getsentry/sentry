from django import template
from django.template import Context

from sentry.utils.avatar import get_letter_avatar, get_platform_avatar

register = template.Library()


@register.simple_tag(takes_context=True)
def letter_platform_svg(
    context: Context,
    display_name: str,
    identifier: str,
    size: int | None = None,
    rounded: bool = False,
) -> str:
    return get_letter_avatar(
        display_name,
        identifier,
        size,
        use_svg=False,
        initials=display_name[0:2] if display_name else None,
        rounded=rounded,
    )


@register.simple_tag(takes_context=True)
def platform_avatar(context: Context, display_name: str, size: int = 36) -> str:
    return get_platform_avatar(display_name, size)
