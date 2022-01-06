import logging

from django.http import HttpResponse
from django.template import loader

from sentry.utils.auth import get_login_url  # NOQA: backwards compatibility

logger = logging.getLogger("sentry")


def render_to_string(*a, **kw):
    # TODO: Remove this entirely. Turns out we don't need it anymore, but
    # replacing imports everywhere is bigger than I want to do in one PR.
    return loader.render_to_string(*a, **kw)


def render_to_response(template, context=None, request=None, status=200, content_type="text/html"):
    response = HttpResponse(render_to_string(template, context, request))
    response.status_code = status
    response["Content-Type"] = content_type
    return response
