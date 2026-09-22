from __future__ import annotations

import errno
import logging
from uuid import uuid4

from redis.exceptions import RedisError
from rest_framework import status
from taskbroker_client.retry import Retry

from sentry import options
from sentry.constants import ObjectStatus
from sentry.integrations.gitlab.metrics import (
    GitLabTaskEvent,
    GitLabTaskInteractionType,
    GitLabWebhookUpdateHaltReason,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.repository import repository_service
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiForbiddenError,
    ApiUnauthorized,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_tasks
from sentry.utils.redis import load_redis_script, redis_clusters

logger = logging.getLogger(__name__)
release_debounce = load_redis_script("utils/locking/delete_lock.lua")

GITLAB_RETRY_CODES = (
    status.HTTP_429_TOO_MANY_REQUESTS,
    status.HTTP_500_INTERNAL_SERVER_ERROR,
    status.HTTP_502_BAD_GATEWAY,
    status.HTTP_503_SERVICE_UNAVAILABLE,
    status.HTTP_504_GATEWAY_TIMEOUT,
    errno.ECONNRESET,
)


@instrumented_task(
    name="sentry.tasks.integrations.gitlab.update_project_webhook",
    namespace=integrations_tasks,
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=60,
    retry=Retry(times=3, delay=60, on=(Exception,), ignore=(Integration.DoesNotExist,)),
)
def update_project_webhook(integration_id: int, organization_id: int, repository_id: int) -> None:
    """
    Update a single project webhook for a GitLab integration.
    This task is spawned by update_all_project_webhooks for each repository.
    """
    integration = integration_service.get_integration(
        integration_id=integration_id,
        status=ObjectStatus.ACTIVE,
        using_replica=options.get("integration_service.get_integration.using_replica"),
    )
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

        lifecycle.add_extras(
            {
                "integration_id": integration_id,
                "organization_id": organization_id,
                "repository_id": repository_id,
            }
        )

        if not repo or repo.status != ObjectStatus.ACTIVE:
            lifecycle.record_halt(
                GitLabWebhookUpdateHaltReason.REPOSITORY_NOT_FOUND,
            )
            return

        webhook_id = repo.config.get("webhook_id")
        project_id = repo.config.get("project_id")

        lifecycle.add_extras(
            {
                "repository_id": repo.id,
                "webhook_id": webhook_id,
                "project_id": project_id,
            }
        )

        if not project_id:
            lifecycle.record_halt(
                GitLabWebhookUpdateHaltReason.MISSING_WEBHOOK_CONFIG,
            )
            return

        installation = integration.get_installation(organization_id=organization_id)
        client = installation.get_client()

        try:
            hook_id = client.ensure_project_webhook(project_id, webhook_id)
            if hook_id != webhook_id:
                repo.config["webhook_id"] = hook_id
                repository_service.update_repository(organization_id=organization_id, update=repo)
        except (ApiUnauthorized, ApiForbiddenError) as e:
            lifecycle.record_halt(e)
            # Don't retry if we've lost access
            return

        except ApiError as e:
            # Raise for retry on a small number of transient errors
            if e.code in GITLAB_RETRY_CODES:
                raise

            # Anything not in the retry list should be considered a hard-stop
            # failure.
            lifecycle.record_failure(e)


@instrumented_task(
    name="sentry.tasks.integrations.gitlab.update_all_project_webhooks",
    namespace=integrations_tasks,
    silo_mode=SiloMode.CELL,
    retry=Retry(times=3, delay=60, on=(Exception,), ignore=(Integration.DoesNotExist,)),
)
def update_all_project_webhooks(
    integration_id: int, organization_id: int, force: bool = False
) -> None:
    """
    Spawn individual tasks to update all project webhooks for a GitLab integration.
    Triggered after installation or sync settings changes to refresh tokens and event subscriptions.
    """
    integration = integration_service.get_integration(
        integration_id=integration_id,
        status=ObjectStatus.ACTIVE,
        using_replica=options.get("integration_service.get_integration.using_replica"),
    )
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

        # Settings auto-save each field separately. Coalesce those refreshes, while
        # allowing installs to repair hooks even after a recent settings save.
        debounce_key = f"gitlab:webhook-reconcile:{organization_id}:{integration_id}"
        debounce_token = uuid4().hex
        acquired = False
        try:
            redis = redis_clusters.get("default")
            acquired = bool(redis.set(debounce_key, debounce_token, nx=True, ex=600))
        except RedisError:
            # Debounce is best-effort: a Redis outage must not block webhook repair.
            logger.exception(
                "update-all-project-webhooks.debounce-unavailable",
                extra={"integration_id": integration_id, "organization_id": organization_id},
            )
        else:
            if not acquired and not force:
                logger.info(
                    "update-all-project-webhooks.debounced",
                    extra={"integration_id": integration_id, "organization_id": organization_id},
                )
                lifecycle.record_halt(GitLabWebhookUpdateHaltReason.DEBOUNCED)
                return

        try:
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
            for repo in repositories:
                update_project_webhook.delay(integration_id, organization_id, repo.id)
        except Exception:
            # Allow retry after a failed lookup or fan-out. If our TTL expired,
            # leave any subsequent run's debounce key intact.
            if acquired:
                try:
                    release_debounce((debounce_key,), (debounce_token,), redis)
                except RedisError:
                    # Expired ownership or a Redis outage must not hide the task's failure.
                    logger.exception(
                        "update-all-project-webhooks.debounce-release-failed",
                        extra={
                            "integration_id": integration_id,
                            "organization_id": organization_id,
                        },
                    )
            raise

        logger.info(
            "update-all-project-webhooks.tasks-spawned",
            extra={
                "integration_id": integration_id,
                "organization_id": organization_id,
                "total_repositories": len(repositories),
                "repository_ids": [repo.id for repo in repositories],
            },
        )
