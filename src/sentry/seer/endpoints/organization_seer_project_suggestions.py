from __future__ import annotations

from collections import defaultdict
from functools import partial
from typing import TypedDict

from django.db.models import Count, F, Q, Window
from django.db.models.functions import RowNumber
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.projectrepository import ProjectRepository, ProjectRepositorySource
from sentry.seer.seer_setup import get_supported_scm_providers

MAX_REPOSITORIES_PER_PROJECT = 10
SUGGESTIONS_PER_PAGE = 10
ELIGIBLE_REPOSITORY_SOURCES = (
    ProjectRepositorySource.MANUAL,
    ProjectRepositorySource.SCM_ONBOARDING,
)


class SuggestedRepositoryResponse(TypedDict):
    repositoryId: str
    name: str
    provider: str


class SeerProjectSuggestionResponse(TypedDict):
    projectId: str
    projectSlug: str
    linkedReposCount: int
    linkedRepositories: list[SuggestedRepositoryResponse]


def _eligible_repository_filters(
    *, relationship_prefix: str, organization_id: int, supported_providers: list[str]
) -> dict[str, object]:
    return {
        f"{relationship_prefix}repository__organization_id": organization_id,
        f"{relationship_prefix}repository__status": ObjectStatus.ACTIVE,
        f"{relationship_prefix}repository__provider__in": supported_providers,
        f"{relationship_prefix}source__in": ELIGIBLE_REPOSITORY_SOURCES,
    }


def _serialize_suggestions(
    projects: list[Project], *, organization_id: int, supported_providers: list[str]
) -> list[SeerProjectSuggestionResponse]:
    project_ids = [project.id for project in projects]
    repositories_by_project_id: defaultdict[int, list[SuggestedRepositoryResponse]] = defaultdict(
        list
    )

    if project_ids:
        project_repositories = (
            ProjectRepository.objects.filter(
                project_id__in=project_ids,
                **_eligible_repository_filters(
                    relationship_prefix="",
                    organization_id=organization_id,
                    supported_providers=supported_providers,
                ),
            )
            .select_related("repository")
            .annotate(
                repository_row=Window(
                    expression=RowNumber(),
                    partition_by=[F("project_id")],
                    order_by=[F("repository_id").asc()],
                )
            )
            .filter(repository_row__lte=MAX_REPOSITORIES_PER_PROJECT)
            .order_by("project_id", "repository_id")
        )

        for project_repository in project_repositories:
            provider = project_repository.repository.provider
            if provider is None:
                continue
            repositories_by_project_id[project_repository.project_id].append(
                SuggestedRepositoryResponse(
                    repositoryId=str(project_repository.repository_id),
                    name=project_repository.repository.name,
                    provider=provider,
                )
            )

    return [
        SeerProjectSuggestionResponse(
            projectId=str(project.id),
            projectSlug=project.slug,
            linkedReposCount=int(getattr(project, "linked_repos_count")),
            linkedRepositories=repositories_by_project_id[project.id],
        )
        for project in projects
    ]


@cell_silo_endpoint
class OrganizationSeerProjectSuggestionsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (OrganizationPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has(
            "organizations:seer-autofix-quick-add",
            organization,
            actor=request.user,
        ):
            raise NotFound

        accessible_projects = self.get_projects(request, organization, include_all_accessible=True)
        supported_providers = get_supported_scm_providers(organization)
        eligible_repository_filter = Q(
            **_eligible_repository_filters(
                relationship_prefix="projectrepository__",
                organization_id=organization.id,
                supported_providers=supported_providers,
            )
        )

        queryset = (
            Project.objects.filter(id__in={project.id for project in accessible_projects})
            .annotate(
                linked_repos_count=Count(
                    "projectrepository",
                    filter=eligible_repository_filter,
                ),
                seer_repos_count=Count(
                    "projectrepository__seerprojectrepository",
                    filter=Q(projectrepository__repository__status=ObjectStatus.ACTIVE),
                ),
            )
            .filter(linked_repos_count__gt=0, seer_repos_count=0)
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="slug",
            on_results=partial(
                _serialize_suggestions,
                organization_id=organization.id,
                supported_providers=supported_providers,
            ),
            paginator_cls=OffsetPaginator,
            default_per_page=SUGGESTIONS_PER_PAGE,
            max_per_page=SUGGESTIONS_PER_PAGE,
        )
