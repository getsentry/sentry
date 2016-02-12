from __future__ import absolute_import

from django import template
from django.http import HttpRequest
from django.utils.html import mark_safe

from sentry.api.serializers.base import serialize as serialize_func
from sentry.api.serializers.models.organization import (
    DetailedOrganizationSerializer
)
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
def convert_to_json(obj, escape=False):
    data = json.dumps(obj)
    if escape:
        data = data.replace('<', '&lt;').replace('>', '&gt;')
    return mark_safe(data)


@register.simple_tag(takes_context=True)
def serialize_detailed_org(context, obj):
    if 'request' in context:
        user = context['request'].user
    else:
        user = None

    context = serialize_func(
        obj,
        user,
        DetailedOrganizationSerializer(),
    )

    return mark_safe(json.dumps(context))


@register.simple_tag
def get_user_context(request, escape=False):
    if isinstance(request, HttpRequest):
        user = getattr(request, 'user', None)
        result = {'ip_address': request.META['REMOTE_ADDR']}
        if user and user.is_authenticated():
            result.update({
                'email': user.email,
                'id': user.id,
            })
            if user.name:
                result['name'] = user.name
    else:
        result = {}
    return mark_safe(json.dumps(result))
