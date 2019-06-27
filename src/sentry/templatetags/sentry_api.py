from __future__ import absolute_import

from django import template

from sentry.auth.access import from_user, NoAccess
from sentry.api.serializers.base import serialize as serialize_func
from sentry.api.serializers.models.organization import (DetailedOrganizationSerializer)
from sentry.utils import json

register = template.Library()


@register.simple_tag(takes_context=True)
def serialize(context, obj):
    if 'request' in context:
        user = context['request'].user
    else:
        user = None

    return convert_to_json(serialize_func(obj, user))


@register.simple_tag
def convert_to_json(obj):
    return json.dumps_htmlsafe(obj)


@register.simple_tag(takes_context=True)
def serialize_detailed_org(context, obj):
    if 'request' in context:
        user = context['request'].user
        access = from_user(user, obj)
    else:
        user = None
        access = NoAccess()

    context = serialize_func(
        obj,
        user,
        DetailedOrganizationSerializer(),
        access=access
    )

    return convert_to_json(context)
