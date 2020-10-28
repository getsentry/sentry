from __future__ import absolute_import

from rest_framework.response import Response

from sentry import tsdb
from sentry.api.base import Endpoint, StatsMixin
from sentry.api.permissions import SuperuserPermission


class InternalStatsEndpoint(Endpoint, StatsMixin):
    permission_classes = (SuperuserPermission,)

    def get(self, request):
        key = request.GET["key"]

        data = tsdb.get_range(model=tsdb.models.internal, keys=[key], **self._parse_args(request))[
            key
        ]

        return Response(data)
