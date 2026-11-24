from django import template
from django.template import Context

from sentry.utils import json
from sentry.web.client_config import get_client_config

register = template.Library()


@register.simple_tag(takes_context=True)
def get_react_config(context: Context) -> str:
    client_config = get_client_config(context.get("request", None), context.get("org_context"))

    return json.dumps_htmlsafe(client_config)
