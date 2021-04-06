from django.http import Http404
from rest_framework import status

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationIntegrationsPermission
from sentry.api.serializers import serialize
from sentry.models import RepositoryProjectPathConfig

from .organization_code_mappings import (
    NullableOrganizationIntegrationMixin,
    RepositoryProjectPathConfigSerializer,
)


class OrganizationCodeMappingDetailsEndpoint(
    OrganizationEndpoint, NullableOrganizationIntegrationMixin
):
    permission_classes = (OrganizationIntegrationsPermission,)

    def convert_args(self, request, organization_slug, config_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, organization_slug, config_id, *args, **kwargs)

        try:
            kwargs["config"] = RepositoryProjectPathConfig.objects.get(
                id=config_id,
            )
        except RepositoryProjectPathConfig.DoesNotExist:
            raise Http404

        return (args, kwargs)

    def _get_codeowner_contents(self, config):
        integration = config.organization_integration.integration
        install = integration.get_installation(config.organization_integration.organization_id)
        return install.get_codeowner_file(config.repository, ref=config.default_branch)

    def get(self, request, config_id, organization, config):
        serialized_config = serialize(config, request.user)

        if request.GET.get("codeowner_contents"):
            codeowner_contents = self._get_codeowner_contents(config)
            serialized_config["codeowner_contents"] = codeowner_contents

        return self.respond(
            serialized_config,
            status=status.HTTP_200_OK,
        )

    def put(self, request, config_id, organization, config):
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

    def delete(self, request, config_id, organization, config):
        """
        Delete a repository project path config

        :auth: required
        """
        config.delete()
        return self.respond(status=status.HTTP_204_NO_CONTENT)
