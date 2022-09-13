from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, pending_silo_endpoint
from sentry.api.serializers import serialize
from sentry.grouping.strategies.configurations import CONFIGURATIONS


@pending_silo_endpoint
class GroupingConfigsEndpoint(Endpoint):
    permission_classes = ()

    def get(self, request: Request) -> Response:
        return Response(
            serialize(
                [config.as_dict() for config in sorted(CONFIGURATIONS.values(), key=lambda x: x.id)]
            )
        )
