from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tsdb
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, StatsMixin, region_silo_endpoint
from sentry.api.permissions import SuperuserPermission
from sentry.tsdb.base import TSDBModel


@region_silo_endpoint
class InternalStatsEndpoint(Endpoint, StatsMixin):
    owner = ApiOwner.DEV_INFRA
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (SuperuserPermission,)

    def get(self, request: Request) -> Response:
        key = request.GET["key"]

        data = tsdb.backend.get_range(
            model=TSDBModel.internal, keys=[key], **self._parse_args(request)
        )[key]

        return Response(data)
