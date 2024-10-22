import logging

from jsonschema import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.coreapi import APIError
from sentry.models.project import Project
from sentry.sentry_apps.api.bases.sentryapps import SentryAppInstallationBaseEndpoint
from sentry.sentry_apps.external_requests.select_requester import SelectRequester

logger = logging.getLogger("sentry.sentry-apps")


@region_silo_endpoint
class SentryAppInstallationExternalRequestsEndpoint(SentryAppInstallationBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
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
            choices = SelectRequester(**kwargs).run()
        except ValidationError as e:
            return Response(
                {"error": e.message},
                status=400,
            )
        except APIError:
            message = f'Error retrieving select field options from {request.GET.get("uri")}'
            return Response(
                {"error": message},
                status=400,
            )

        return Response(choices)
