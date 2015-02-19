from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.serializers import serialize
from sentry.models import HelpPage


class HelpPageIndexEndpoint(Endpoint):
    permission_classes = ()

    def get(self, request):
        pages = sorted(HelpPage.objects.filter(
            is_visible=True,
        ), key=lambda x: (-x.priority, x.title))

        return Response(serialize(pages))
