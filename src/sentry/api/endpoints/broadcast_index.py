from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.serializers import serialize
from sentry.models import Broadcast


class BroadcastIndexEndpoint(Endpoint):
    def get(self, request):
        broadcasts = list(Broadcast.objects.filter(is_active=True))

        return Response(serialize(broadcasts, request.user))
