from django import template
from django.utils.html import mark_safe

from sentry.api.serializers.base import serialize as serialize_func
from sentry.utils import json


register = template.Library()


@register.simple_tag(takes_context=True)
def serialize(context, obj):
    if 'request' in context:
        user = context['request'].user
    else:
        user = None

    return mark_safe(json.dumps(serialize_func(obj, user)))


@register.simple_tag
def convert_to_json(obj):
    return mark_safe(json.dumps(obj).replace('<', '&lt;').replace('>', '&gt;'))
