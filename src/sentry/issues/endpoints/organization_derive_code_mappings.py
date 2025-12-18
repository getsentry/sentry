import logging
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
from sentry.issues.auto_source_code_config.code_mapping import create_code_mapping
from sentry.issues.auto_source_code_config.derived_code_mappings_endpoint import (
    get_code_mapping_from_request,
    get_file_and_repo_matches,
)
from sentry.issues.auto_source_code_config.errors import NeedsExtension, UnsupportedFrameInfo
from sentry.issues.auto_source_code_config.integration_utils import (
    InstallationCannotGetTreesError,
    InstallationNotFoundError,
    get_installation,
)
from sentry.models.organization import Organization
from sentry.models.project import Project

logger = logging.getLogger(__name__)


@region_silo_endpoint
class OrganizationDeriveCodeMappingsEndpoint(OrganizationEndpoint):
    """
    In the UI, we have a prompt to derive code mappings from the stacktrace filename.
    This endpoint is used to get the possible code mappings for it.
    """

    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (OrganizationIntegrationsLoosePermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Get all files from the customer repositories that match a stack trace frame.
        ``````````````````

        :param organization:
        :param string absPath:
        :param string module:
        :param string stacktraceFilename:
        :param string platform:
        :auth: required
        """
        try:
            file_repo_matches = []
            resp_status: Literal[200, 204, 400] = status.HTTP_400_BAD_REQUEST

            file_repo_matches = get_file_and_repo_matches(request, organization)
            if file_repo_matches:
                resp_status = status.HTTP_200_OK
            else:
                resp_status = status.HTTP_204_NO_CONTENT

            return self.respond(serialize(file_repo_matches), status=resp_status)
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
        except NeedsExtension:
            return self.respond({"text": "Needs extension"}, status=status.HTTP_400_BAD_REQUEST)
        except KeyError:
            return self.respond(
                {"text": "Missing required parameters"}, status=status.HTTP_400_BAD_REQUEST
            )
        except UnsupportedFrameInfo:
            return self.respond(
                {"text": "Unsupported frame info"}, status=status.HTTP_400_BAD_REQUEST
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
            project = Project.objects.get(
                id=request.data["projectId"], organization_id=organization.id
            )
        except (Project.DoesNotExist, KeyError):
            return self.respond(
                {"text": "Could not find project"}, status=status.HTTP_404_NOT_FOUND
            )

        if not request.access.has_project_access(project):
            return self.respond(status=status.HTTP_403_FORBIDDEN)

        try:
            installation = get_installation(organization)
            # It helps with typing since org_integration can be None
            if not installation.org_integration:
                raise InstallationNotFoundError

            code_mapping = get_code_mapping_from_request(request)
            new_code_mapping = create_code_mapping(organization, code_mapping, project)
        except KeyError:
            return self.respond(
                {"text": "Missing required parameters"}, status=status.HTTP_400_BAD_REQUEST
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
