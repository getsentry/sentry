from typing import Any, TypedDict

from django.db.models import Count
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.project_repository import (
    ProjectRepositorySerializer,
    ProjectRepositorySerializerResponse,
)
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_NOT_FOUND
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.response_types import (
    DetailResponse,
    ValidationErrorResponse,
    as_validation_errors,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.models.projectrepository import ProjectRepository, ProjectRepositorySource
from sentry.models.repository import Repository


class _ProjectRepoLinkResponse(TypedDict):
    id: str
    projectId: str
    repositoryId: str
    source: str
    created: bool


class ProjectRepoSerializer(serializers.Serializer[ProjectRepository]):
    repositoryId = serializers.IntegerField(
        required=True, help_text="The ID of the repository to link."
    )

    def __init__(self, *args: Any, project: Project, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.project = project

    def validate_repositoryId(self, value: int) -> int:
        if not Repository.objects.filter(
            id=value,
            organization_id=self.project.organization_id,
            status=ObjectStatus.ACTIVE,
        ).exists():
            raise serializers.ValidationError("Repository not found.")
        return value

    def create(self, validated_data: dict[str, Any]) -> ProjectRepository:
        project_repo, created = ProjectRepository.objects.get_or_create_with_source(
            project_id=self.project.id,
            repository_id=validated_data["repositoryId"],
            source=ProjectRepositorySource.SCM_ONBOARDING,
        )
        self._created = created
        return project_repo


@extend_schema(tags=["Projects"])
@cell_silo_endpoint
class ProjectRepoEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (ProjectPermission,)

    @extend_schema(
        operation_id="listProjectRepositories",
        summary="List Repositories Linked to a Project",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            OpenApiParameter(
                name="includeMappingCount",
                location="query",
                required=False,
                type=str,
                description=(
                    "When set to `1`, each row includes a `mappingCount` field "
                    "with the number of code path mappings for that repository. "
                    "Omitted by default to keep the response lightweight."
                ),
            ),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ProjectRepoListResponse",
                list[ProjectRepositorySerializerResponse],
            ),
        },
    )
    def get(
        self, request: Request, project: Project
    ) -> Response[list[ProjectRepositorySerializerResponse]]:
        """
        List all repositories linked to a project.

        Pass `?includeMappingCount=1` to include the number of code path mappings
        per repository. Omitting it keeps the query cheaper for callers that
        only need the list of connections.
        """
        include_mapping_count = request.GET.get("includeMappingCount") == "1"

        qs = (
            ProjectRepository.objects.filter(
                project=project,
                repository__status=ObjectStatus.ACTIVE,
            )
            .select_related("repository")
            .order_by("repository__name", "id")
        )

        if include_mapping_count:
            qs = qs.annotate(mapping_count=Count("repositoryprojectpathconfig"))

        return self.paginate(
            request=request,
            queryset=qs,
            paginator_cls=OffsetPaginator,
            on_results=lambda items: serialize(
                items,
                request.user,
                ProjectRepositorySerializer(include_mapping_count=include_mapping_count),
            ),
        )

    @extend_schema(
        operation_id="linkProjectRepository",
        summary="Link a Repository to a Project",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
        ],
        request=inline_serializer(
            "ProjectRepoLinkRequest",
            fields={
                "repositoryId": serializers.IntegerField(
                    help_text="The ID of the repository to link."
                ),
            },
        ),
        responses={
            201: inline_serializer(
                "ProjectRepoLinkResponse",
                fields={
                    "id": serializers.CharField(),
                    "projectId": serializers.CharField(),
                    "repositoryId": serializers.CharField(),
                    "source": serializers.CharField(),
                    "created": serializers.BooleanField(),
                },
            ),
            400: RESPONSE_BAD_REQUEST,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(
        self, request: Request, project: Project
    ) -> (
        Response[_ProjectRepoLinkResponse]
        | Response[DetailResponse]
        | Response[ValidationErrorResponse]
    ):
        """
        Link a repository to a project. The repository must already exist
        in the organization (connected via a VCS integration). Idempotent:
        returns 200 if the link already exists, 201 if created.
        """
        serializer = ProjectRepoSerializer(data=request.data, project=project)
        if not serializer.is_valid():
            errors = serializer.errors
            repo_errors = errors.get("repositoryId", [])
            if any("not found" in str(e).lower() for e in repo_errors):
                return Response(
                    {"detail": repo_errors[0]},
                    status=status.HTTP_404_NOT_FOUND,
                )
            return Response(as_validation_errors(serializer), status=status.HTTP_400_BAD_REQUEST)

        project_repo = serializer.save()
        created = serializer._created

        body: _ProjectRepoLinkResponse = {
            "id": str(project_repo.id),
            "projectId": str(project.id),
            "repositoryId": str(project_repo.repository_id),
            "source": project_repo.get_source_display(),
            "created": created,
        }
        return Response(
            body,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
