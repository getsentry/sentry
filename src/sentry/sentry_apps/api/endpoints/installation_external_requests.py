import logging
from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.sentry_apps.api.bases.sentryapps import SentryAppInstallationBaseEndpoint
from sentry.sentry_apps.services.app.model import RpcSentryAppInstallation
from sentry.sentry_apps.services.region import sentry_app_region_service

logger = logging.getLogger("sentry.sentry-apps")


@control_silo_endpoint
class SentryAppInstallationExternalRequestsEndpoint(SentryAppInstallationBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, installation: RpcSentryAppInstallation) -> Response:
        uri = request.GET.get("uri")
        if not uri:
            return Response({"detail": "uri query parameter is required"}, status=400)

        result = sentry_app_region_service.get_select_options(
            organization_id=installation.organization_id,
            installation=installation,
            uri=request.GET.get("uri"),
            project_id=int(request.GET["projectId"]) if request.GET.get("projectId") else None,
            query=request.GET.get("query"),
            dependent_data=request.GET.get("dependentData"),
        )

        if result.error:
            return self.respond_rpc_sentry_app_error(result.error)

        response_data: dict[str, Any] = {"choices": result.choices}
        if result.default_value is not None:
            response_data["defaultValue"] = result.default_value
        return Response(response_data)
