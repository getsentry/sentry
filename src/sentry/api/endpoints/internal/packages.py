import importlib.metadata

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, all_silo_endpoint
from sentry.api.permissions import SuperuserPermission
from sentry.plugins.base import plugins


@all_silo_endpoint
class InternalPackagesEndpoint(Endpoint):
    owner = ApiOwner.HYBRID_CLOUD
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (SuperuserPermission,)

    def get(self, request: Request) -> Response:
        data = {
            "modules": sorted(
                (dist.metadata["name"], dist.version) for dist in importlib.metadata.distributions()
            ),
            "extensions": [
                (p.get_title(), f"{p.__module__}.{p.__class__.__name__}")
                for p in plugins.all(version=None)
            ],
        }

        return Response(data)
