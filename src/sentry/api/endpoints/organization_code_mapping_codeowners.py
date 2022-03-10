from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationIntegrationsPermission
from sentry.models import OrganizationIntegration, RepositoryProjectPathConfig
from sentry.shared_integrations.exceptions import ApiError


def get_codeowner_contents(config):
    if not config.organization_integration:
        raise NotFound(detail="No associated integration")

    integration = config.organization_integration.integration
    install = integration.get_installation(config.organization_integration.organization_id)
    return install.get_codeowner_file(config.repository, ref=config.default_branch)


class OrganizationCodeMappingCodeOwnersEndpoint(OrganizationEndpoint):
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
