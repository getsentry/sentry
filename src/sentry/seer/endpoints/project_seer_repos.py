from __future__ import annotations

from collections.abc import Sequence
from functools import partial
from typing import TypedDict

from django.db import router, transaction
from django.db.models import Value
from django.db.models.functions import Replace
from drf_spectacular.utils import OpenApiParameter, extend_schema
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
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams
from sentry.apidocs.response_types import (
    DetailResponse,
    ValidationErrorResponse,
    as_validation_errors,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.exceptions import InvalidSearchQuery
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.seer.autofix.utils import (
    add_seer_project_repos,
    replace_all_seer_project_repos,
)
from sentry.seer.models.project_repository import (
    SeerProjectRepository,
    SeerProjectRepositoryBranchOverride,
)
from sentry.seer.seer_setup import get_supported_scm_providers

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


def _serialize_project_repo(project_repo: SeerProjectRepository) -> ProjectRepoResponse:
    repo = project_repo.project_repository.repository
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
        branchName=project_repo.branch_name,
        branchOverrides=[
            BranchOverrideResponse(
                id=str(bo.id),
                tagName=bo.tag_name,
                tagValue=bo.tag_value,
                branchName=bo.branch_name,
            )
            for bo in project_repo.branch_overrides.all()
        ],
        instructions=project_repo.instructions,
    )


def _valid_project_repos_queryset(project: Project):
    return SeerProjectRepository.objects.filter(
        project_repository__project=project,
        project_repository__repository__status=ObjectStatus.ACTIVE,
        project_repository__repository__provider__in=get_supported_scm_providers(
            project.organization
        ),
    ).select_related("project_repository", "project_repository__repository")


def _validate_repo_ids(project: Project, repo_ids: list[int]) -> None:
    """Raise ValueError if any repo IDs are invalid, inactive, or have providers not supported by Seer."""
    organization = project.organization
    valid_ids = set(
        Repository.objects.filter(
            id__in=repo_ids,
            organization_id=organization.id,
            status=ObjectStatus.ACTIVE,
            provider__in=get_supported_scm_providers(organization),
        ).values_list("id", flat=True)
    )
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
                queryset = queryset.filter(project_repository__repository__name__icontains=value)
            elif op == "!=":
                queryset = queryset.exclude(project_repository__repository__name__icontains=value)

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
    tag_name = serializers.CharField(
        required=True, help_text="The tag name that selects this branch override."
    )
    tag_value = serializers.CharField(
        required=True, help_text="The tag value that selects this branch override."
    )
    branch_name = serializers.CharField(
        required=True, help_text="The repository branch to use when the tag matches."
    )


class SeerProjectRepoUpdateSerializer(CamelSnakeSerializer):
    branch_name = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Override the default branch for this repository.",
    )
    instructions = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Instructions Seer should follow when working with this repository.",
    )
    branch_overrides = BranchOverrideSerializer(
        many=True,
        required=False,
        allow_null=False,
        help_text="Branch overrides selected by matching tags.",
    )

    def validate_branch_overrides(self, value):
        return _validate_branch_overrides(value)

    def validate(self, data):
        if not data:
            raise serializers.ValidationError("At least one field must be provided.")
        return data


class SeerProjectRepoCreateSerializer(CamelSnakeSerializer):
    repository_id = serializers.IntegerField(
        required=True, help_text="The ID of an active, supported repository in the organization."
    )
    branch_name = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Override the default branch for this repository.",
    )
    instructions = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Instructions Seer should follow when working with this repository.",
    )
    branch_overrides = BranchOverrideSerializer(
        many=True,
        required=False,
        allow_null=False,
        help_text="Branch overrides selected by matching tags.",
    )

    def validate_branch_overrides(self, value):
        return _validate_branch_overrides(value)


class SeerProjectReposBulkSerializer(CamelSnakeSerializer):
    repos = SeerProjectRepoCreateSerializer(
        many=True, required=True, allow_empty=True, help_text="Repository settings to apply."
    )

    def validate_repos(self, value):
        repo_ids = [r["repository_id"] for r in value]
        if len(repo_ids) != len(set(repo_ids)):
            raise serializers.ValidationError("Duplicate repository IDs are not allowed.")
        return value


class BranchOverrideRequestSerializer(serializers.Serializer):
    tagName = serializers.CharField(
        required=True, help_text="The tag name that selects this branch override."
    )
    tagValue = serializers.CharField(
        required=True, help_text="The tag value that selects this branch override."
    )
    branchName = serializers.CharField(
        required=True, help_text="The repository branch to use when the tag matches."
    )


class SeerProjectRepoRequestSerializer(serializers.Serializer):
    repositoryId = serializers.IntegerField(
        required=True, help_text="The ID of an active, supported repository in the organization."
    )
    branchName = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Override the default branch for this repository.",
    )
    instructions = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Instructions Seer should follow when working with this repository.",
    )
    branchOverrides = BranchOverrideRequestSerializer(
        many=True,
        required=False,
        allow_null=False,
        help_text="Branch overrides selected by matching tags.",
    )


class SeerProjectReposRequestSerializer(serializers.Serializer):
    repos = SeerProjectRepoRequestSerializer(
        many=True, required=True, allow_empty=True, help_text="Repository settings to apply."
    )


