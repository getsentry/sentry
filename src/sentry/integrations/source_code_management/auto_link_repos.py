from __future__ import annotations

import logging
from collections.abc import Sequence

from django.db.models import Exists, OuterRef
from django.utils.text import slugify

from sentry import features, options
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.projectrepository import ProjectRepository, ProjectRepositorySource
from sentry.models.repository import Repository
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def get_repo_name_candidates(repo_name: str) -> list[str]:
    """
    Return a list of slug candidates to match against project slugs,
    in priority order.

    Splits the repo name on `/`, slugifies each part individually,
    then returns the last part (repo basename) first, followed by
    the full slugified path joined with hyphens.

    Examples:
        "getsentry/sentry"          -> ["sentry", "getsentry-sentry"]
        "getsentry / sentry"        -> ["sentry", "getsentry-sentry"]
        "My Project/My Repo"        -> ["my-repo", "my-project-my-repo"]
        "GetSentry/Sentry-Backend"  -> ["sentry-backend", "getsentry-sentry-backend"]
        "sentry-backend"            -> ["sentry-backend"]
    """
    parts = [slugify(part.strip()) for part in repo_name.split("/") if part.strip()]
    parts = [p for p in parts if p]
    if not parts:
        return []
    candidates = [parts[-1]]
    if len(parts) > 1:
        candidates.append("-".join(parts))
    return candidates


def auto_link_repos_by_name(
    organization: Organization | RpcOrganization,
    repo_ids: Sequence[int] | None = None,
    project_ids: Sequence[int] | None = None,
) -> int:
    """
    Auto-link repositories to projects by matching repo name suffix to project slug.

    For each given repo, attempt to match its name suffix to a project slug
    in the same organization and create a ProjectRepository link.

    Constraints:
    - The repo must not already be linked to any project.
    - The project must not already have any ProjectRepository link.
    - If repo_ids is provided, only consider those repos. Otherwise all unlinked
      repos in the org are considered.
    - If project_ids is provided, only consider those projects.

    Returns the number of links created
    """
    if not features.has("organizations:auto-link-repos-by-name", organization):
        return 0

    dry_run = options.get("repository.auto-link-by-name-dry-run")

    repo_qs = Repository.objects.filter(
        organization_id=organization.id,
        status=ObjectStatus.ACTIVE,
    ).exclude(Exists(ProjectRepository.objects.filter(repository_id=OuterRef("id"))))
    if repo_ids is not None:
        repo_qs = repo_qs.filter(id__in=repo_ids)

    project_qs = Project.objects.filter(
        organization_id=organization.id,
        status=ObjectStatus.ACTIVE,
    ).exclude(Exists(ProjectRepository.objects.filter(project_id=OuterRef("id"))))
    if project_ids is not None:
        project_qs = project_qs.filter(id__in=project_ids)

    unlinked_projects_by_slug: dict[str, tuple[int, str]] = {}
    for p_id, slug in project_qs.values_list("id", "slug"):
        unlinked_projects_by_slug[slug] = (p_id, slug)

    if not unlinked_projects_by_slug:
        return 0

    created = 0
    for repo in repo_qs:
        project_id: int | None = None
        project_slug: str | None = None
        for candidate in get_repo_name_candidates(repo.name):
            if candidate in unlinked_projects_by_slug:
                project_id, project_slug = unlinked_projects_by_slug.pop(candidate)
                break
        if project_id is None:
            continue

        if dry_run:
            logger.info(
                "auto_link_repos_by_name.dry_run_match",
                extra={
                    "organization_id": organization.id,
                    "repository_id": repo.id,
                    "repository_name": repo.name,
                    "project_id": project_id,
                    "project_slug": project_slug,
                },
            )
            metrics.incr("auto_link_repos_by_name.dry_run_match", sample_rate=1.0)
        else:
            _, was_created = ProjectRepository.objects.get_or_create(
                project_id=project_id,
                repository=repo,
                defaults={"source": ProjectRepositorySource.AUTO_NAME_MATCH},
            )
            if was_created:
                logger.info(
                    "auto_link_repos_by_name.linked",
                    extra={
                        "organization_id": organization.id,
                        "repository_id": repo.id,
                        "repository_name": repo.name,
                        "project_id": project_id,
                        "project_slug": project_slug,
                    },
                )
                metrics.incr("auto_link_repos_by_name.linked", sample_rate=1.0)
                created += 1

    return created


def auto_link_repos_on_project_create(project: Project, **kwargs: object) -> None:
    """
    Signal receiver for project_created. Tries to match all unlinked repos
    in the org to the newly created project by name.
    """
    auto_link_repos_by_name(project.organization, project_ids=[project.id])
