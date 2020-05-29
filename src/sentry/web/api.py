from __future__ import absolute_import, print_function

import base64

import logging

from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.cache import cache_control
from django.views.generic.base import View as BaseView
from functools import wraps

from sentry.interfaces import schemas

from sentry.models import Project
from sentry.utils import json
from sentry.utils.http import get_origins, origin_from_request
from sentry.utils.pubsub import QueuedPublisherService, KafkaPublisher
from sentry.web.helpers import render_to_response
from sentry.web.client_config import get_client_config

logger = logging.getLogger("sentry")
minidumps_logger = logging.getLogger("sentry.minidumps")

# Transparent 1x1 gif
# See http://probablyprogramming.com/2009/03/15/the-tiniest-gif-ever
PIXEL = base64.b64decode("R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=")

PROTOCOL_VERSIONS = frozenset(("2.0", "3", "4", "5", "6", "7"))

kafka_publisher = (
    QueuedPublisherService(
        KafkaPublisher(
            getattr(settings, "KAFKA_RAW_EVENTS_PUBLISHER_CONNECTION", None), asynchronous=False
        )
    )
    if getattr(settings, "KAFKA_RAW_EVENTS_PUBLISHER_ENABLED", False)
    else None
)


def allow_cors_options(func):
    """
    Decorator that adds automatic handling of OPTIONS requests for CORS

    If the request is OPTIONS (i.e. pre flight CORS) construct a OK (200) response
    in which we explicitly enable the caller and add the custom headers that we support
    For other requests just add the appropriate CORS headers

    :param func: the original request handler
    :return: a request handler that shortcuts OPTIONS requests and just returns an OK (CORS allowed)
    """

    @wraps(func)
    def allow_cors_options_wrapper(self, request, *args, **kwargs):

        if request.method == "OPTIONS":
            response = HttpResponse(status=200)
            response["Access-Control-Max-Age"] = "3600"  # don't ask for options again for 1 hour
        else:
            response = func(self, request, *args, **kwargs)

        allow = ", ".join(self._allowed_methods())
        response["Allow"] = allow
        response["Access-Control-Allow-Methods"] = allow
        response["Access-Control-Allow-Headers"] = (
            "X-Sentry-Auth, X-Requested-With, Origin, Accept, "
            "Content-Type, Authentication, Authorization, Content-Encoding"
        )
        response["Access-Control-Expose-Headers"] = "X-Sentry-Error, Retry-After"

        if request.META.get("HTTP_ORIGIN") == "null":
            origin = "null"  # if ORIGIN header is explicitly specified as 'null' leave it alone
        else:
            origin = origin_from_request(request)

        if origin is None or origin == "null":
            response["Access-Control-Allow-Origin"] = "*"
        else:
            response["Access-Control-Allow-Origin"] = origin

        return response

    return allow_cors_options_wrapper


class StoreSchemaView(BaseView):
    def get(self, request, **kwargs):
        return HttpResponse(json.dumps(schemas.EVENT_SCHEMA), content_type="application/json")


class ClientConfigView(BaseView):
    def get(self, request):
        return HttpResponse(json.dumps(get_client_config(request)), content_type="application/json")


@cache_control(max_age=3600, public=True)
def robots_txt(request):
    return HttpResponse("User-agent: *\nDisallow: /\n", content_type="text/plain")


@cache_control(max_age=60)
def crossdomain_xml(request, project_id):
    if not project_id.isdigit():
        return HttpResponse(status=404)

    try:
        project = Project.objects.get_from_cache(id=project_id)
    except Project.DoesNotExist:
        return HttpResponse(status=404)

    origin_list = get_origins(project)
    response = render_to_response("sentry/crossdomain.xml", {"origin_list": origin_list})
    response["Content-Type"] = "application/xml"

    return response
