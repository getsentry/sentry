from __future__ import absolute_import

from rest_framework import status, serializers

from sentry.api.bases.organization import OrganizationIntegrationsPermission
from sentry.api.bases.organization_integrations import OrganizationIntegrationBaseEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.models import RepositoryProjectPathConfig, Project, Repository
from sentry.utils.compat import map


class RepositoryProjectPathConfigSerializer(CamelSnakeModelSerializer):
    repository_id = serializers.IntegerField(required=True)
    project_id = serializers.IntegerField(required=True)
    stack_root = serializers.CharField(required=True)
    source_root = serializers.CharField(required=True)
    default_branch = serializers.CharField(required=True)

    class Meta:
        model = RepositoryProjectPathConfig
        fields = ["repository_id", "project_id", "stack_root", "source_root", "default_branch"]
        extra_kwargs = {}

    @property
    def org_integration(self):
        return self.context["organization_integration"]

    @property
    def organization_id(self):
        return self.org_integration.organization_id

    def validate(self, attrs):
        # TODO: Needs to be updated for update since the row already exists
        query = RepositoryProjectPathConfig.objects.filter(
            project_id=attrs.get("project_id"), stack_root=attrs.get("stack_root")
        )
        if query.exists():
            raise serializers.ValidationError(
                "Code path config already exists with this project and stack root"
            )
        return attrs

    def validate_repository_id(self, repository_id):
        # validate repo exists on this org and integration
        repo_query = Repository.objects.filter(
            id=repository_id,
            organization_id=self.organization_id,
            integration_id=self.org_integration.integration_id,
        )
        if not repo_query.exists():
            raise serializers.ValidationError("Repository does not exist")
        return repository_id

    def validate_project_id(self, project_id):
        # validate project exists on this org
        project_query = Project.objects.filter(id=project_id, organization_id=self.organization_id)
        if not project_query.exists():
            raise serializers.ValidationError("Project does not exist")
        return project_id

    def create(self, validated_data):
        return RepositoryProjectPathConfig.objects.create(
            organization_integration=self.org_integration, **validated_data
        )


class OrganizationIntegrationRepositoryProjectPathConfigEndpoint(
    OrganizationIntegrationBaseEndpoint
):
    permission_classes = (OrganizationIntegrationsPermission,)

    def get(self, request, organization, integration_id):
        """
        Get the list of repository project path configs in an integration
        """
        org_integration = self.get_organization_integration(organization, integration_id)

        # front end handles ordering
        repository_project_path_configs = RepositoryProjectPathConfig.objects.filter(
            organization_integration=org_integration
        )

        # TODO: Add pagination
        data = map(lambda x: serialize(x, request.user), repository_project_path_configs)
        return self.respond(data)

    def post(self, request, organization, integration_id):
        org_integration = self.get_organization_integration(organization, integration_id)

        serializer = RepositoryProjectPathConfigSerializer(
            context={"organization_integration": org_integration}, data=request.data,
        )
        if serializer.is_valid():
            repository_project_path_config = serializer.save()
            return self.respond(
                serialize(repository_project_path_config, request.user), status=status.HTTP_200_OK
            )

        return self.respond(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
