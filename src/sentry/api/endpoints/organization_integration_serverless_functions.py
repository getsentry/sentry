from __future__ import absolute_import

import six

from sentry.api.bases.organization import OrganizationIntegrationsPermission
from sentry.api.bases.organization_integrations import OrganizationIntegrationBaseEndpoint
from sentry.integrations.serverless import ServerlessMixin
from sentry.shared_integrations.exceptions import IntegrationError


class OrganizationIntegrationServerlessFunctionsEndpoint(OrganizationIntegrationBaseEndpoint):
    permission_classes = (OrganizationIntegrationsPermission,)

    def get(self, request, organization, integration_id):
        """
        Get the list of repository project path configs in an integration
        """
        integration = self.get_integration(organization, integration_id)
        install = integration.get_installation(organization.id)

        if isinstance(install, ServerlessMixin):
            try:
                serverless_functions = install.get_serverless_functions()
            except IntegrationError as e:
                return self.respond({"detail": six.text_type(e)}, status=400)

            return self.respond(serverless_functions)

        return self.respond({"detail": "Serverless not supported"}, status=400)
