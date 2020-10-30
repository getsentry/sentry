from __future__ import absolute_import, print_function

from django.http import HttpResponse
from django.views.decorators.cache import cache_control
from django.views.generic.base import View as BaseView

from sentry.models import Project
from sentry.utils import json
from sentry.utils.http import get_origins
from sentry.web.helpers import render_to_response
from sentry.web.client_config import get_client_config


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
