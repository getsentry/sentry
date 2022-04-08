from django.db.models.deletion import ProtectedError
from django.http import Http404
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationIntegrationsPermission
from sentry.api.serializers import serialize
from sentry.models import OrganizationIntegration, RepositoryProjectPathConfig

from .organization_code_mappings import (
    OrganizationIntegrationMixin,
    RepositoryProjectPathConfigSerializer,
)


class OrganizationCodeMappingDetailsEndpoint(OrganizationEndpoint, OrganizationIntegrationMixin):
    permission_classes = (OrganizationIntegrationsPermission,)

    def convert_args(self, request: Request, organization_slug, config_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, organization_slug, config_id, *args, **kwargs)

        try:
            kwargs["config"] = RepositoryProjectPathConfig.objects.get(
                id=config_id,
                organization_integration__in=OrganizationIntegration.objects.filter(
                    organization=kwargs["organization"]
                ).values_list("id", flat=True),
            )
        except RepositoryProjectPathConfig.DoesNotExist:
            raise Http404

        return (args, kwargs)

    def put(self, request: Request, config_id, organization, config) -> Response:
        """
        Update a repository project path config
        ``````````````````

        :pparam string organization_slug: the slug of the organization the
                                          team should be created for.
        :param int repository_id:
        :param int project_id:
        :param string stack_root:
        :param string source_root:
        :param string default_branch:
        :auth: required
        """
        serializer = RepositoryProjectPathConfigSerializer(
            context={
                "organization": organization,
                "organization_integration": config.organization_integration,
            },
            instance=config,
            data=request.data,
        )
        if serializer.is_valid():
            repository_project_path_config = serializer.save()
            return self.respond(
                serialize(repository_project_path_config, request.user),
                status=status.HTTP_200_OK,
            )
        return self.respond(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request: Request, config_id, organization, config) -> Response:
        """
        Delete a repository project path config

        :auth: required
        """
        try:
            config.delete()
            return self.respond(status=status.HTTP_204_NO_CONTENT)
        except ProtectedError:
            return self.respond(
                "Cannot delete Code Mapping. Must delete Code Owner that uses this mapping first.",
                status=status.HTTP_409_CONFLICT,
            )
