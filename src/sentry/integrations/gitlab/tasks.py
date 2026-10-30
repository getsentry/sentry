from __future__ import annotations

import errno
import logging
from typing import Any
from uuid import uuid4

from redis.exceptions import RedisError
from rest_framework import status
from taskbroker_client.retry import Retry

from sentry import options
from sentry.constants import ObjectStatus
from sentry.integrations.gitlab.client import GitLabApiClient
from sentry.integrations.gitlab.metrics import (
    GitLabTaskEvent,
    GitLabTaskInteractionType,
    GitLabWebhookUpdateHaltReason,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.repository import repository_service
from sentry.locks import locks
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiForbiddenError,
    ApiPaginationTruncated,
    ApiUnauthorized,
    IntegrationConfigurationError,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_tasks
from sentry.utils import metrics
from sentry.utils.locking.lock import Lock
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


def _project_webhook_lock(repository_id: int) -> Lock:
    return locks.get(
        f"gitlab:project-webhook:{repository_id}",
        duration=150,
        name="gitlab_project_webhook",
    )


def _matching_project_webhooks(
    client: GitLabApiClient, project_id: int | str, reconciliation_id: str
) -> list[dict[str, Any]]:
    expected_url = client.project_webhook_url(reconciliation_id)
    hooks = [
        hook
        for hook in client.get_project_webhooks(project_id)
        if hook.get("url") == expected_url and isinstance(hook.get("id"), int | str)
    ]
    return sorted(hooks, key=lambda hook: int(hook["id"]))


def _discard_project_webhook(
    client: GitLabApiClient, project_id: int | str, hook_id: int | str
) -> None:
    try:
        client.delete_project_webhook(project_id, hook_id)
    except ApiError as e:
        if e.code != 404:
            logger.warning(
                "update-project-webhook.discard-failed",
                extra={"project_id": project_id, "webhook_id": hook_id, "status_code": e.code},
            )


@instrumented_task(
    name="sentry.tasks.integrations.gitlab.update_project_webhook",
    namespace=integrations_tasks,
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=120,
    retry=Retry(
        times=3,
        delay=60,
        on=(Exception,),
        ignore=(Integration.DoesNotExist, IntegrationConfigurationError),
    ),
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
        lifecycle.add_extras(
            {
                "integration_id": integration_id,
                "organization_id": organization_id,
                "repository_id": repository_id,
            }
        )

        outcome: str | None = None
        try:
            with _project_webhook_lock(repository_id).blocking_acquire(
                initial_delay=0.1, timeout=5
            ):
                repo = repository_service.get_repository(
                    organization_id=organization_id,
                    id=repository_id,
                )
                if not repo or repo.status != ObjectStatus.ACTIVE:
                    lifecycle.record_halt(
                        GitLabWebhookUpdateHaltReason.REPOSITORY_NOT_FOUND,
                    )
                    return
                if repo.integration_id != integration_id:
                    lifecycle.record_halt(GitLabWebhookUpdateHaltReason.REPOSITORY_CHANGED)
                    return

                webhook_id = repo.config.get("webhook_id")
                project_id = repo.config.get("project_id")
                reconciliation_id = repo.config.get("webhook_reconciliation_id")

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
                outcome = "failure"

                if webhook_id:
                    try:
                        hook = client.update_project_webhook(project_id, webhook_id)
                    except ApiError as e:
                        # An update may have applied despite an error. Only a 404 is safe
                        # to follow with a create without risking duplicate deliveries.
                        if e.code != 404:
                            raise
                    else:
                        if hook.get("alert_status") != "disabled":
                            outcome = "updated"
                            return

                        # PUT does not re-enable permanently disabled hooks. Temporarily
                        # disabled hooks recover after backoff; older GitLab omits this field.
                        # Do not use the test endpoint: it replays commits into Sentry.
                        try:
                            client.delete_project_webhook(project_id, webhook_id)
                        except ApiError as e:
                            if e.code != 404:
                                raise

                if not isinstance(reconciliation_id, str) or not reconciliation_id:
                    new_reconciliation_id = uuid4().hex
                    if not repository_service.update_repository_config(
                        organization_id=organization_id,
                        id=repository_id,
                        config_updates={"webhook_reconciliation_id": new_reconciliation_id},
                        expected_integration_id=integration_id,
                        expected_config={
                            "project_id": project_id,
                            "webhook_id": webhook_id,
                            "webhook_reconciliation_id": reconciliation_id,
                        },
                    ):
                        lifecycle.record_halt(GitLabWebhookUpdateHaltReason.REPOSITORY_CHANGED)
                        return
                    reconciliation_id = new_reconciliation_id
                else:
                    new_reconciliation_id = reconciliation_id

                matching_hooks = _matching_project_webhooks(
                    client, project_id, new_reconciliation_id
                )
                adoptable_hooks = [
                    hook for hook in matching_hooks if hook.get("alert_status") != "disabled"
                ]
                created_hook = not adoptable_hooks
                if adoptable_hooks:
                    hook_id = adoptable_hooks[0]["id"]
                    client.update_project_webhook(
                        project_id,
                        hook_id,
                        reconciliation_id=new_reconciliation_id,
                    )
                    outcome = "adopted"
                else:
                    hook_id = client.create_project_webhook(
                        project_id,
                        reconciliation_id=new_reconciliation_id,
                    )
                    outcome = "recreated" if webhook_id else "created"

                if not isinstance(hook_id, int | str):
                    raise TypeError("GitLab returned a project webhook without a valid ID")

                if not repository_service.update_repository_config(
                    organization_id=organization_id,
                    id=repository_id,
                    config_updates={"webhook_id": hook_id},
                    expected_integration_id=integration_id,
                    expected_config={
                        "project_id": project_id,
                        "webhook_id": webhook_id,
                        "webhook_reconciliation_id": new_reconciliation_id,
                    },
                ):
                    if created_hook:
                        _discard_project_webhook(client, project_id, hook_id)
                    lifecycle.add_extra("created_webhook_id", hook_id)
                    lifecycle.record_halt(GitLabWebhookUpdateHaltReason.REPOSITORY_CHANGED)
                    return
        except ApiPaginationTruncated as e:
            outcome = "pagination_truncated"
            lifecycle.add_extra("listed_webhook_count", len(e.partial_data))
            lifecycle.record_halt(e)
        except (ApiUnauthorized, ApiForbiddenError) as e:
            outcome = "forbidden" if e.code == 403 else "unauthorized"
            lifecycle.record_halt(e)
            # Don't retry if we've lost access
            return

        except ApiError as e:
            # Raise for retry on a small number of transient errors
            if e.code in GITLAB_RETRY_CODES:
                raise

            # Anything not in the retry list should be considered a hard-stop
            # failure.
            if e.code == 404:
                outcome = "not_found"
            lifecycle.record_failure(e)
        finally:
            if outcome is not None:
                metrics.incr("gitlab.project_webhook.reconcile", tags={"outcome": outcome})


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
