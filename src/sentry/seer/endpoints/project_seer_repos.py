from __future__ import annotations

from collections.abc import Sequence
from functools import partial
from typing import TypedDict

from django.db import router, transaction
from django.db.models import QuerySet, Value
from django.db.models.functions import Replace
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.event_search import QueryToken, SearchConfig, SearchFilter
from sentry.api.event_search import parse_search_query as base_parse_search_query
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.constants import ObjectStatus
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.projectrepository import ProjectRepository
from sentry.models.repository import Repository
from sentry.seer.autofix.utils import (
    add_seer_project_repos,
    get_seer_project_repo,
    get_token_based_billing_project_repos,
    is_seer_token_based_billing_onboarding_enabled,
    replace_all_seer_project_repos,
    update_seer_project_repo,
)
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.seer.seer_setup import get_supported_scm_providers

SORT_FIELDS_MAPPING: dict[str, str] = {
    "name": "repository__name",
    "-name": "-repository__name",
    "provider": "provider_normalized",
    "-provider": "-provider_normalized",
}

search_config = SearchConfig.create_from(
    SearchConfig(), allowed_keys={"name", "provider"}, allow_boolean=False, free_text_key="name"
)
parse_search_query = partial(base_parse_search_query, config=search_config)


class BranchOverrideResponse(TypedDict):
    id: str
    tagName: str
    tagValue: str
    branchName: str


class ProjectRepoResponse(TypedDict):
    id: str
    repositoryId: str
    organizationId: str
    provider: str
    owner: str
    name: str
    externalId: str
    integrationId: str | None
    branchName: str | None
    branchOverrides: list[BranchOverrideResponse]
    instructions: str | None


def _serialize_project_repo(
    project_repo: ProjectRepository, seer_project_repo: SeerProjectRepository | None
) -> ProjectRepoResponse:
    repo = project_repo.repository
    name_parts = repo.name.split("/", 1)
    owner = name_parts[0] if len(name_parts) > 1 else ""
    name = name_parts[1] if len(name_parts) > 1 else repo.name

    return ProjectRepoResponse(
        id=str(project_repo.id),
        repositoryId=str(repo.id),
        organizationId=str(repo.organization_id),
        provider=repo.provider or "",
        owner=owner,
        name=name,
        externalId=repo.external_id or "",
        integrationId=str(repo.integration_id) if repo.integration_id is not None else None,
        branchName=seer_project_repo.branch_name if seer_project_repo else None,
        branchOverrides=(
            [
                BranchOverrideResponse(
                    id=str(bo.id),
                    tagName=bo.tag_name,
                    tagValue=bo.tag_value,
                    branchName=bo.branch_name,
                )
                for bo in seer_project_repo.branch_overrides.all()
            ]
            if seer_project_repo
            else []
        ),
        instructions=seer_project_repo.instructions if seer_project_repo else None,
    )


def _get_seat_based_billing_seer_project_repos(project: Project) -> QuerySet[SeerProjectRepository]:
    """SeerProjectRepository Seer can use under seat-based billing."""
    return SeerProjectRepository.objects.filter(
        project_repository__project=project,
        project_repository__repository__status=ObjectStatus.ACTIVE,
        project_repository__repository__provider__in=get_supported_scm_providers(
            project.organization
        ),
    ).select_related("project_repository", "project_repository__repository")


def _get_seat_based_billing_project_repos(project: Project) -> QuerySet[ProjectRepository]:
    """ProjectRepository Seer can use under seat-based billing."""
    return (
        ProjectRepository.objects.filter(
            project=project,
            seerprojectrepository__isnull=False,
            repository__status=ObjectStatus.ACTIVE,
            repository__provider__in=get_supported_scm_providers(project.organization),
        )
        .select_related("repository", "seerprojectrepository")
        .prefetch_related("seerprojectrepository__branch_overrides")
    )


