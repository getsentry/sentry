from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.serializers import serialize
from sentry.grouping.enhancer import ENHANCEMENT_BASES


class GroupingEnhancementsEndpoint(Endpoint):
    permission_classes = ()

    def get(self, request):
        return Response(
            serialize([e.as_dict() for e in sorted(ENHANCEMENT_BASES.values(), key=lambda x: x.id)])
        )
