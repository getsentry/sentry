from django.http import Http404
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint


@region_silo_endpoint
class ReportingApiExperimentEndpoint(Endpoint):
    owner = ApiOwner.SECURITY
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    # Disable authentication and permission requirements.
    permission_classes = ()

    def post(self, request: Request) -> Response:
        """
        Endpoint for browser reporting API experiments.
        Returns 404 if the feature is not enabled.
        """
        if not options.get("api.reporting-api-experiment.enabled"):
            raise Http404("Reporting API experiment is not enabled")

        # Return a simple success response
        return Response({"status": "ok"}, status=200)
