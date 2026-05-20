from __future__ import annotations

from collections.abc import Sequence
from functools import partial
from typing import TypedDict

from django.db import router, transaction
from django.db.models import Value
from django.db.models.functions import Replace
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.event_search import QueryToken, SearchConfig, SearchFilter
from sentry.api.event_search import parse_search_query as base_parse_search_query
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.constants import ObjectStatus
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.autofix.utils import (
    add_seer_project_repos,
    replace_all_seer_project_repos,
    update_seer_project_repo,
)
from sentry.seer.models.project_repository import SeerProjectRepository

SORT_FIELDS_MAPPING: dict[str, str] = {
    "name": "project_repository__repository__name",
    "-name": "-project_repository__repository__name",
    "provider": "provider_normalized",
    "-provider": "-provider_normalized",
}

search_config = SearchConfig.create_from(
    SearchConfig(), allowed_keys={"name", "provider"}, allow_boolean=False, free_text_key="name"
)
parse_search_query = partial(base_parse_search_query, config=search_config)


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


def _apply_search_filters(queryset, filters: Sequence[QueryToken]):
    for f in filters:
        if not isinstance(f, SearchFilter):
            continue

        key = f.key.name
        op = f.operator
        value = f.value.value

        if key == "name":
            if op not in ("=", "!=", "IN", "NOT IN"):
                raise InvalidSearchQuery(f"name does not support the {op} operator.")
            if op == "=":
                queryset = queryset.filter(project_repository__repository__name__icontains=value)
            elif op == "!=":
                queryset = queryset.exclude(project_repository__repository__name__icontains=value)
            elif op == "IN":
                queryset = queryset.filter(project_repository__repository__name__in=value)
            elif op == "NOT IN":
                queryset = queryset.exclude(project_repository__repository__name__in=value)

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


def _get_project_repos_queryset(project: Project):
    return (
        SeerProjectRepository.objects.filter(
            project_repository__project=project,
            project_repository__repository__status=ObjectStatus.ACTIVE,
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


class SeerProjectRepoSerializer(CamelSnakeSerializer):
    repository_id = serializers.IntegerField(required=True)
    branch_name = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    instructions = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    branch_overrides = BranchOverrideSerializer(
        many=True, required=False, default=list, allow_null=False
    )

    def validate_branch_overrides(self, value):
        return _validate_branch_overrides(value)


class SeerProjectReposBulkSerializer(CamelSnakeSerializer):
    repos = SeerProjectRepoSerializer(many=True, required=True, allow_empty=True)


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
            _get_project_repos_queryset(project)
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

        project_repo = update_seer_project_repo(project, repo_id, serializer.validated_data)
        if project_repo is None:
            return Response(status=404)

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
            ).delete()

        if deleted_count == 0:
            return Response(status=404)

        return Response(status=204)


@cell_silo_endpoint
class OrganizationSeerProjectReposEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (OrganizationPermission,)

    def get(self, request: Request, organization: Organization, project_id: int) -> Response:
        project = self.get_projects(request, organization, project_ids={int(project_id)})[0]

        queryset = _get_project_repos_queryset(project).annotate(
            # Strip the provider prefix if present, so we can order by it.
            provider_normalized=Replace(
                "project_repository__repository__provider", Value("integrations:"), Value("")
            )
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
            on_results=lambda results: [_serialize_project_repo(r) for r in results],
            paginator_cls=OffsetPaginator,
        )

    def post(self, request: Request, organization: Organization, project_id: int) -> Response:
        project = self.get_projects(request, organization, project_ids={int(project_id)})[0]

        serializer = SeerProjectReposBulkSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        repos_data = serializer.validated_data["repos"]
        if not repos_data:
            return Response({"detail": "repos must not be empty."}, status=400)

        try:
            add_seer_project_repos(project, organization, repos_data)
        except ValueError as e:
            return Response({"detail": f"Invalid repository IDs: {e.args[0]}"}, status=400)

        return Response(status=204)

    def put(self, request: Request, organization: Organization, project_id: int) -> Response:
        project = self.get_projects(request, organization, project_ids={int(project_id)})[0]

        serializer = SeerProjectReposBulkSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        repos_data = serializer.validated_data["repos"]

        try:
            replace_all_seer_project_repos(project, organization, repos_data)
        except ValueError as e:
            return Response({"detail": f"Invalid repository IDs: {e.args[0]}"}, status=400)

        return Response(status=204)
