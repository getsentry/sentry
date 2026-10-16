import logging
from typing import Literal, TypedDict

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
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.integrations.api.serializers.models.repository_project_path_config import (
    RepositoryProjectPathConfigSerializerResponse,
)
from sentry.integrations.source_code_management.repository import RepositoryIntegration
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


class DerivedCodeMappingMatch(TypedDict):
    filename: str
    repo_name: str
    repo_branch: str
    stacktrace_root: str
    source_path: str


class DeriveCodeMappingErrorResponse(TypedDict):
    text: str


@extend_schema(tags=["Integrations"])
@cell_silo_endpoint
class OrganizationDeriveCodeMappingsEndpoint(OrganizationEndpoint):
    """
    In the UI, we have a prompt to derive code mappings from the stacktrace filename.
    This endpoint is used to get the possible code mappings for it.
    """

    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (OrganizationIntegrationsLoosePermission,)

    @extend_schema(
        operation_id="listDerivedOrganizationCodeMappings",
        summary="Find Repository Files Matching a Stack Trace Frame",
        description="Find repository files that match the supplied stack trace filename.",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(
                "stacktraceFilename",
                type=str,
                required=True,
                description="The filename from a stack trace frame.",
            ),
            OpenApiParameter(
                "platform", type=str, description="The platform associated with the frame."
            ),
            OpenApiParameter(
                "absPath", type=str, description="The absolute path of the stack frame, if known."
            ),
            OpenApiParameter("module", type=str, description="The module name, if known."),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "DerivedCodeMappingMatchesResponse", list[DerivedCodeMappingMatch]
            ),
            204: RESPONSE_NO_CONTENT,
            400: RESPONSE_BAD_REQUEST,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[list[DerivedCodeMappingMatch]] | Response[DeriveCodeMappingErrorResponse]:
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

    @extend_schema(
        operation_id="createDerivedOrganizationCodeMapping",
        summary="Create an Organization Code Mapping from a Stack Trace Frame",
        description=(
            "Derive and save a repository path mapping for a project from a stack trace frame "
            "and repository name."
        ),
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=inline_serializer(
            name="CreateDerivedOrganizationCodeMappingRequest",
            fields={
                "projectId": serializers.IntegerField(
                    help_text="The ID of the project to configure."
                ),
                "repoName": serializers.CharField(
                    help_text="The repository name as it appears in the provider."
                ),
                "defaultBranch": serializers.CharField(
                    help_text="The branch to use when generating repository links."
                ),
                "stackRoot": serializers.CharField(
                    help_text="The path prefix used to match stack frame filenames."
                ),
                "sourceRoot": serializers.CharField(
                    help_text="The path prefix to remove from source file paths."
                ),
            },
        ),
        responses={
            201: inline_sentry_response_serializer(
                "OrganizationCodeMappingResponse", RepositoryProjectPathConfigSerializerResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(
        self, request: Request, organization: Organization
    ) -> (
        Response[RepositoryProjectPathConfigSerializerResponse]
        | Response[DeriveCodeMappingErrorResponse]
    ):
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

            assert isinstance(installation, RepositoryIntegration)
            code_mapping = get_code_mapping_from_request(request, installation)
            new_code_mapping = create_code_mapping(organization, code_mapping, project)
        except ValueError as e:
            return self.respond({"text": str(e)}, status=status.HTTP_404_NOT_FOUND)
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
