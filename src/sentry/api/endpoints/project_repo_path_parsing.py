from pathlib import PurePath, PureWindowsPath
from typing import Any, NotRequired, TypedDict
from urllib.parse import unquote, urlparse, urlunparse

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.integrations.base import IntegrationFeatures
from sentry.integrations.manager import default_manager as integrations
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.integrations.source_code_management.repository import RepositoryIntegration
from sentry.issues.auto_source_code_config.code_mapping import find_roots
from sentry.issues.auto_source_code_config.errors import (
    DoesNotFollowJavaPackageNamingConvention,
    MissingModuleOrAbsPath,
    NeedsExtension,
    UnexpectedPathException,
    UnsupportedFrameInfo,
)
from sentry.issues.auto_source_code_config.frame_info import create_frame_info
from sentry.models.project import Project
from sentry.models.repository import Repository


class RepoPathParsingResponse(TypedDict):
    # NOTE: API convention is to return identifiers as strings, but this endpoint has
    # always returned these as integers. Typed to match the existing behavior.
    integrationId: int
    repositoryId: int
    provider: str
    stackRoot: str
    sourceRoot: str
    defaultBranch: str


def unquote_source_url_path(source_url: str) -> str:
    parsed = urlparse(source_url)
    return urlunparse(parsed._replace(path=unquote(parsed.path)))


class PathMappingData(TypedDict):
    stack_path: str
    source_url: str
    abs_path: NotRequired[str | None]
    module: NotRequired[str | None]
    platform: NotRequired[str | None]


class PathMappingSerializer(CamelSnakeSerializer[PathMappingData]):
    stack_path = serializers.CharField(
        help_text="A file path as it appears in a stack trace frame."
    )
    source_url = serializers.URLField(
        help_text="The URL of the same file in the connected source code repository."
    )
    abs_path = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="The absolute path of the file in the stack trace frame. Required and nonempty when platform is java.",
    )
    module = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="The module containing the stack trace frame. Required and nonempty when platform is java.",
    )
    platform = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="The platform of the event containing the stack trace frame.",
    )

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.integration: RpcIntegration | None = None
        self.repo: Repository | None = None

    @property
    def providers(self) -> list[str]:
        return [
            x.key for x in integrations.all() if x.has_feature(IntegrationFeatures.STACKTRACE_LINK)
        ]

    @property
    def org_id(self) -> int:
        return self.context["organization_id"]

    def validate_source_url(self, source_url: str) -> str:
        # URLs copied from a provider's UI can be percent-encoded, but stack trace
        # paths are not, so decode before comparing or extracting paths
        source_url = unquote_source_url_path(source_url)

        # first check to see if we are even looking at the same file
        stack_path = self.initial_data["stack_path"]

        stack_file = PureWindowsPath(stack_path).name
        source_file = PurePath(urlparse(source_url).path).name

        if stack_file != source_file:
            raise serializers.ValidationError(
                "Source code URL points to a different file than the stack trace"
            )

        def integration_match(integration: RpcIntegration) -> bool:
            installation = integration.get_installation(self.org_id)
            # Check if the installation has the source_url_matches method
            if isinstance(installation, RepositoryIntegration):
                return installation.source_url_matches(source_url)
            # Fallback to a basic check if the method doesn't exist
            return False

        def repo_match(repo: Repository) -> bool:
            return repo.url is not None and source_url.startswith(repo.url)

        # now find the matching integration
        integrations = integration_service.get_integrations(
            organization_id=self.org_id, providers=self.providers
        )

        matching_integrations = list(filter(integration_match, integrations))
        if not matching_integrations:
            raise serializers.ValidationError("Could not find integration")

        self.integration = matching_integrations[0]

        # now find the matching repo
        repos = Repository.objects.filter(
            organization_id=self.org_id, integration_id=self.integration.id, url__isnull=False
        )
        matching_repos = list(filter(repo_match, repos))
        if not matching_repos:
            raise serializers.ValidationError("Could not find repo")

        # store the repo we found
        self.repo = matching_repos[0]
        return source_url