def _get_seat_based_billing_repos(organization: Organization) -> QuerySet[Repository]:
    """Repos Seer can use under seat-based billing."""
    return Repository.objects.filter(
        organization_id=organization.id,
        status=ObjectStatus.ACTIVE,
        provider__in=get_supported_scm_providers(organization),
    )


def _get_token_based_billing_repos(organization: Organization) -> QuerySet[Repository]:
    """Repos Seer can use under token-based billing. Same checks as get_token_based_billing_project_repos."""
    return Repository.objects.filter(
        organization_id=organization.id,
        status=ObjectStatus.ACTIVE,
        provider__in=get_supported_scm_providers(organization),
        integration_id__isnull=False,
        external_id__isnull=False,
    ).exclude(external_id="")


def _validate_repo_ids(project: Project, repo_ids: list[int]) -> None:
    """Raise ValueError if any repo IDs are invalid, inactive, or have providers not supported by Seer."""
    organization = project.organization
    repos = (
        _get_token_based_billing_repos(organization)
        if is_seer_token_based_billing_onboarding_enabled(organization)
        else _get_seat_based_billing_repos(organization)
    )
    valid_ids = set(repos.filter(id__in=repo_ids).values_list("id", flat=True))
    invalid_ids = set(repo_ids) - valid_ids
    if invalid_ids:
        raise ValueError(sorted(invalid_ids))


def _apply_search_filters(queryset, filters: Sequence[QueryToken]):
    for f in filters:
        if not isinstance(f, SearchFilter):
            continue

        key = f.key.name
        op = f.operator
        value = f.value.value

        if key == "name":
            if op not in ("=", "!="):
                raise InvalidSearchQuery(f"name does not support the {op} operator.")
            if op == "=":
                queryset = queryset.filter(repository__name__icontains=value)
            elif op == "!=":
                queryset = queryset.exclude(repository__name__icontains=value)

        elif key == "provider":
            if op not in ("=", "!=", "IN", "NOT IN"):
                raise InvalidSearchQuery(f"provider does not support the {op} operator.")
            normalize = lambda v: v.removeprefix("integrations:")
            if op == "=":
                queryset = queryset.filter(provider_normalized=normalize(value))
            elif op == "!=":
                queryset = queryset.exclude(provider_normalized=normalize(value))
            elif op == "IN":
                queryset = queryset.filter(provider_normalized__in=[normalize(v) for v in value])
            elif op == "NOT IN":
                queryset = queryset.exclude(provider_normalized__in=[normalize(v) for v in value])

    return queryset


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

    def validate(self, data):
        if not data:
            raise serializers.ValidationError("At least one field must be provided.")
        return data


class SeerProjectRepoCreateSerializer(CamelSnakeSerializer):
    repository_id = serializers.IntegerField(required=True)
    branch_name = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    instructions = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    branch_overrides = BranchOverrideSerializer(many=True, required=False, allow_null=False)

    def validate_branch_overrides(self, value):
        return _validate_branch_overrides(value)


class SeerProjectReposBulkSerializer(CamelSnakeSerializer):
    repos = SeerProjectRepoCreateSerializer(many=True, required=True, allow_empty=True)

    def validate_repos(self, value):
        repo_ids = [r["repository_id"] for r in value]
        if len(repo_ids) != len(set(repo_ids)):
            raise serializers.ValidationError("Duplicate repository IDs are not allowed.")
        return value


