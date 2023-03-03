from typing import Dict, List

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
    CodeMapping,
    CodeMappingTreesHelper,
    FrameFilename,
    Repo,
    create_code_mapping,
)
from sentry.models import Project
from sentry.models.organization import Organization
from sentry.tasks.derive_code_mappings import get_installation


@region_silo_endpoint
class OrganizationDeriveCodeMappingsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationIntegrationsLoosePermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Get all matches for a stacktrace filename.
        ``````````````````

        :param organization:
        :param string stacktraceFilename:
        :auth: required
        """
        if not features.has("organizations:derive-code-mappings", organization):
            return Response(status=status.HTTP_403_FORBIDDEN)

        stacktrace_filename = request.GET.get("stacktraceFilename")
        installation, _ = get_installation(organization)
        if not installation:
            return self.respond(
                "Could not find this integration installed on your organization",
                status=status.HTTP_404_NOT_FOUND,
            )

        trees = installation.get_trees_for_org()
        trees_helper = CodeMappingTreesHelper(trees)
        frame_filename = FrameFilename(stacktrace_filename)
        possible_code_mappings: List[Dict[str, str]] = trees_helper.list_file_matches(
            frame_filename
        )
        resp_status = status.HTTP_200_OK if possible_code_mappings else status.HTTP_204_NO_CONTENT
        return Response(serialize(possible_code_mappings), status=resp_status)

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Create a new repository project path config
        ``````````````````

        :param organization:
        :param int projectId:
        :param string repoName:
        :param string defaultBranch:
        :param string stackRoot:
        :param string sourceRoot:
        :auth: required
        """
        if not features.has("organizations:derive-code-mappings", organization):
            return Response(status=status.HTTP_403_FORBIDDEN)

        installation, organization_integration = get_installation(organization)
        if not installation:
            return self.respond(
                "Could not find this integration installed on your organization",
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            project = Project.objects.get(id=request.data.get("projectId"))
        except Project.DoesNotExist:
            return self.respond("Could not find project", status=status.HTTP_404_NOT_FOUND)

        repo_name = request.data.get("repoName")
        stack_root = request.data.get("stackRoot")
        source_root = request.data.get("sourceRoot")
        branch = request.data.get("defaultBranch")
        if not repo_name or not stack_root or not source_root or not branch:
            return self.respond("Missing required parameters", status=status.HTTP_400_BAD_REQUEST)

        code_mapping = CodeMapping(
            stacktrace_root=stack_root,
            source_path=source_root,
            repo=Repo(name=repo_name, branch=branch),
        )
        new_code_mapping = create_code_mapping(organization_integration, project, code_mapping)
        return self.respond(
            serialize(new_code_mapping, request.user), status=status.HTTP_201_CREATED
        )
