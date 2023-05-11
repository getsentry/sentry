import logging

from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, control_silo_endpoint

logger = logging.getLogger("sentry.integrations.cloudflare")


@control_silo_endpoint
class CloudflareMetadataEndpoint(Endpoint):
    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        logger.info("cloudflare.metadata", extra={"user_id": request.user.id})
        return Response(
            {
                "metadata": {
                    "username": request.user.username,
                    "userId": str(request.user.id),
                    "email": request.user.email,
                }
            }
        )