@cell_silo_endpoint
class ProjectSeerRepoEndpoint(ProjectEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, project: Project, repo_id: int) -> Response:
        project_repos_qs = (
            get_token_based_billing_project_repos(project.organization, [project.id])
            if is_seer_token_based_billing_onboarding_enabled(project.organization)
            else _get_seat_based_billing_project_repos(project)
        )
        project_repo = project_repos_qs.filter(repository_id=repo_id).first()
        if project_repo is None:
            return Response(status=404)

        return Response(_serialize_project_repo(project_repo, get_seer_project_repo(project_repo)))

    def put(self, request: Request, project: Project, repo_id: int) -> Response:
        serializer = SeerProjectRepoUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

        seer_project_repo: SeerProjectRepository | None
        with transaction.atomic(router.db_for_write(SeerProjectRepository)):
            if is_seer_token_based_billing_onboarding_enabled(project.organization):
                project_repo = (
                    get_token_based_billing_project_repos(project.organization, [project.id])
                    .filter(repository_id=repo_id)
                    .first()
                )
                if project_repo is None:
                    return Response(status=404)

                seer_project_repo, _ = (
                    SeerProjectRepository.objects.select_for_update().get_or_create(
                        project_repository=project_repo
                    )
                )
            else:
                seer_project_repo = (
                    _get_seat_based_billing_seer_project_repos(project)
                    .select_for_update()
                    .filter(project_repository__repository_id=repo_id)
                    .first()
                )
                if seer_project_repo is None:
                    return Response(status=404)
                project_repo = seer_project_repo.project_repository

            update_seer_project_repo(seer_project_repo, data)

        return Response(_serialize_project_repo(project_repo, seer_project_repo))

    def delete(self, request: Request, project: Project, repo_id: int) -> Response:
        if is_seer_token_based_billing_onboarding_enabled(project.organization):
            # Under token-based billing Seer uses every linked project repo,
            # so there's nothing to remove.
            return Response({"detail": "Repositories can't be removed from Seer."}, status=400)

        with transaction.atomic(router.db_for_write(SeerProjectRepository)):
            deleted_count, _ = (
                _get_seat_based_billing_seer_project_repos(project)
                .filter(project_repository__repository_id=repo_id)
                .delete()
            )

        if deleted_count == 0:
            return Response(status=404)

        return Response(status=204)


@cell_silo_endpoint
class ProjectSeerReposEndpoint(ProjectEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, project: Project) -> Response:
        queryset = (
            get_token_based_billing_project_repos(project.organization, [project.id])
            if is_seer_token_based_billing_onboarding_enabled(project.organization)
            else _get_seat_based_billing_project_repos(project)
        ).annotate(
            provider_normalized=Replace("repository__provider", Value("integrations:"), Value(""))
        )

        search_query = request.GET.get("query", "")
        if search_query:
            try:
                filters = parse_search_query(search_query)
                queryset = _apply_search_filters(queryset, filters)
            except (InvalidSearchQuery, ValueError):
                return Response({"detail": "Invalid search query"}, status=400)

        sort_by = request.GET.get("sortBy", "name")
        order_by = SORT_FIELDS_MAPPING.get(sort_by)
        if order_by is None:
            return Response({"detail": f"Invalid sortBy: {sort_by}"}, status=400)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=order_by,
            on_results=lambda results: [
                _serialize_project_repo(r, get_seer_project_repo(r)) for r in results
            ],
            paginator_cls=OffsetPaginator,
        )

    def post(self, request: Request, project: Project) -> Response:
        serializer = SeerProjectReposBulkSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        repos_data = serializer.validated_data["repos"]
        if not repos_data:
            return Response({"detail": "repos must not be empty."}, status=400)

        try:
            _validate_repo_ids(project, [d["repository_id"] for d in repos_data])
        except ValueError as e:
            return Response({"detail": f"Invalid repository IDs: {e.args[0]}"}, status=400)

        add_seer_project_repos(project, repos_data)

        return Response(status=204)

    def put(self, request: Request, project: Project) -> Response:
        serializer = SeerProjectReposBulkSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        repos_data = serializer.validated_data["repos"]

        if repos_data:
            try:
                _validate_repo_ids(project, [d["repository_id"] for d in repos_data])
            except ValueError as e:
                return Response({"detail": f"Invalid repository IDs: {e.args[0]}"}, status=400)

        replace_all_seer_project_repos(project, repos_data)

        return Response(status=204)
