from __future__ import annotations

import logging
from typing import Any

from sentry import features
from sentry.models.organization import Organization
from sentry.seer.models import SeerApiError
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.seer.signed_seer_api import (
    BulkRemoveRepositoriesRequest,
    RemoveRepositoryRequest,
    RepoIdentifier,
    SeerViewerContext,
    make_bulk_remove_repositories_request,
    make_remove_repository_request,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.seer.cleanup_seer_repository_preferences",
    namespace=seer_tasks,
    processing_deadline_duration=60 * 5,
    silo_mode=SiloMode.CELL,
)
def cleanup_seer_repository_preferences(
    organization_id: int,
    repo_external_id: str,
    repo_provider: str,
    repo_id: int | None = None,
    **kwargs: Any,
) -> None:
    """
    Remove a single repository from all its associated Seer project preferences.
    """
    body = RemoveRepositoryRequest(
        organization_id=organization_id,
        repo_provider=repo_provider,
        repo_external_id=repo_external_id,
    )

    viewer_context = SeerViewerContext(organization_id=organization_id)
    try:
        response = make_remove_repository_request(body, viewer_context=viewer_context)
        if response.status >= 400:
            raise SeerApiError("Seer request failed", response.status)
    except Exception:
        logger.exception(
            "cleanup_seer_repository_preferences.failed",
            extra={
                "organization_id": organization_id,
                "repo_external_id": repo_external_id,
                "repo_provider": repo_provider,
            },
        )
        raise

    if repo_id is not None:
        try:
            organization = Organization.objects.get_from_cache(id=organization_id)
            if features.has("organizations:seer-project-settings-dual-write", organization):
                SeerProjectRepository.objects.filter(
                    repository_id=repo_id, project__organization_id=organization_id
                ).delete()
        except Organization.DoesNotExist:
            pass

    logger.info(
        "cleanup_seer_repository_preferences.success",
        extra={
            "organization_id": organization_id,
            "repo_external_id": repo_external_id,
            "repo_provider": repo_provider,
        },
    )


@instrumented_task(
    name="sentry.tasks.seer.bulk_cleanup_seer_repository_preferences",
    namespace=seer_tasks,
    processing_deadline_duration=60 * 10,
    silo_mode=SiloMode.CELL,
)
def bulk_cleanup_seer_repository_preferences(
    organization_id: int,
    repos: list[dict[str, int | str]],
    **kwargs: Any,
) -> None:
    """
    Remove multiple repositories from their associated Seer project preferences.

    Each repo is a dict with keys `repo_external_id` and `repo_provider`, and
    optionally `repo_id` (used to clean up local SeerProjectRepository rows).
    """
    body = BulkRemoveRepositoriesRequest(
        organization_id=organization_id,
        repositories=[
            RepoIdentifier(
                repo_provider=str(repo["repo_provider"]),
                repo_external_id=str(repo["repo_external_id"]),
            )
            for repo in repos
        ],
    )

    viewer_context = SeerViewerContext(organization_id=organization_id)
    try:
        response = make_bulk_remove_repositories_request(body, viewer_context=viewer_context)
        if response.status >= 400:
            raise SeerApiError("Seer request failed", response.status)
    except Exception:
        logger.exception(
            "bulk_cleanup_seer_repository_preferences.failed",
            extra={
                "organization_id": organization_id,
                "repo_count": len(repos),
            },
        )
        raise

    repo_ids = [repo["repo_id"] for repo in repos if "repo_id" in repo]
    if repo_ids:
        try:
            organization = Organization.objects.get_from_cache(id=organization_id)
            if features.has("organizations:seer-project-settings-dual-write", organization):
                SeerProjectRepository.objects.filter(
                    repository_id__in=repo_ids, project__organization_id=organization_id
                ).delete()
        except Organization.DoesNotExist:
            pass

    logger.info(
        "bulk_cleanup_seer_repository_preferences.success",
        extra={
            "organization_id": organization_id,
            "repo_count": len(repos),
        },
    )
