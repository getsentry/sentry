from __future__ import absolute_import

from django.http import Http404

from rest_framework import status

from sentry.api.bases.organization import OrganizationIntegrationsPermission
from sentry.api.bases.organization_integrations import OrganizationIntegrationBaseEndpoint
from sentry.api.serializers import serialize
from sentry.models import RepositoryProjectPathConfig

from .organization_integration_repository_project_path_configs import (
    RepositoryProjectPathConfigSerializer,
)


class OrganizationIntegrationRepositoryProjectPathConfigDetailsEndpoint(
    OrganizationIntegrationBaseEndpoint
):
    permission_classes = (OrganizationIntegrationsPermission,)

    def convert_args(self, request, organization_slug, integration_id, config_id, *args, **kwargs):
        args, kwargs = super(
            OrganizationIntegrationRepositoryProjectPathConfigDetailsEndpoint, self
        ).convert_args(request, organization_slug, integration_id, config_id, *args, **kwargs)

        org_integration = self.get_organization_integration(kwargs["organization"], integration_id)
        kwargs["org_integration"] = org_integration

        try:
            kwargs["config"] = RepositoryProjectPathConfig.objects.get(
                id=config_id, organization_integration_id=org_integration.id,
            )
        except RepositoryProjectPathConfig.DoesNotExist:
            raise Http404
        return (args, kwargs)

    def put(
        self, request, organization_slug, integration_id, organization, org_integration, config
    ):
        serializer = RepositoryProjectPathConfigSerializer(
            context={"organization_integration": org_integration},
            instance=config,
            data=request.data,
        )
        if serializer.is_valid():
            repository_project_path_config = serializer.save()
            return self.respond(
                serialize(repository_project_path_config, request.user), status=status.HTTP_200_OK,
            )

        return self.respond(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(
        self, request, organization_slug, integration_id, organization, org_integration, config
    ):
        config.delete()
        return self.respond(status=status.HTTP_204_NO_CONTENT)
