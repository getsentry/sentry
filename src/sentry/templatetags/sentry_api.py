from django import template
from django.http import HttpRequest
from django.template import Context

from sentry.api.serializers.base import serialize as serialize_func
from sentry.api.serializers.models.organization import (
    OrganizationWithProjectsAndTeamsSerializer,
)
from sentry.auth.access import NoAccess, from_user
from sentry.models.organization import Organization
from sentry.utils import json

register = template.Library()


@register.simple_tag(takes_context=True)
def serialize(context: Context, obj: object) -> str:
    if "request" in context:
        user = context["request"].user
    else:
        user = None

    return convert_to_json(serialize_func(obj, user))


@register.simple_tag
def convert_to_json(obj: object) -> str:
    return json.dumps_htmlsafe(obj)


@register.simple_tag(takes_context=True)
def serialize_detailed_org(context: Context, obj: Organization) -> str:
    if "request" in context:
        user = context["request"].user
        access = from_user(user, obj)
    else:
        user = None
        access = NoAccess()

    serialized_org = serialize_func(
        obj, user, OrganizationWithProjectsAndTeamsSerializer(), access=access
    )

    return convert_to_json(serialized_org)


@register.simple_tag
def get_recipient_context(request: object, escape: bool = False) -> str:
    if isinstance(request, HttpRequest):
        user = getattr(request, "user", None)
        result = {"ip_address": request.META["REMOTE_ADDR"]}
        if user and user.is_authenticated:
            result.update({"email": user.email, "id": user.id})
            if user.name:
                result["name"] = user.name
    else:
        result = {}
    return convert_to_json(result)
