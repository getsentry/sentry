from django import template
from django.utils.safestring import mark_safe

from sentry.utils.avatar import get_letter_avatar, get_platform_avatar

register = template.Library()


@register.simple_tag(takes_context=True)
def letter_platform_svg(context, display_name, identifier, size=None, rounded=False):
    return mark_safe(
        get_letter_avatar(
            display_name,
            identifier,
            size,
            use_svg=False,
            initials=display_name[0:2] if display_name else None,
            rounded=rounded,
        )
    )


@register.simple_tag(takes_context=True)
def platform_avatar(context, display_name, size=36):
    return mark_safe(get_platform_avatar(display_name, size))
