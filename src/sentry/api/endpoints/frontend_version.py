from typing import int
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, all_silo_endpoint
from sentry.utils.assets import get_frontend_commit_sha


@all_silo_endpoint
class FrontendVersionEndpoint(Endpoint):
    owner = ApiOwner.HYBRID_CLOUD
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    permission_classes = ()

    def get(self, request: Request) -> Response:
        return Response({"version": get_frontend_commit_sha()})
