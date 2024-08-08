from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationIntegrationsPermission
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.integrations.services.integration import integration_service
from sentry.integrations.source_code_management.repository import RepositoryIntegration
from sentry.shared_integrations.exceptions import ApiError


def get_codeowner_contents(config):
    if not config.organization_integration_id:
        raise NotFound(detail="No associated integration")

    integration = integration_service.get_integration(integration_id=config.integration_id)
    if not integration:
        return None
    install = integration.get_installation(organization_id=config.project.organization_id)
    if isinstance(install, RepositoryIntegration):
        return install.get_codeowner_file(config.repository, ref=config.default_branch)


@region_silo_endpoint
class OrganizationCodeMappingCodeOwnersEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (OrganizationIntegrationsPermission,)

    def convert_args(self, request: Request, organization_id_or_slug, config_id, *args, **kwargs):
        args, kwargs = super().convert_args(
            request, organization_id_or_slug, config_id, *args, **kwargs
        )
        organization = kwargs["organization"]

        try:
            kwargs["config"] = RepositoryProjectPathConfig.objects.get(
                id=config_id,
                organization_id=organization.id,
            )
        except RepositoryProjectPathConfig.DoesNotExist:
            raise Http404

        return (args, kwargs)

    def get(self, request: Request, config_id, organization, config) -> Response:
        try:
            codeowner_contents = get_codeowner_contents(config)
        except ApiError as e:
            return self.respond({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        if not codeowner_contents:
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        return self.respond(
            codeowner_contents,
            status=status.HTTP_200_OK,
        )
