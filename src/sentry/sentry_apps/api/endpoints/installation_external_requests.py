import logging
from typing import NotRequired, TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.sentry_app_examples import SentryAppExamples
from sentry.apidocs.parameters import SentryAppParams
from sentry.apidocs.response_types import (
    DetailResponse,
    ValidationErrorResponse,
    as_validation_errors,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.sentry_apps.api.bases.sentryapps import SentryAppInstallationBaseEndpoint
from sentry.sentry_apps.external_requests.utils import validate_sentry_app_uri
from sentry.sentry_apps.services.app.model import RpcSentryAppInstallation
from sentry.sentry_apps.services.cell import sentry_app_cell_service
from sentry.sentry_apps.utils.errors import SentryAppPublicErrorBody
from sentry.users.services.user.serial import serialize_generic_user

logger = logging.getLogger("sentry.sentry-apps")


class SentryAppInstallationExternalRequestsSerializer(serializers.Serializer):
    uri = serializers.CharField(
        required=True,
        validators=[validate_sentry_app_uri],
        help_text="The relative URI of the select field's options callback.",
    )
    projectId = serializers.IntegerField(
        required=False, help_text="The Sentry project ID to include in the options request."
    )
    query = serializers.CharField(required=False, help_text="The search text for select options.")
    dependentData = serializers.CharField(
        required=False,
        help_text="A JSON-encoded object containing the values of fields this select depends on.",
    )


class SentryAppExternalRequestOptionsResponse(TypedDict):
    choices: list[list[str]]
    defaultValue: NotRequired[str]


@extend_schema(tags=["Integration"])
@control_silo_endpoint
class SentryAppInstallationExternalRequestsEndpoint(SentryAppInstallationBaseEndpoint):
    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="getSentryAppInstallationExternalRequestOptions",
        summary="Retrieve a Sentry App's Select Field Options",
        parameters=[
            SentryAppParams.INSTALLATION_UUID,
            SentryAppInstallationExternalRequestsSerializer,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "SentryAppExternalRequestOptionsResponse", SentryAppExternalRequestOptionsResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=SentryAppExamples.GET_EXTERNAL_REQUEST_OPTIONS,
    )
    def get(
        self, request: Request, installation: RpcSentryAppInstallation
    ) -> (
        Response[SentryAppExternalRequestOptionsResponse]
        | Response[DetailResponse]
        | Response[ValidationErrorResponse]
        | Response[SentryAppPublicErrorBody]
    ):
        """Request select options from the installed app. Each choice contains its value followed by its label."""
        serializer = SentryAppInstallationExternalRequestsSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(as_validation_errors(serializer), status=400)

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

        response_data: SentryAppExternalRequestOptionsResponse = {"choices": result.choices}
        if result.default_value is not None:
            response_data["defaultValue"] = result.default_value
        return Response(response_data)
