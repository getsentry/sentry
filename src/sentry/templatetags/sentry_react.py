from django import template

from sentry.utils import json
from sentry.web.client_config import get_client_config

register = template.Library()


@register.simple_tag(takes_context=True)
def get_react_config(context):
    context = get_client_config(context.get("request", None))

    return json.dumps_htmlsafe(context)
