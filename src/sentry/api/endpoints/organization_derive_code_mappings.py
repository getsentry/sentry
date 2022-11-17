from typing import List

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import (
    OrganizationEndpoint,
    OrganizationIntegrationsLoosePermission,
)
from sentry.api.serializers import serialize
from sentry.integrations.utils.code_mapping import (
    CodeMappingMatch,
    CodeMappingTreesHelper,
    FrameFilename,
)
from sentry.models import Project, Repository, RepositoryProjectPathConfig
from sentry.models.organization import Organization
from sentry.tasks.derive_code_mappings import get_installation


@region_silo_endpoint
class OrganizationDeriveCodeMappingsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationIntegrationsLoosePermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Get all matches for a filename.
        ``````````````````

        :pparam string organization_slug: the slug of the organization the
                                          team should be created for.
        :param string filename:
        :auth: required
        """
        if not features.has("organizations:derive-code-mappings", organization):
            return Response(status=status.HTTP_400_BAD_REQUEST)

        filename = request.GET.get("filename")
        installation, _ = get_installation(organization)
        if not installation:
            return self.respond(
                "Could not find this integration installed on your organization",
                status=status.HTTP_404_NOT_FOUND,
            )

        trees = installation.get_trees_for_org()
        trees_helper = CodeMappingTreesHelper(trees)
        frame_filename = FrameFilename(filename)
        possible_code_mappings: List[CodeMappingMatch] = trees_helper.list_file_matches(
            frame_filename
        )
        return Response(serialize(possible_code_mappings), status=status.HTTP_200_OK)

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Create a new repository project path config from a filename
        ``````````````````

        :pparam string organization_slug: the slug of the organization the
                                          team should be created for.
        :param int projectId:
        :param string repoName:
        :param string defaultBranch:
        :param string stackRoot:
        :param string sourceRoot:
        :auth: required
        """
        if not features.has("organizations:derive-code-mappings", organization):
            return Response(status=status.HTTP_400_BAD_REQUEST)

        installation, organization_integration = get_installation(organization)
        if not installation:
            return self.respond(
                "Could not find this integration installed on your organization",
                status=status.HTTP_404_NOT_FOUND,
            )

        project = Project.objects.get(id=request.data.get("projectId"))
        repo_name = request.data.get("repoName")
        repository, _ = Repository.objects.get_or_create(
            name=repo_name,
            organization_id=organization.id,
            defaults={
                "integration_id": organization_integration.integration_id,
            },
        )

        stack_root = request.data.get("stackRoot")
        exists = RepositoryProjectPathConfig.objects.filter(
            project=project,
            stack_root=stack_root,
        )
        if exists.exists():
            return self.respond(
                "Code mapping already exists for this project", status=status.HTTP_400_BAD_REQUEST
            )

        source_root = request.data.get("sourceRoot")
        branch = request.data.get("defaultBranch")
        new_code_mapping = RepositoryProjectPathConfig.objects.create(
            project=project,
            stack_root=stack_root,
            repository=repository,
            organization_integration=organization_integration,
            source_root=source_root,
            default_branch=branch,
            automatically_generated=True,
        )

        return self.respond(
            serialize(new_code_mapping, request.user),
            status=status.HTTP_201_CREATED,
        )
