from typing import Literal

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import (
    OrganizationEndpoint,
    OrganizationIntegrationsLoosePermission,
)
from sentry.api.serializers import serialize
from sentry.issues.auto_source_code_config.code_mapping import (
    create_code_mapping,
    derive_code_mappings,
)
from sentry.issues.auto_source_code_config.integration_utils import (
    InstallationCannotGetTreesError,
    InstallationNotFoundError,
)
from sentry.models.organization import Organization
from sentry.models.project import Project


@region_silo_endpoint
class OrganizationDeriveCodeMappingsEndpoint(OrganizationEndpoint):
    """
    In the UI, we have a prompt to derive code mappings from the stacktrace filename.
    This endpoint is used to get the possible code mappings for it.
    """

    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
        "POST": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (OrganizationIntegrationsLoosePermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Get all matches for a stacktrace filename.
        ``````````````````

        :param organization:
        :param string stacktraceFilename:
        :param string platform:
        :auth: required
        """
        stacktrace_filename = request.GET.get("stacktraceFilename")
        # XXX: The UI will need to pass the platform
        platform = request.GET.get("platform")

        try:
            possible_code_mappings = []
            resp_status: Literal[200, 204, 400] = status.HTTP_400_BAD_REQUEST

            if stacktrace_filename:
                possible_code_mappings = derive_code_mappings(
                    organization, {"filename": stacktrace_filename}, platform
                )
                if possible_code_mappings:
                    resp_status = status.HTTP_200_OK
                else:
                    resp_status = status.HTTP_204_NO_CONTENT

            return Response(serialize(possible_code_mappings), status=resp_status)
        except InstallationCannotGetTreesError:
            return self.respond(
                {"text": "The integration does not support getting trees"},
                status=status.HTTP_404_NOT_FOUND,
            )
        except InstallationNotFoundError:
            return self.respond(
                {"text": "Could not find this integration installed on your organization"},
                status=status.HTTP_404_NOT_FOUND,
            )

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
        try:
            project = Project.objects.get(id=request.data.get("projectId"))
        except Project.DoesNotExist:
            return self.respond(
                {"text": "Could not find project"}, status=status.HTTP_404_NOT_FOUND
            )

        if not request.access.has_project_access(project):
            return self.respond(status=status.HTTP_403_FORBIDDEN)

        repo_name = request.data.get("repoName")
        stack_root = request.data.get("stackRoot")
        source_root = request.data.get("sourceRoot")
        branch = request.data.get("defaultBranch")
        if not repo_name or not stack_root or not source_root or not branch:
            return self.respond(
                {"text": "Missing required parameters"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            new_code_mapping = create_code_mapping(
                organization, project, stack_root, source_root, repo_name, branch
            )
        except InstallationNotFoundError:
            return self.respond(
                {"text": "Could not find this integration installed on your organization"},
                status=status.HTTP_404_NOT_FOUND,
            )
        except InstallationCannotGetTreesError:
            return self.respond(
                {"text": "The integration does not support getting trees"},
                status=status.HTTP_404_NOT_FOUND,
            )

        return self.respond(
            serialize(new_code_mapping, request.user), status=status.HTTP_201_CREATED
        )
