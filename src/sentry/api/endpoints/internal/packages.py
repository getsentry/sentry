import pkg_resources
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, all_silo_endpoint
from sentry.api.permissions import SuperuserPermission
from sentry.plugins.base import plugins


@all_silo_endpoint
class InternalPackagesEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)

    def get(self, request: Request) -> Response:
        data = {
            "modules": sorted((p.project_name, p.version) for p in pkg_resources.working_set),
            "extensions": [
                (p.get_title(), f"{p.__module__}.{p.__class__.__name__}")
                for p in plugins.all(version=None)
            ],
        }

        return Response(data)
