from __future__ import annotations

import logging

from sentry.constants import ObjectStatus
from sentry.integrations.gitlab.metrics import (
    GitLabTaskEvent,
    GitLabTaskInteractionType,
    GitLabWebhookUpdateHaltReason,
)
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.repository import repository_service
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_tasks

logger = logging.getLogger("sentry.tasks.integrations.gitlab")


@instrumented_task(
    name="sentry.tasks.integrations.gitlab.update_project_webhook",
    namespace=integrations_tasks,
    silo_mode=SiloMode.CONTROL,
    max_retries=3,
    default_retry_delay=60,
)
def update_project_webhook(integration_id: int, organization_id: int, repository_id: int) -> None:
    """
    Update a single project webhook for a GitLab integration.
    This task is spawned by update_all_project_webhooks for each repository.
    """
    integration = integration_service.get_integration(integration_id=integration_id)
    if not integration:
        logger.warning(
            "update-project-webhook.integration-not-found",
            extra={
                "integration_id": integration_id,
                "organization_id": organization_id,
                "repository_id": repository_id,
            },
        )
        return

    with GitLabTaskEvent(
        interaction_type=GitLabTaskInteractionType.UPDATE_PROJECT_WEBHOOK,
        integration=integration,
    ).capture() as lifecycle:

        repo = repository_service.get_repository(
            organization_id=organization_id,
            id=repository_id,
        )
        if not repo:
            lifecycle.record_halt(
                GitLabWebhookUpdateHaltReason.REPOSITORY_NOT_FOUND,
                extra={
                    "integration_id": integration_id,
                    "organization_id": organization_id,
                    "repository_id": repository_id,
                },
            )
            return

        lifecycle.add_extra("repository_id", repository_id)

        webhook_id = repo.config.get("webhook_id")
        project_id = repo.config.get("project_id")

        if not webhook_id or not project_id:
            lifecycle.record_halt(
                GitLabWebhookUpdateHaltReason.MISSING_WEBHOOK_CONFIG,
                extra={
                    "repository_id": repo.id,
                    "repository_name": repo.name,
                    "has_webhook_id": bool(webhook_id),
                    "has_project_id": bool(project_id),
                },
            )
            return

        installation = integration.get_installation(organization_id=organization_id)
        client = installation.get_client()

        client.update_project_webhook(project_id, webhook_id)
        logger.info(
            "update-project-webhook.webhook-updated",
            extra={
                "repository_id": repo.id,
                "repository_name": repo.name,
                "project_id": project_id,
                "webhook_id": webhook_id,
            },
        )


@instrumented_task(
    name="sentry.tasks.integrations.gitlab.update_all_project_webhooks",
    namespace=integrations_tasks,
    silo_mode=SiloMode.CONTROL,
)
def update_all_project_webhooks(integration_id: int, organization_id: int) -> None:
    """
    Spawn individual tasks to update all project webhooks for a GitLab integration.
    This is triggered when sync settings are changed to ensure all webhooks have the correct permissions.
    """

    integration = integration_service.get_integration(integration_id=integration_id)
    if not integration:
        logger.warning(
            "update-all-project-webhooks.integration-not-found",
            extra={"integration_id": integration_id, "organization_id": organization_id},
        )
        return

    with GitLabTaskEvent(
        interaction_type=GitLabTaskInteractionType.UPDATE_ALL_PROJECT_WEBHOOKS,
        integration=integration,
    ).capture() as lifecycle:
        # Get all active repositories linked to this integration
        repositories = repository_service.get_repositories(
            integration_id=integration_id,
            organization_id=organization_id,
            status=ObjectStatus.ACTIVE,
        )

        if not repositories:
            logger.info(
                "update-all-project-webhooks.no-repositories",
                extra={"integration_id": integration_id, "organization_id": organization_id},
            )
            lifecycle.record_halt(GitLabWebhookUpdateHaltReason.NO_REPOSITORIES)
            return

        lifecycle.add_extra("total_repositories", len(repositories))

        # Verify org integration exists before spawning tasks
        org_integration = integration_service.get_organization_integration(
            integration_id=integration_id, organization_id=organization_id
        )
        if not org_integration:
            logger.warning(
                "update-all-project-webhooks.org-integration-not-found",
                extra={"integration_id": integration_id, "organization_id": organization_id},
            )
            lifecycle.record_halt(GitLabWebhookUpdateHaltReason.ORG_INTEGRATION_NOT_FOUND)
            return

        # Spawn individual tasks for each repository webhook update
        for repo in repositories:
            update_project_webhook.delay(integration_id, organization_id, repo.id)

        logger.info(
            "update-all-project-webhooks.tasks-spawned",
            extra={
                "integration_id": integration_id,
                "organization_id": organization_id,
                "total_repositories": len(repositories),
                "repository_ids": [repo.id for repo in repositories],
            },
        )