class ProjectRepoPathParsingEndpointLoosePermission(ProjectPermission):
    """
    Similar to the code_mappings endpoint, loosen permissions to all users
    """

    scope_map = {
        "POST": ["org:read", "project:write", "project:admin"],
    }


@extend_schema(tags=["Integrations"])
@cell_silo_endpoint
class ProjectRepoPathParsingEndpoint(ProjectEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.CODING_WORKFLOWS
    permission_classes = (ProjectRepoPathParsingEndpointLoosePermission,)

    @extend_schema(
        operation_id="parseProjectRepositoryPathMapping",
        summary="Parse a Repository Path Mapping",
        description=(
            "Derive the code-mapping settings that match a stack frame path to a file in the "
            "connected source repository. When `platform` is `java`, both `absPath` and `module` "
            "must be nonempty; otherwise the request returns 400."
        ),
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.PROJECT_ID_OR_SLUG],
        request=inline_serializer(
            name="PathMappingRequest",
            fields={
                "stackPath": serializers.CharField(
                    help_text="A file path as it appears in a stack trace frame."
                ),
                "sourceUrl": serializers.URLField(
                    help_text="The URL of the same file in the connected source code repository."
                ),
                "absPath": serializers.CharField(
                    required=False,
                    allow_null=True,
                    allow_blank=True,
                    help_text="The absolute path of the file in the stack trace frame. Required and nonempty when platform is java.",
                ),
                "module": serializers.CharField(
                    required=False,
                    allow_null=True,
                    allow_blank=True,
                    help_text="The module containing the stack trace frame. Required and nonempty when platform is java.",
                ),
                "platform": serializers.CharField(
                    required=False,
                    allow_null=True,
                    allow_blank=True,
                    help_text="The platform of the event containing the stack trace frame.",
                ),
            },
        ),
        responses={
            200: inline_sentry_response_serializer("RepoPathParsing", RepoPathParsingResponse),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(self, request: Request, project: Project) -> Response[RepoPathParsingResponse]:
        """
        Derive the code-mapping parameters (stack root, source root, default branch) that
        Sentry would create for a given stack trace frame and source code URL.

        Validates that a matching integration and repository exist for the provided URL.
        """
        serializer = PathMappingSerializer(
            context={"organization_id": project.organization_id},
            data=request.data,
        )
        if not serializer.is_valid():
            return self.respond(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        source_url = data["source_url"]
        try:
            frame_info = create_frame_info(
                {
                    "abs_path": data.get("abs_path"),
                    "filename": data["stack_path"],
                    "module": data.get("module"),
                },
                data.get("platform"),
            )
        except MissingModuleOrAbsPath:
            return self.respond(
                {"detail": "absPath and module are required for Java frames"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except DoesNotFollowJavaPackageNamingConvention:
            return self.respond(
                {"detail": "Module must follow Java package naming conventions"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except NeedsExtension:
            return self.respond({"detail": "Needs extension"}, status=status.HTTP_400_BAD_REQUEST)
        except UnsupportedFrameInfo:
            return self.respond(
                {"detail": "Unsupported frame info"}, status=status.HTTP_400_BAD_REQUEST
            )

        # validated by `serializer.is_valid()`
        assert serializer.repo is not None
        assert serializer.integration is not None
        repo = serializer.repo
        integration = serializer.integration
        installation = integration.get_installation(project.organization_id)

        if not isinstance(installation, RepositoryIntegration):
            return self.respond(
                {"detail": "Integration does not support repository operations"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        branch = installation.extract_branch_from_source_url(repo, source_url)
        source_path = installation.extract_source_path_from_source_url(repo, source_url)

        try:
            stack_root, source_root = find_roots(frame_info, source_path)
        except UnexpectedPathException:
            return self.respond(
                {"detail": "Could not determine code mapping from provided paths"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return self.respond(
            {
                "integrationId": integration.id,
                "repositoryId": repo.id,
                "provider": integration.provider,
                "stackRoot": stack_root,
                "sourceRoot": source_root,
                "defaultBranch": branch,
            }
        )
