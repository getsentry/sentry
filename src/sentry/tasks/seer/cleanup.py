from __future__ import annotations

import logging

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
    organization_id: int, repo_id: int, repo_external_id: str, repo_provider: str
) -> None:
    """
    Clean up Seer preferences for a hidden repository.
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
    except Exception as e:
        logger.exception(
            "cleanup_seer_repository_preferences.failed",
            extra={
                "organization_id": organization_id,
                "repo_external_id": repo_external_id,
                "repo_provider": repo_provider,
                "error": str(e),
            },
        )
        raise

    try:
        organization = Organization.objects.get_from_cache(id=organization_id)
        if features.has("organizations:seer-project-settings-dual-write", organization):
            SeerProjectRepository.objects.filter(repository_id=repo_id).delete()
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
    repos: list[list],
) -> None:
    """
    Removes multiple repositories from Seer project preferences when the repository
    is deleted from an organization's integration.

    Each repo is a (repo_id, external_id, provider) tuple from Repository.values_list().
    """
    repos_to_clean = [
        RepoIdentifier(repo_provider=provider, repo_external_id=ext_id)
        for _, ext_id, provider in repos
        if ext_id and provider
    ]
    if repos_to_clean:
        body = BulkRemoveRepositoriesRequest(
            organization_id=organization_id, repositories=repos_to_clean
        )
        viewer_context = SeerViewerContext(organization_id=organization_id)
        try:
            response = make_bulk_remove_repositories_request(body, viewer_context=viewer_context)
            if response.status >= 400:
                raise SeerApiError("Seer request failed", response.status)
        except Exception as e:
            logger.exception(
                "bulk_cleanup_seer_repository_preferences.failed",
                extra={
                    "organization_id": organization_id,
                    "repo_count": len(repos),
                    "error": str(e),
                },
            )
            raise

    try:
        organization = Organization.objects.get_from_cache(id=organization_id)
        if features.has("organizations:seer-project-settings-dual-write", organization):
            SeerProjectRepository.objects.filter(
                repository_id__in=[repo_id for repo_id, _, _ in repos]
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
