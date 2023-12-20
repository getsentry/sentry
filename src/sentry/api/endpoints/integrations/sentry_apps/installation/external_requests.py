from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import SentryAppInstallationBaseEndpoint
from sentry.mediators.external_requests.select_requester import SelectRequester
from sentry.models.project import Project


@region_silo_endpoint
class SentryAppInstallationExternalRequestsEndpoint(SentryAppInstallationBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, installation) -> Response:
        try:
            project = Project.objects.get(
                id=request.GET.get("projectId"), organization_id=installation.organization_id
            )
        except Project.DoesNotExist:
            project = None

        kwargs = {
            "install": installation,
            "uri": request.GET.get("uri"),
            "query": request.GET.get("query"),
            "dependent_data": request.GET.get("dependentData"),
        }

        if project:
            kwargs.update({"project_slug": project.slug})

        try:
            choices = SelectRequester.run(**kwargs)
        except Exception:
            return Response({"error": "Error communicating with Sentry App service"}, status=400)

        return Response(choices)
