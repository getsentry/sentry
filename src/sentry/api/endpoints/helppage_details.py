from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.base import Endpoint
from sentry.api.serializers import serialize
from sentry.models import HelpPage


class HelpPageDetailsEndpoint(Endpoint):
    permission_classes = ()

    def get(self, request, page_id):
        try:
            page = HelpPage.objects.get_from_cache(
                id=page_id,
            )
        except HelpPage.DoesNotExist:
            raise ResourceDoesNotExist

        context = serialize(page)
        context['content'] = page.content

        return Response(context)
