import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import ApiKeyAuthentication
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.permissions import SentryIsAuthenticated
from sentry.replays.data_export import retry_transfer_job_run

logger = logging.getLogger()


@control_silo_endpoint
class NotificationEndpoint(Endpoint):
    """PubSub notifications endpoint."""

    owner = ApiOwner.REPLAY
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    authentication_classes = (ApiKeyAuthentication,)
    permission_classes = (SentryIsAuthenticated,)

    def get(self, request: Request, service: str) -> Response:
        if service == "google-cloud":
            retry_transfer_job_run(request.data)
        else:
            logger.error("Service has not been implemented.", extra={"service": service})

        # We always return 200 because this is an programmatic request issued by a service
        # provider. We don't want to process the same message multiple times.
        return Response("", status="200")
