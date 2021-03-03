from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.serializers import serialize
from sentry.grouping.strategies.configurations import CONFIGURATIONS


class GroupingConfigsEndpoint(Endpoint):
    permission_classes = ()

    def get(self, request):
        return Response(
            serialize(
                [config.as_dict() for config in sorted(CONFIGURATIONS.values(), key=lambda x: x.id)]
            )
        )
