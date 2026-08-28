from django import template

from sentry.utils import json
from sentry.web.client_config import get_client_config, get_user_theme_class

register = template.Library()


@register.simple_tag(takes_context=True)
def get_react_config(context):
    context = get_client_config(context.get("request", None), context.get("org_context"))

    return json.dumps_htmlsafe(context)


@register.simple_tag(takes_context=True)
def user_theme_class(context):
    """Body theme class shared with the React shell (theme-light|dark|system)."""
    return get_user_theme_class(context.get("request"))
