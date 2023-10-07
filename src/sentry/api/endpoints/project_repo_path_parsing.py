from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import integrations
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.integrations import IntegrationFeatures
from sentry.models.repository import Repository
from sentry.services.hybrid_cloud.integration import RpcIntegration, integration_service


def find_roots(stack_path, source_path):
    """
    Returns a tuple containing the stack_root, and the source_root.
    If there is no overlap, raise an exception since this should not happen
    """
    overlap_to_check = stack_path
    stack_root = ""
    while overlap_to_check:
        # see if our path ends with the overlap we want
        if source_path.endswith(overlap_to_check):
            # determine the source root by removing the overlap
            source_root = source_path.rpartition(overlap_to_check)[0]
            return (stack_root, source_root)
        # increase the stack root specificity
        # while decreasing the overlap
        stack_root += overlap_to_check[0]
        overlap_to_check = overlap_to_check[1:]
    # validate_source_url should have ensured the file names match
    # so if we get here something went wrong and there is a bug
    raise Exception("Could not find common root from paths")


class PathMappingSerializer(CamelSnakeSerializer):
    stack_path = serializers.CharField()
    source_url = serializers.URLField()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.integration = None
        self.repo = None

    @property
    def providers(self):
        return [
            x.key for x in integrations.all() if x.has_feature(IntegrationFeatures.STACKTRACE_LINK)
        ]

    @property
    def org_id(self):
        return self.context["organization_id"]

    def validate_source_url(self, source_url: str):
        # first check to see if we are even looking at the same file
        stack_path = self.initial_data["stack_path"]
        stack_file = stack_path.split("/")[-1]
        source_file = source_url.split("/")[-1]

        if stack_file != source_file:
            raise serializers.ValidationError(
                "Source code URL points to a different file than the stack trace"
            )

        def integration_match(integration: RpcIntegration):
            installation = integration.get_installation(self.org_id)
            return installation.source_url_matches(source_url)

        def repo_match(repo: Repository):
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


@region_silo_endpoint
class ProjectRepoPathParsingEndpoint(ProjectEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (ProjectRepoPathParsingEndpointLoosePermission,)
    """
    Returns the parameters associated with the RepositoryProjectPathConfig
    we would create based on a particular stack trace and source code URL.
    Does validation to make sure we have an integration and repo
    depending on the source code URL
    """

    def post(self, request: Request, project) -> Response:
        serializer = PathMappingSerializer(
            context={"organization_id": project.organization_id},
            data=request.data,
        )
        if not serializer.is_valid():
            return self.respond(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        source_url = data["source_url"]
        stack_path = data["stack_path"]

        repo = serializer.repo
        integration = serializer.integration
        installation = integration.get_installation(project.organization_id)

        branch = installation.extract_branch_from_source_url(repo, source_url)
        source_path = installation.extract_source_path_from_source_url(repo, source_url)
        stack_root, source_root = find_roots(stack_path, source_path)

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
