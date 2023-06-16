from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization_integrations import RegionOrganizationIntegrationBaseEndpoint
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.integrations.mixins import ServerlessMixin
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.shared_integrations.exceptions import IntegrationError

ACTIONS = ["enable", "disable", "updateVersion"]


class ServerlessActionSerializer(CamelSnakeSerializer):
    action = serializers.ChoiceField(ACTIONS)
    target = serializers.CharField()


@region_silo_endpoint
class OrganizationIntegrationServerlessFunctionsEndpoint(RegionOrganizationIntegrationBaseEndpoint):
    def get(self, request: Request, organization, integration_id) -> Response:
        """
        Get the list of repository project path configs in an integration
        """
        integration = self.get_integration(organization.id, integration_id)

        install = integration_service.get_installation(
            integration=integration, organization_id=organization.id
        )

        if not isinstance(install, ServerlessMixin):
            return self.respond({"detail": "Serverless not supported"}, status=400)

        try:
            serverless_functions = install.get_serverless_functions()
        except IntegrationError as e:
            return self.respond({"detail": str(e)}, status=400)

        return self.respond(serverless_functions)

    def post(self, request: Request, organization, integration_id) -> Response:
        integration = self.get_integration(organization.id, integration_id)
        install = integration_service.get_installation(
            integration=integration, organization_id=organization.id
        )

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
