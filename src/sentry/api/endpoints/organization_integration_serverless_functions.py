from rest_framework import serializers

from sentry.api.bases.organization_integrations import OrganizationIntegrationBaseEndpoint
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.integrations.serverless import ServerlessMixin
from sentry.shared_integrations.exceptions import IntegrationError

ACTIONS = ["enable", "disable", "updateVersion"]


class ServerlessActionSerializer(CamelSnakeSerializer):
    action = serializers.ChoiceField(ACTIONS)
    target = serializers.CharField()


class OrganizationIntegrationServerlessFunctionsEndpoint(OrganizationIntegrationBaseEndpoint):
    def get(self, request, organization, integration_id):
        """
        Get the list of repository project path configs in an integration
        """
        integration = self.get_integration(organization, integration_id)
        install = integration.get_installation(organization.id)

        if not isinstance(install, ServerlessMixin):
            return self.respond({"detail": "Serverless not supported"}, status=400)

        try:
            serverless_functions = install.get_serverless_functions()
        except IntegrationError as e:
            return self.respond({"detail": str(e)}, status=400)

        return self.respond(serverless_functions)

    def post(self, request, organization, integration_id):
        integration = self.get_integration(organization, integration_id)
        install = integration.get_installation(organization.id)

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
