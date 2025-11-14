from typing import int
import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.permissions import SentryIsAuthenticated
from sentry.replays.data_export import request_run_transfer_job, retry_transfer_job_run

logger = logging.getLogger()


@control_silo_endpoint
class DataExportNotificationsEndpoint(Endpoint):
    """PubSub notifications endpoint."""

    owner = ApiOwner.REPLAY
    publish_status = {"POST": ApiPublishStatus.PRIVATE}
    permission_classes = (SentryIsAuthenticated,)

    def post(self, request: Request) -> Response:
        retry_transfer_job_run(request.data, request_run_transfer_job)
        return Response("", status=200)