@cell_silo_endpoint
class ProjectSeerRepoEndpoint(ProjectEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, project: Project, repo_id: int) -> Response:
        project_repo = (
            _valid_project_repos_queryset(project)
            .prefetch_related("branch_overrides")
            .filter(project_repository__repository_id=repo_id)
            .first()
        )
        if project_repo is None:
            return Response(status=404)

        return Response(_serialize_project_repo(project_repo))

    def put(self, request: Request, project: Project, repo_id: int) -> Response:
        serializer = SeerProjectRepoUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

        with transaction.atomic(router.db_for_write(SeerProjectRepository)):
            project_repo = (
                _valid_project_repos_queryset(project)
                .select_for_update()
                .filter(project_repository__repository_id=repo_id)
                .first()
            )
            if project_repo is None:
                return Response(status=404)

            if "branch_name" in data:
                project_repo.branch_name = data["branch_name"]
            if "instructions" in data:
                project_repo.instructions = data["instructions"]
            if "branch_name" in data or "instructions" in data:
                project_repo.save()

            if "branch_overrides" in data:
                SeerProjectRepositoryBranchOverride.objects.filter(
                    seer_project_repository=project_repo
                ).delete()
                if data["branch_overrides"]:
                    SeerProjectRepositoryBranchOverride.objects.bulk_create(
                        [
                            SeerProjectRepositoryBranchOverride(
                                seer_project_repository=project_repo,
                                tag_name=override["tag_name"],
                                tag_value=override["tag_value"],
                                branch_name=override["branch_name"],
                            )
                            for override in data["branch_overrides"]
                        ],
                        update_conflicts=True,
                        update_fields=["branch_name", "date_updated"],
                        unique_fields=["seer_project_repository", "tag_name", "tag_value"],
                    )

        return Response(_serialize_project_repo(project_repo))

    def delete(self, request: Request, project: Project, repo_id: int) -> Response:
        with transaction.atomic(router.db_for_write(SeerProjectRepository)):
            deleted_count, _ = (
                _valid_project_repos_queryset(project)
                .filter(project_repository__repository_id=repo_id)
                .delete()
            )

        if deleted_count == 0:
            return Response(status=404)

        return Response(status=204)


@extend_schema(tags=["Projects"])
@cell_silo_endpoint
class ProjectSeerReposEndpoint(ProjectEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="listProjectSeerRepositories",
        summary="List Repositories Configured for Seer",
        description="List repositories connected to Seer for the project.",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            OpenApiParameter(
                "query",
                type=str,
                description=(
                    "Filter repositories using Seer search syntax. `name` supports substring "
                    "matching and is also the free-text key. `provider` supports `=`, `!=`, `IN`, "
                    "and `NOT IN` operators."
                ),
            ),
            OpenApiParameter(
                "sortBy",
                type=str,
                enum=["name", "-name", "provider", "-provider"],
                description="Sort by repository name or provider. Defaults to `name`.",
            ),
            CursorQueryParam,
            OpenApiParameter(
                "per_page", type=int, description="The maximum number of results per page."
            ),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ProjectSeerRepositoriesResponse", list[ProjectRepoResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, project: Project
    ) -> Response[list[ProjectRepoResponse]] | Response[DetailResponse]:
        queryset = (
            _valid_project_repos_queryset(project)
            .prefetch_related("branch_overrides")
            .annotate(
                provider_normalized=Replace(
                    "project_repository__repository__provider", Value("integrations:"), Value("")
                )
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

    @extend_schema(
        operation_id="addProjectSeerRepositories",
        summary="Add Repositories to Seer for a Project",
        description=(
            "Add the specified repositories to Seer without removing other repositories. "
            "At least one repository is required. Re-submitting a repository replaces its "
            "branchName, instructions, and branchOverrides; omitted values are cleared."
        ),
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.PROJECT_ID_OR_SLUG],
        request=SeerProjectReposRequestSerializer,
        responses={
            204: RESPONSE_NO_CONTENT,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(
        self, request: Request, project: Project
    ) -> Response[None] | Response[DetailResponse] | Response[ValidationErrorResponse]:
        serializer = SeerProjectReposBulkSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(as_validation_errors(serializer), status=400)

        repos_data = serializer.validated_data["repos"]
        if not repos_data:
            return Response({"detail": "repos must not be empty."}, status=400)

        try:
            _validate_repo_ids(project, [d["repository_id"] for d in repos_data])
        except ValueError as e:
            return Response({"detail": f"Invalid repository IDs: {e.args[0]}"}, status=400)

        add_seer_project_repos(project, repos_data)

        return Response(status=204)

    @extend_schema(
        operation_id="replaceProjectSeerRepositories",
        summary="Replace Repositories Configured for Seer",
        description=(
            "Replace the project's Seer repository list with the submitted repositories. "
            "An empty `repos` list removes every Seer repository from the project."
        ),
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.PROJECT_ID_OR_SLUG],
        request=SeerProjectReposRequestSerializer,
        responses={
            204: RESPONSE_NO_CONTENT,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(
        self, request: Request, project: Project
    ) -> Response[None] | Response[DetailResponse] | Response[ValidationErrorResponse]:
        serializer = SeerProjectReposBulkSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(as_validation_errors(serializer), status=400)

        repos_data = serializer.validated_data["repos"]

        if repos_data:
            try:
                _validate_repo_ids(project, [d["repository_id"] for d in repos_data])
            except ValueError as e:
                return Response({"detail": f"Invalid repository IDs: {e.args[0]}"}, status=400)

        replace_all_seer_project_repos(project, repos_data)

        return Response(status=204)
