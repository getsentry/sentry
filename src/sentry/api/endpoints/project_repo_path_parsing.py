from rest_framework import status, serializers

from sentry import integrations
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.integrations import IntegrationFeatures
from sentry.models import Integration, Repository
from sentry.utils.compat import filter, map


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
        providers = filter(
            lambda x: x.has_feature(IntegrationFeatures.STACKTRACE_LINK), list(integrations.all())
        )
        return map(lambda x: x.key, providers)

    @property
    def org_id(self):
        return self.context["organization_id"]

    def validate_source_url(self, source_url):
        # first check to see if we are even looking at the same file
        stack_path = self.initial_data["stack_path"]
        stack_file = stack_path.split("/")[-1]
        source_file = source_url.split("/")[-1]

        if stack_file != source_file:
            raise serializers.ValidationError(
                "Source code URL points to a different file than the stack trace"
            )

        def integration_match(integration):
            return source_url.startswith("https://{}".format(integration.metadata["domain_name"]))

        def repo_match(repo):
            return source_url.startswith(repo.url)

        # now find the matching integration
        integrations = Integration.objects.filter(
            organizations=self.org_id, provider__in=self.providers
        )

        matching_integrations = filter(integration_match, integrations)
        if not matching_integrations:
            raise serializers.ValidationError("Could not find integration")

        self.integration = matching_integrations[0]

        # now find the matching repo
        repos = Repository.objects.filter(integration_id=self.integration.id)
        matching_repos = filter(repo_match, repos)
        if not matching_repos:
            raise serializers.ValidationError("Could not find repo")

        # store the repo we found
        self.repo = matching_repos[0]
        return source_url


class ProjectRepoPathParsingEndpoint(ProjectEndpoint):
    """
    Returns the parameters associated with the RepositoryProjectPathConfig
    we would create based on a particular stack trace and source code URL.
    Does validation to make sure we have an integration and repo
    depending on the source code URL
    """

    def post(self, request, project):
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

        # strip off the base URL (could be in different formats)
        rest_url = source_url.replace(f"{repo.url}/-/blob/", "")
        rest_url = rest_url.replace(f"{repo.url}/blob/", "")
        branch, _, source_path = rest_url.partition("/")

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
