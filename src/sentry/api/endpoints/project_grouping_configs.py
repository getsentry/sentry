from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.grouping.strategies.configurations import CONFIGURATIONS


@region_silo_endpoint
class ProjectGroupingConfigsEndpoint(ProjectEndpoint):
    """Retrieve available grouping configs with project-specific information

    See GroupingConfigsEndpoint
    """

    def get(self, request: Request, project) -> Response:

        configs = [
            config.as_dict() for config in sorted(CONFIGURATIONS.values(), key=lambda x: x.id)
        ]

        return Response(serialize(configs))
