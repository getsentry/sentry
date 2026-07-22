from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import SentryAppParams
from sentry.apidocs.response_types import (
    DetailResponse,
    ValidationErrorResponse,
    as_validation_errors,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.sentry_apps.api.bases.sentryapps import (
    SentryAppInstallationExternalIssueBaseEndpoint as ExternalIssueBaseEndpoint,
)
from sentry.sentry_apps.api.parsers.sentry_app import URLField
from sentry.sentry_apps.api.serializers.platform_external_issue import (
    PlatformExternalIssueSerializer as ResponsePlatformExternalIssueSerializer,
)
from sentry.sentry_apps.api.serializers.platform_external_issue import (
    PlatformExternalIssueSerializerResponse,
)
from sentry.sentry_apps.services.cell import sentry_app_cell_service
from sentry.sentry_apps.utils.errors import SentryAppPublicErrorBody
from sentry.users.services.user.serial import serialize_generic_user


class PlatformExternalIssueSerializer(serializers.Serializer):
    webUrl = URLField(help_text="The URL of the external resource the issue is linked to.")
    project = serializers.CharField(
        help_text="The display name of the project the external issue belongs to."
    )
    identifier = serializers.CharField(
        help_text="The identifier of the external issue, displayed in the Sentry UI."
    )


@extend_schema(tags=["Integration"])
@control_silo_endpoint
class SentryAppInstallationExternalIssuesEndpoint(ExternalIssueBaseEndpoint):
    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="Create an External Issue",
        parameters=[SentryAppParams.INSTALLATION_UUID],
        request=PlatformExternalIssueSerializer,
        responses={
            200: inline_sentry_response_serializer(
                "PlatformExternalIssueResponse", PlatformExternalIssueSerializerResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(
        self, request: Request, installation
    ) -> (
        Response[PlatformExternalIssueSerializerResponse]
        | Response[DetailResponse]
        | Response[ValidationErrorResponse]
        | Response[SentryAppPublicErrorBody]
    ):
        """
        Link a Sentry issue to a resource in an external service through a custom
        integration (Sentry App) installation.
        """
        data = request.data

        serializer = PlatformExternalIssueSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(as_validation_errors(serializer), status=400)

        try:
            group_id = int(data.pop("issueId"))
        except Exception:
            return Response({"detail": "issueId is required, and must be an integer"}, status=400)

        rpc_user = serialize_generic_user(request.user)
        if rpc_user is None:
            return Response({"detail": "Authentication credentials were not provided."}, status=401)

        # Do not pass `user` until cells accept the new RPC arg everywhere (deploy phase 2).
        result = sentry_app_cell_service.create_external_issue(
            organization_id=installation.organization_id,
            installation=installation,
            group_id=group_id,
            web_url=data["webUrl"],
            project=data["project"],
            identifier=data["identifier"],
            user=rpc_user,
        )

        if result.error:
            return self.respond_rpc_sentry_app_error(result.error)

        if not result.external_issue:
            return Response({"detail": "Failed to create external issue"}, status=500)

        body: PlatformExternalIssueSerializerResponse = serialize(
            objects=result.external_issue, serializer=ResponsePlatformExternalIssueSerializer()
        )
        return Response(body)
