from typing import Any, NotRequired, TypedDict

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
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_NOT_FOUND
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.response_types import (
    DetailResponse,
    ValidationErrorResponse,
    as_validation_errors,
)
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


class _ProjectRepoListItemBase(TypedDict):
    id: str
    projectId: str
    repositoryId: str
    repoName: str
    source: str
    providerKey: str | None


class _ProjectRepoListItemOptional(TypedDict, total=False):
    mappingCount: NotRequired[int]


class _ProjectRepoListItem(_ProjectRepoListItemBase, _ProjectRepoListItemOptional):
    pass


def _serialize_project_repo(
    project_repo: ProjectRepository, *, mapping_count: int | None = None
) -> _ProjectRepoListItem:
    repository = project_repo.repository
    provider = repository.provider
    provider_key = provider.removeprefix("integrations:") if provider else None

    item: _ProjectRepoListItem = {
        "id": str(project_repo.id),
        "projectId": str(project_repo.project_id),
        "repositoryId": str(repository.id),
        "repoName": repository.name,
        "source": project_repo.get_source_display(),
        "providerKey": provider_key,
    }
    if mapping_count is not None:
        item["mappingCount"] = mapping_count
    return item


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
                name="includeMapsCount",
                location="query",
                required=False,
                type=str,
                description=(
                    "When set to `1` or `true`, each row includes a `mappingCount` field "
                    "with the number of code path mappings for that repository. "
                    "Omitted by default to keep the response lightweight."
                ),
            ),
        ],
        responses={
            200: inline_serializer(
                "ProjectRepoListResponse",
                fields={
                    "id": serializers.CharField(),
                    "projectId": serializers.CharField(),
                    "repositoryId": serializers.CharField(),
                    "repoName": serializers.CharField(),
                    "source": serializers.CharField(),
                    "providerKey": serializers.CharField(allow_null=True),
                    "mappingCount": serializers.IntegerField(required=False),
                },
                many=True,
            ),
        },
    )
    def get(self, request: Request, project: Project) -> Response[list[_ProjectRepoListItem]]:
        """
        List all repositories linked to a project.

        Pass `?includeMapsCount=1` to include the number of code path mappings
        per repository. Omitting it keeps the query cheaper for callers that
        only need the list of connections.
        """
        include_maps_count = request.GET.get("includeMapsCount") == "1"

        qs = (
            ProjectRepository.objects.filter(
                project=project,
                repository__status=ObjectStatus.ACTIVE,
            )
            .select_related("repository")
            .order_by("repository__name", "id")
        )

        if include_maps_count:
            qs = qs.annotate(mapping_count=Count("repositoryprojectpathconfig"))

        def on_results(project_repos: list[ProjectRepository]) -> list[_ProjectRepoListItem]:
            return [
                _serialize_project_repo(
                    pr,
                    mapping_count=pr.mapping_count if include_maps_count else None,  # type: ignore[attr-defined]
                )
                for pr in project_repos
            ]

        return self.paginate(
            request=request,
            queryset=qs,
            paginator_cls=OffsetPaginator,
            on_results=on_results,
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
