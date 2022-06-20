from django.http import HttpResponse
from django.views.decorators.cache import cache_control
from django.views.generic.base import View as BaseView
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.utils import json
from sentry.web.client_config import get_client_config


class ClientConfigView(BaseView):
    def get(self, request: Request) -> Response:
        return HttpResponse(json.dumps(get_client_config(request)), content_type="application/json")


@cache_control(max_age=3600, public=True)
def robots_txt(request):
    return HttpResponse("User-agent: *\nDisallow: /\n", content_type="text/plain")
