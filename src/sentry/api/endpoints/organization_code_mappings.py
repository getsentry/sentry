from django.http import Http404
from django.utils.translation import ugettext_lazy as _
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationIntegrationsPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.models import OrganizationIntegration, Project, Repository, RepositoryProjectPathConfig


def gen_path_regex_field():
    return serializers.RegexField(
        r"^[^\s'\"]+$",  # may need to add more characters to prevent in the future
        required=True,
        allow_blank=True,
        error_messages={"invalid": _("Path may not contain spaces or quotations")},
    )


BRANCH_NAME_ERROR_MESSAGE = "Branch name may only have letters, numbers, underscores, forward slashes, dashes, and periods. Branch name may not start or end with a forward slash."


class RepositoryProjectPathConfigSerializer(CamelSnakeModelSerializer):
    repository_id = serializers.IntegerField(required=True)
    project_id = serializers.IntegerField(required=True)
    stack_root = gen_path_regex_field()
    source_root = gen_path_regex_field()
    default_branch = serializers.RegexField(
        r"^(^(?![\/]))([\w\.\/-]+)(?<![\/])$",
        required=True,
        error_messages={"invalid": _(BRANCH_NAME_ERROR_MESSAGE)},
    )

    class Meta:
        model = RepositoryProjectPathConfig
        fields = [
            "repository_id",
            "project_id",
            "stack_root",
            "source_root",
            "default_branch",
        ]
        extra_kwargs = {}

    @property
    def org_integration(self):
        return self.context["organization_integration"]

    @property
    def organization(self):
        return self.context["organization"]

    def validate(self, attrs):
        query = RepositoryProjectPathConfig.objects.filter(
            project_id=attrs.get("project_id"), stack_root=attrs.get("stack_root")
        )
        if self.instance:
            query = query.exclude(id=self.instance.id)
        if query.exists():
            raise serializers.ValidationError(
                "Code path config already exists with this project and stack trace root"
            )
        return attrs

    def validate_repository_id(self, repository_id):
        # validate repo exists on this org
        repo_query = Repository.objects.filter(
            id=repository_id, organization_id=self.organization.id
        )
        # validate that repo exists on integration
        repo_query = repo_query.filter(
            integration_id=self.org_integration.integration_id,
        )
        if not repo_query.exists():
            raise serializers.ValidationError("Repository does not exist")
        return repository_id

    def validate_project_id(self, project_id):
        # validate project exists on this org
        project_query = Project.objects.filter(id=project_id, organization_id=self.organization.id)
        if not project_query.exists():
            raise serializers.ValidationError("Project does not exist")
        return project_id

    def create(self, validated_data):
        return RepositoryProjectPathConfig.objects.create(
            organization_integration=self.org_integration, **validated_data
        )

    def update(self, instance, validated_data):
        if "id" in validated_data:
            validated_data.pop("id")
        for key, value in validated_data.items():
            setattr(self.instance, key, value)
        self.instance.save()
        return self.instance


class OrganizationIntegrationMixin:
    def get_organization_integration(self, organization, integration_id):
        try:
            return OrganizationIntegration.objects.get(
                integration_id=integration_id,
                organization=organization,
            )
        except OrganizationIntegration.DoesNotExist:
            raise Http404

    def get_project(self, organization, project_id):
        try:
            return Project.objects.get(organization=organization, id=project_id)

        except Project.DoesNotExist:
            raise Http404


class OrganizationCodeMappingsEndpoint(OrganizationEndpoint, OrganizationIntegrationMixin):
    permission_classes = (OrganizationIntegrationsPermission,)

    def get(self, request: Request, organization) -> Response:
        """
        Get the list of repository project path configs

        :pparam string organization_slug: the slug of the organization the
                                          team should be created for.
        :qparam int integrationId: the optional integration id.
        :qparam int project: Optional. Pass "-1" to filter to 'all projects user has access to'. Omit to filter for 'all projects user is a member of'.
        :qparam int per_page: Pagination size.
        :qparam string cursor: Pagination cursor.
        :auth: required
        """

        integration_id = request.GET.get("integrationId")

        queryset = RepositoryProjectPathConfig.objects.all()

        if integration_id:
            # get_organization_integration will raise a 404 if no org_integration is found
            org_integration = self.get_organization_integration(organization, integration_id)
            queryset = queryset.filter(organization_integration=org_integration)
        else:
            # Filter by project
            projects = self.get_projects(request, organization)
            queryset = queryset.filter(project__in=projects)

        return self.paginate(
            request=request,
            queryset=queryset,
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )

    def post(self, request: Request, organization) -> Response:
        """
        Create a new repository project path config
        ``````````````````

        :pparam string organization_slug: the slug of the organization the
                                          team should be created for.
        :param int repositoryId:
        :param int projectId:
        :param string stackRoot:
        :param string sourceRoot:
        :param string defaultBranch:
        :param int required integrationId:
        :auth: required
        """
        integration_id = request.data.get("integrationId")

        if not integration_id:
            return self.respond("Missing param: integration_id", status=status.HTTP_400_BAD_REQUEST)

        try:
            # We expect there to exist an org_integration
            org_integration = self.get_organization_integration(organization, integration_id)
        except Http404:
            # Human friendly error response.
            return self.respond(
                "Could not find this integration installed on your organization",
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = RepositoryProjectPathConfigSerializer(
            context={"organization": organization, "organization_integration": org_integration},
            data=request.data,
        )
        if serializer.is_valid():
            repository_project_path_config = serializer.save()
            return self.respond(
                serialize(repository_project_path_config, request.user),
                status=status.HTTP_201_CREATED,
            )

        return self.respond(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
