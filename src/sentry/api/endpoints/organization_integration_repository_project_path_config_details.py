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

    @staticmethod
    def convert_args(self, request, organization_slug, integration_id, config_id, *args, **kwargs):
        args, kwargs = super(
            OrganizationIntegrationRepositoryProjectPathConfigDetailsEndpoint, self
        ).convert_args(request, organization_slug, integration_id, config_id, *args, **kwargs)
        try:
            kwargs["config"] = RepositoryProjectPathConfig.objects.get(
                id=config_id, organization=kwargs["organization"], integration_id=integration_id,
            )
        except RepositoryProjectPathConfig.DoesNotExist:
            raise Http404

    def put(self, request, organization, integration_id, config):
        org_integration = self.get_organization_integration(organization, integration_id)

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
