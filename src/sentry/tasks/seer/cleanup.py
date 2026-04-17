from __future__ import annotations

import logging

from sentry import features
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.autofix.utils import bulk_read_preferences, bulk_set_project_preferences
from sentry.seer.models import SeerApiError, SeerApiResponseValidationError
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
    organization_id: int, repo_external_id: str, repo_provider: str
) -> None:
    """
    Clean up Seer preferences for a deleted repository.

    This task removes a repository from Seer project preferences when the repository
    is deleted from an organization's integration.
    """
    # Call Seer API to remove repository from project preferences
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
        logger.info(
            "cleanup_seer_repository_preferences.success",
            extra={
                "organization_id": organization_id,
                "repo_external_id": repo_external_id,
                "repo_provider": repo_provider,
            },
        )
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


@instrumented_task(
    name="sentry.tasks.seer.bulk_cleanup_seer_repository_preferences",
    namespace=seer_tasks,
    processing_deadline_duration=60 * 10,
    silo_mode=SiloMode.CELL,
)
def bulk_cleanup_seer_repository_preferences(
    organization_id: int, repos: list[dict[str, str]]
) -> None:
    """
    Removes multiple repositories from Seer project preferences when the repository
    is deleted from an organization's integration.
    """
    body = BulkRemoveRepositoriesRequest(
        organization_id=organization_id,
        repositories=[
            RepoIdentifier(
                repo_provider=repo["repo_provider"],
                repo_external_id=repo["repo_external_id"],
            )
            for repo in repos
        ],
    )

    viewer_context = SeerViewerContext(organization_id=organization_id)
    try:
        response = make_bulk_remove_repositories_request(body, viewer_context=viewer_context)
        if response.status >= 400:
            raise SeerApiError("Seer request failed", response.status)
        logger.info(
            "bulk_cleanup_seer_repository_preferences.success",
            extra={
                "organization_id": organization_id,
                "repo_count": len(repos),
            },
        )
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


@instrumented_task(
    name="sentry.tasks.seer.cleanup_seer_automation_handoff_for_integration",
    namespace=seer_tasks,
    processing_deadline_duration=60 * 10,
    silo_mode=SiloMode.CELL,
)
def cleanup_seer_automation_handoff_for_integration(
    organization_id: int, integration_id: int
) -> None:
    """
    Clear automation_handoff from all project preferences in an organization that
    reference the given integration.

    Dispatched when an OrganizationIntegration is deleted so handoff references
    don't dangle in project options or Seer's preference DB.
    """
    try:
        organization = Organization.objects.get_from_cache(id=organization_id)
    except Organization.DoesNotExist:
        return

    if features.has("organizations:seer-project-settings-read-from-sentry", organization):
        project_handoff_integration_ids = ProjectOption.objects.filter(
            project__organization_id=organization.id,
            key="sentry:seer_automation_handoff_integration_id",
        ).values_list("project_id", "value")
        # Only get project ids that have a preference with a matching handoff integration id.
        candidate_project_ids = [
            project_id
            for project_id, handoff_integration_id in project_handoff_integration_ids
            if handoff_integration_id == integration_id
        ]
    else:
        candidate_project_ids = list(
            Project.objects.filter(organization_id=organization.id).values_list("id", flat=True)
        )

    try:
        preferences_by_project_id = bulk_read_preferences(organization, candidate_project_ids)
    except (SeerApiError, SeerApiResponseValidationError):
        logger.exception(
            "cleanup_seer_automation_handoff_for_integration.failed",
            extra={"organization_id": organization_id, "integration_id": integration_id},
        )
        raise

    # Filter out non-affected projects in case we read all project ids
    # (ie, organizations:seer-project-settings-read-from-sentry is off).
    affected_preferences = [
        preference
        for preference in preferences_by_project_id.values()
        if preference is not None
        and preference.automation_handoff is not None
        and preference.automation_handoff.integration_id == integration_id
    ]
    if not affected_preferences:
        return

    updated_preferences = [
        preference.copy(update={"automation_handoff": None}).dict()
        for preference in affected_preferences
    ]

    try:
        bulk_set_project_preferences(organization_id, updated_preferences)
    except (SeerApiError, SeerApiResponseValidationError):
        logger.exception(
            "cleanup_seer_automation_handoff_for_integration.failed",
            extra={"organization_id": organization_id, "integration_id": integration_id},
        )
        raise

    if features.has("organizations:seer-project-settings-dual-write", organization):
        ProjectOption.objects.filter(
            project_id__in=[preference.project_id for preference in affected_preferences],
            key__in={
                "sentry:seer_automation_handoff_integration_id",
                "sentry:seer_automation_handoff_point",
                "sentry:seer_automation_handoff_target",
                "sentry:seer_automation_handoff_auto_create_pr",
            },
        ).delete()

    logger.info(
        "cleanup_seer_automation_handoff_for_integration.success",
        extra={
            "organization_id": organization_id,
            "integration_id": integration_id,
            "preferences_count": len(affected_preferences),
        },
    )
