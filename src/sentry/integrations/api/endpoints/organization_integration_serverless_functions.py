from typing import Any, TypedDict

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.integrations.api.bases.organization_integrations import (
    CellOrganizationIntegrationBaseEndpoint,
)
from sentry.integrations.mixins import ServerlessMixin
from sentry.models.organization import Organization
from sentry.shared_integrations.exceptions import IntegrationError

ACTIONS = ["enable", "disable", "updateVersion"]

_INTEGRATION_ID_PARAM = OpenApiParameter(
    name="integration_id",
    location="path",
    required=True,
    type=int,
    description="The ID of the organization's integration.",
)


class ServerlessFunctionResponse(TypedDict):
    name: str
    runtime: str
    # The installed Sentry layer version, or -1 when the function is not instrumented.
    version: int
    outOfDate: bool
    enabled: bool


class ServerlessActionSerializer(CamelSnakeSerializer):
    action = serializers.ChoiceField(
        ACTIONS, help_text="The action to perform on the serverless function."
    )
    target = serializers.CharField(help_text="The identifier of the serverless function to act on.")


@extend_schema(tags=["Integrations"])
@cell_silo_endpoint
class OrganizationIntegrationServerlessFunctionsEndpoint(CellOrganizationIntegrationBaseEndpoint):
    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="List an Integration's Serverless Functions",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, _INTEGRATION_ID_PARAM],
        responses={
            200: inline_sentry_response_serializer(
                "ListServerlessFunctions", list[ServerlessFunctionResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self,
        request: Request,
        organization: Organization,
        integration_id: int,
        **kwds: Any,
    ) -> Response[list[ServerlessFunctionResponse]]:
        """
        Return the serverless functions discovered for an organization's integration.
        """
        integration = self.get_integration(organization.id, integration_id)

        install = integration.get_installation(organization_id=organization.id)

        if not isinstance(install, ServerlessMixin):
            return self.respond({"detail": "Serverless not supported"}, status=400)

        try:
            serverless_functions = install.get_serverless_functions()
        except IntegrationError as e:
            return self.respond({"detail": str(e)}, status=400)

        return self.respond(serverless_functions)

    @extend_schema(
        operation_id="Update an Integration's Serverless Function",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, _INTEGRATION_ID_PARAM],
        request=ServerlessActionSerializer,
        responses={
            200: inline_sentry_response_serializer(
                "ServerlessFunction", ServerlessFunctionResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(
        self,
        request: Request,
        organization: Organization,
        integration_id: int,
        **kwds: Any,
    ) -> Response[ServerlessFunctionResponse]:
        """
        Enable, disable, or update the Sentry layer version of a serverless function in
        an organization's integration.
        """
        integration = self.get_integration(organization.id, integration_id)
        install = integration.get_installation(organization_id=organization.id)

        if not isinstance(install, ServerlessMixin):
            return self.respond({"detail": "Serverless not supported"}, status=400)

        serializer = ServerlessActionSerializer(data=request.data, context={"install": install})

        if not serializer.is_valid():
            return self.respond(serializer.errors, status=400)

        data = serializer.validated_data
        action = data["action"]
        target = data["target"]

        try:
            resp = None
            if action == "enable":
                resp = install.enable_function(target)
            elif action == "disable":
                resp = install.disable_function(target)
            elif action == "updateVersion":
                resp = install.update_function_to_latest_version(target)
            return self.respond(resp)
        except IntegrationError as e:
            return self.respond({"detail": str(e)}, status=400)
