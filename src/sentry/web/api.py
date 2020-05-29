from __future__ import absolute_import, print_function

import base64

import logging

from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.cache import cache_control
from django.views.generic.base import View as BaseView

from sentry.interfaces import schemas

from sentry.models import Project
from sentry.utils import json
from sentry.utils.http import get_origins
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
