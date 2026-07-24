import logging
from typing import Any

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.sentry_apps.api.bases.sentryapps import SentryAppInstallationBaseEndpoint
from sentry.sentry_apps.external_requests.utils import validate_sentry_app_uri
from sentry.sentry_apps.services.app.model import RpcSentryAppInstallation
from sentry.sentry_apps.services.cell import sentry_app_cell_service
from sentry.users.services.user.serial import serialize_generic_user

logger = logging.getLogger("sentry.sentry-apps")


class SentryAppInstallationExternalRequestsSerializer(serializers.Serializer):
    uri = serializers.CharField(required=True, validators=[validate_sentry_app_uri])
    projectId = serializers.IntegerField(required=False)
    query = serializers.CharField(required=False)
    dependentData = serializers.CharField(required=False)


@control_silo_endpoint
class SentryAppInstallationExternalRequestsEndpoint(SentryAppInstallationBaseEndpoint):
    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, installation: RpcSentryAppInstallation) -> Response:
        serializer = SentryAppInstallationExternalRequestsSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        rpc_user = serialize_generic_user(request.user)
        if rpc_user is None:
            return Response({"detail": "Authentication credentials were not provided."}, status=401)

        validated = serializer.validated_data

        result = sentry_app_cell_service.get_select_options(
            organization_id=installation.organization_id,
            installation=installation,
            uri=validated["uri"],
            project_id=validated.get("projectId"),
            query=validated.get("query"),
            dependent_data=validated.get("dependentData"),
            user=rpc_user,
        )

        if result.error:
            return self.respond_rpc_sentry_app_error(result.error)

        response_data: dict[str, Any] = {"choices": result.choices}
        if result.default_value is not None:
            response_data["defaultValue"] = result.default_value
        return Response(response_data)
