from __future__ import annotations

from typing import TypedDict

from django.db import router, transaction
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.autofix.utils import replace_all_branch_overrides
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.seer.seer_setup import get_supported_scm_providers


class BranchOverrideResponse(TypedDict):
    tagName: str
    tagValue: str
    branchName: str


class ProjectRepoResponse(TypedDict):
    id: str
    repositoryId: str
    provider: str
    owner: str
    name: str
    externalId: str
    integrationId: str | None
    branchName: str | None
    branchOverrides: list[BranchOverrideResponse]
    instructions: str | None


def _serialize_project_repo(project_repo: SeerProjectRepository) -> ProjectRepoResponse:
    repo = project_repo.project_repository.repository
    name_parts = repo.name.split("/", 1)
    owner = name_parts[0] if len(name_parts) > 1 else ""
    name = name_parts[1] if len(name_parts) > 1 else repo.name

    return ProjectRepoResponse(
        id=str(project_repo.id),
        repositoryId=str(repo.id),
        provider=repo.provider or "",
        owner=owner,
        name=name,
        externalId=repo.external_id or "",
        integrationId=str(repo.integration_id) if repo.integration_id is not None else None,
        branchName=project_repo.branch_name,
        branchOverrides=[
            BranchOverrideResponse(
                tagName=bo.tag_name,
                tagValue=bo.tag_value,
                branchName=bo.branch_name,
            )
            for bo in project_repo.branch_overrides.all()
        ],
        instructions=project_repo.instructions,
    )


def _get_project_repos_queryset(project: Project, organization: Organization):
    return (
        SeerProjectRepository.objects.filter(
            project_repository__project=project,
            project_repository__repository__status=ObjectStatus.ACTIVE,
            project_repository__repository__provider__in=get_supported_scm_providers(organization),
        )
        .select_related("project_repository", "project_repository__repository")
        .prefetch_related("branch_overrides")
    )


def _validate_branch_overrides(value):
    if not value:
        return value
    seen: set[tuple[str, str]] = set()
    for override in value:
        key = (override["tag_name"], override["tag_value"])
        if key in seen:
            raise serializers.ValidationError(
                f"Duplicate branch override for tag {key[0]}={key[1]}"
            )
        seen.add(key)
    return value


class BranchOverrideSerializer(CamelSnakeSerializer):
    tag_name = serializers.CharField(required=True)
    tag_value = serializers.CharField(required=True)
    branch_name = serializers.CharField(required=True)


class SeerProjectRepoUpdateSerializer(CamelSnakeSerializer):
    branch_name = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    instructions = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    branch_overrides = BranchOverrideSerializer(many=True, required=False, allow_null=False)

    def validate_branch_overrides(self, value):
        return _validate_branch_overrides(value)


@cell_silo_endpoint
class OrganizationSeerProjectRepoDetailsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (OrganizationPermission,)

    def get(
        self, request: Request, organization: Organization, project_id: int, repo_id: int
    ) -> Response:
        project = self.get_projects(request, organization, project_ids={int(project_id)})[0]

        project_repo = (
            _get_project_repos_queryset(project, organization)
            .filter(project_repository__repository_id=repo_id)
            .first()
        )
        if project_repo is None:
            return Response(status=404)

        return Response(_serialize_project_repo(project_repo))

    def put(
        self, request: Request, organization: Organization, project_id: int, repo_id: int
    ) -> Response:
        project = self.get_projects(request, organization, project_ids={int(project_id)})[0]

        serializer = SeerProjectRepoUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

        with transaction.atomic(router.db_for_write(SeerProjectRepository)):
            project_repo = (
                SeerProjectRepository.objects.select_for_update()
                .select_related("project_repository", "project_repository__repository")
                .filter(
                    project_repository__project=project,
                    project_repository__repository_id=repo_id,
                    project_repository__repository__status=ObjectStatus.ACTIVE,
                    project_repository__repository__provider__in=get_supported_scm_providers(
                        organization
                    ),
                )
                .first()
            )
            if project_repo is None:
                return Response(status=404)

            if "branch_name" in data:
                project_repo.branch_name = data["branch_name"]
            if "instructions" in data:
                project_repo.instructions = data["instructions"]
            project_repo.save()

            if "branch_overrides" in data:
                replace_all_branch_overrides(project_repo, data["branch_overrides"])

        return Response(_serialize_project_repo(project_repo))

    def delete(
        self, request: Request, organization: Organization, project_id: int, repo_id: int
    ) -> Response:
        project = self.get_projects(request, organization, project_ids={int(project_id)})[0]

        with transaction.atomic(router.db_for_write(SeerProjectRepository)):
            deleted_count, _ = SeerProjectRepository.objects.filter(
                project_repository__project=project,
                project_repository__repository_id=repo_id,
                project_repository__repository__status=ObjectStatus.ACTIVE,
                project_repository__repository__provider__in=get_supported_scm_providers(
                    organization
                ),
            ).delete()

        if deleted_count == 0:
            return Response(status=404)

        return Response(status=204)
