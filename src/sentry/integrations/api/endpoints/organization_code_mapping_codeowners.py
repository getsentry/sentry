import json

from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationIntegrationsPermission
from sentry.constants import ObjectStatus
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.integrations.services.integration import integration_service
from sentry.integrations.source_code_management.repository import RepositoryIntegration
from sentry.shared_integrations.exceptions import ApiError


def get_codeowner_contents(config):
    if not config.organization_integration_id:
        raise NotFound(detail="No associated integration")

    integration = integration_service.get_integration(
        integration_id=config.integration_id, status=ObjectStatus.ACTIVE
    )
    if not integration:
        return None
    org_id = config.project_repository.project.organization_id
    repository = config.project_repository.repository
    install = integration.get_installation(organization_id=org_id)
    if isinstance(install, RepositoryIntegration):
        return install.get_codeowner_file(repository, ref=config.default_branch)


@cell_silo_endpoint
class OrganizationCodeMappingCodeOwnersEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationIntegrationsPermission,)

    def convert_args(self, request: Request, organization_id_or_slug, config_id, *args, **kwargs):
        args, kwargs = super().convert_args(
            request, organization_id_or_slug, config_id, *args, **kwargs
        )
        organization = kwargs["organization"]

        try:
            kwargs["config"] = RepositoryProjectPathConfig.objects.select_related(
                "project_repository__project",
                "project_repository__repository",
            ).get(
                id=config_id,
                organization_id=organization.id,
            )
        except RepositoryProjectPathConfig.DoesNotExist:
            raise Http404

        return (args, kwargs)

    def get(self, request: Request, config_id, organization, config) -> Response:
        project = config.project_repository.project
        if not request.access.has_project_access(project):
            return self.respond(status=status.HTTP_403_FORBIDDEN)

        try:
            codeowner_contents = get_codeowner_contents(config)
        except ApiError as e:
            return self.respond({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        if not codeowner_contents:
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        if isinstance(codeowner_contents, dict):
            if "raw" not in codeowner_contents and (
                "message" in codeowner_contents or "error" in codeowner_contents
            ):
                error_msg = codeowner_contents.get("message") or codeowner_contents.get("error")
                return self.respond(
                    {"detail": error_msg},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            raw_content = codeowner_contents.get("raw")
            if isinstance(raw_content, str):
                try:
                    parsed_raw = json.loads(raw_content)
                    if isinstance(parsed_raw, dict) and (
                        "message" in parsed_raw or "error" in parsed_raw or "errors" in parsed_raw
                    ):
                        error_msg = (
                            parsed_raw.get("message")
                            or parsed_raw.get("error")
                            or "Invalid CODEOWNERS file content"
                        )
                        return self.respond(
                            {"detail": error_msg},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                except (ValueError, TypeError):
                    pass

        return self.respond(
            codeowner_contents,
            status=status.HTTP_200_OK,
        )