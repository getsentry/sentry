from __future__ import absolute_import

from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt

from sentry.api.base import Endpoint


class CatchallEndpoint(Endpoint):
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        return HttpResponse(status=404)
