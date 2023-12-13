from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.serializers import serialize
from sentry.grouping.strategies.configurations import CONFIGURATIONS


@region_silo_endpoint
class GroupingConfigsEndpoint(Endpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = ()

    def get(self, request: Request, **kwargs) -> Response:
        return Response(
            serialize(
                [config.as_dict() for config in sorted(CONFIGURATIONS.values(), key=lambda x: x.id)]
            )
        )
