import logging

import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.models.project import Project
from sentry.sentry_apps.api.bases.sentryapps import SentryAppInstallationBaseEndpoint
from sentry.sentry_apps.external_requests.select_requester import SelectRequester
from sentry.sentry_apps.utils.errors import SentryAppError, SentryAppIntegratorError

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
        except (SentryAppIntegratorError, SentryAppError) as e:
            return Response(
                {"error": str(e)},
                status=400,
            )
        except Exception as e:
            error_id = sentry_sdk.capture_exception(e)
            return Response(
                {
                    "error": f"Something went wrong while trying to get Select FormField options. Sentry error ID: {error_id}"
                },
                status=500,
            )

        return Response(choices)
