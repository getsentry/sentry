from typing import Any

from django.db.models.deletion import ProtectedError
from django.http import Http404
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import (
    OrganizationEndpoint,
    OrganizationIntegrationsLoosePermission,
)
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.base import camel_to_snake_case, convert_dict_key_case
from sentry.api.utils import to_valid_int_id
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_CONFLICT,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.integrations.api.serializers.models.repository_project_path_config import (
    RepositoryProjectPathConfigSerializerResponse,
)
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.integrations.services.integration import integration_service
from sentry.models.organization import Organization
from sentry.models.project import Project

from .organization_code_mappings import (
    OrganizationIntegrationMixin,
    RepositoryProjectPathConfigSerializer,
)


@extend_schema(tags=["Integrations"])
@cell_silo_endpoint
class OrganizationCodeMappingDetailsEndpoint(OrganizationEndpoint, OrganizationIntegrationMixin):
    owner = ApiOwner.CODING_WORKFLOWS
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (OrganizationIntegrationsLoosePermission,)

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: int | str,
        config_id: int,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        validated_config_id = to_valid_int_id("config_id", config_id, raise_404=True)
        args, kwargs = super().convert_args(
            request, organization_id_or_slug, validated_config_id, *args, **kwargs
        )
        ois = integration_service.get_organization_integrations(
            organization_id=kwargs["organization"].id
        )
        try:
            kwargs["config"] = RepositoryProjectPathConfig.objects.select_related(
                "project_repository__project"
            ).get(
                id=validated_config_id,
                organization_integration_id__in=[oi.id for oi in ois],
            )
            # Only set when the request wants to move the mapping to another project.
            # Normalize keys the way the serializer does first, otherwise a snake_case
            # `project_id` skips the access check below but still moves the mapping.
            data = convert_dict_key_case(request.data, camel_to_snake_case)
            if data.get("project_id"):
                kwargs["new_project"] = self.get_project(kwargs["organization"], data["project_id"])
        except (RepositoryProjectPathConfig.DoesNotExist, ValueError):
            raise Http404

        return args, kwargs

    @extend_schema(
        operation_id="updateOrganizationCodeMapping",
        summary="Update an Organization Code Mapping",
        description="Update the repository, project, or path settings for a code mapping.",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(
                "config_id",
                type=int,
                location=OpenApiParameter.PATH,
                description="The ID of the code mapping to update.",
            ),
        ],
        request=inline_serializer(
            name="UpdateOrganizationCodeMappingRequest",
            fields={
                "repositoryId": serializers.IntegerField(
                    help_text="The ID of the repository to map."
                ),
                "projectId": serializers.IntegerField(
                    help_text="The ID of the project to map to the repository."
                ),
                "stackRoot": serializers.CharField(
                    allow_blank=True,
                    help_text="The path prefix to strip from matching stack frame filenames before adding sourceRoot.",
                ),
                "sourceRoot": serializers.CharField(
                    allow_blank=True,
                    help_text=(
                        "The repository path prefix that replaces stackRoot. For example, "
                        "/app/pkg/file.py with stackRoot=/app/ and sourceRoot=src/ resolves to src/pkg/file.py."
                    ),
                ),
                "defaultBranch": serializers.CharField(
                    allow_blank=True,
                    required=False,
                    help_text="The repository branch used when a release has no branch specified.",
                ),
            },
        ),
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationCodeMappingResponse", RepositoryProjectPathConfigSerializerResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(
        self,
        request: Request,
        config_id: int,
        organization: Organization,
        config: RepositoryProjectPathConfig,
        new_project: Project | None = None,
    ) -> Response[RepositoryProjectPathConfigSerializerResponse]:
        """
        Update a repository project path config
        ``````````````````

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          team should be created for.
        :param int repository_id:
        :param int project_id:
        :param string stack_root:
        :param string source_root:
        :param string default_branch:
        :auth: required
        """
        projects = [config.project_repository.project]
        if new_project is not None:
            projects.append(new_project)
        if not request.access.has_projects_access(projects):
            return self.respond(status=status.HTTP_403_FORBIDDEN)

        try:
            # We expect there to exist an org_integration
            org_integration = self.get_organization_integration(organization, config.integration_id)
        except Http404:
            # Human friendly error response.
            return self.respond(
                "Could not find this integration installed on your organization",
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = RepositoryProjectPathConfigSerializer(
            context={
                "organization": organization,
                "organization_integration": org_integration,
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

    @extend_schema(
        operation_id="deleteOrganizationCodeMapping",
        summary="Delete an Organization Code Mapping",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(
                "config_id",
                type=int,
                location=OpenApiParameter.PATH,
                description="The ID of the code mapping to delete.",
            ),
        ],
        responses={
            204: RESPONSE_NO_CONTENT,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
            409: RESPONSE_CONFLICT,
        },
    )
    def delete(
        self,
        request: Request,
        config_id: int,
        organization: Organization,
        config: RepositoryProjectPathConfig,
    ) -> Response[None]:
        """
        Delete a repository project path config

        :auth: required
        """

        project = config.project_repository.project
        if not request.access.has_project_access(project):
            return self.respond(status=status.HTTP_403_FORBIDDEN)

        try:
            config.delete()
            return self.respond(status=status.HTTP_204_NO_CONTENT)
        except ProtectedError:
            return self.respond(
                "Cannot delete Code Mapping. Must delete Code Owner that uses this mapping first.",
                status=status.HTTP_409_CONFLICT,
            )
