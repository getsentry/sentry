from typing import Any

from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.models.projectrepository import ProjectRepository, ProjectRepositorySource
from sentry.models.repository import Repository


class ProjectRepoLinkSerializer(serializers.Serializer[ProjectRepository]):
    repositoryId = serializers.IntegerField(required=True)

    def __init__(self, *args: Any, project: Project, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.project = project
        self.repository: Repository | None = None

    def validate_repositoryId(self, value: int) -> int:
        try:
            self.repository = Repository.objects.get(
                id=value,
                organization_id=self.project.organization_id,
                status=ObjectStatus.ACTIVE,
            )
        except Repository.DoesNotExist:
            raise serializers.ValidationError("Repository not found.")
        return value

    def create(self, validated_data: dict[str, Any]) -> ProjectRepository:
        assert self.repository is not None
        project_repo, created = ProjectRepository.objects.get_or_create(
            project=self.project,
            repository=self.repository,
            defaults={"source": ProjectRepositorySource.SCM_ONBOARDING},
        )
        self._created = created
        return project_repo


@cell_silo_endpoint
class ProjectRepoLinkEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ProjectPermission,)

    def post(self, request: Request, project: Project) -> Response:
        serializer = ProjectRepoLinkSerializer(data=request.data, project=project)
        if not serializer.is_valid():
            errors = serializer.errors
            repo_errors = errors.get("repositoryId", [])
            if any("not found" in str(e).lower() for e in repo_errors):
                return Response(
                    {"detail": repo_errors[0]},
                    status=status.HTTP_404_NOT_FOUND,
                )
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        project_repo = serializer.save()
        created = serializer._created

        return Response(
            {
                "id": str(project_repo.id),
                "projectId": str(project.id),
                "repositoryId": str(project_repo.repository_id),
                "source": project_repo.get_source_display(),
                "created": created,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
