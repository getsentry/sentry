from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tsdb
from sentry.api.base import Endpoint, StatsMixin, region_silo_endpoint
from sentry.api.permissions import SuperuserPermission


@region_silo_endpoint
class InternalStatsEndpoint(Endpoint, StatsMixin):
    permission_classes = (SuperuserPermission,)

    def get(self, request: Request) -> Response:
        key = request.GET["key"]

        data = tsdb.get_range(model=tsdb.models.internal, keys=[key], **self._parse_args(request))[
            key
        ]

        return Response(data)
