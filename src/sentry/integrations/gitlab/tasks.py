from __future__ import annotations

import errno
import logging
from math import ceil
from random import randint
from time import time
from typing import Any
from urllib.parse import urlsplit
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
from sentry.ratelimits.leaky_bucket import LeakyBucketLimitInfo, LeakyBucketRateLimiter
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiForbiddenError,
    ApiPaginationTruncated,
    ApiRateLimitedError,
    ApiUnauthorized,
    IntegrationConfigurationError,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_tasks
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.locking.lock import Lock
from sentry.utils.redis import load_redis_script, redis_clusters

logger = logging.getLogger(__name__)
release_debounce = load_redis_script("utils/locking/delete_lock.lua")

MAX_RATE_LIMIT_DEFERRALS = 1000
# The limiter is region-local. These caps keep two active regions at a combined
# best-effort ceiling of 20 burst and 4 tokens per second per GitLab identity.
WEBHOOK_RECONCILIATION_MAX_BURST = 10
WEBHOOK_RECONCILIATION_MAX_PER_SECOND = 2
WEBHOOK_RECONCILIATION_MAX_FORCED_FANOUT_JITTER_SECONDS = 3600
WEBHOOK_RECONCILIATION_MAX_RETRY_AFTER_JITTER_SECONDS = 300
WEBHOOK_RECONCILIATION_MAX_RETRY_DELAY_SECONDS = 3600
WEBHOOK_RECONCILIATION_REPOSITORY_COST = 3
WEBHOOK_RECONCILIATION_FANOUT_JITTER_SECONDS = 5
WEBHOOK_RECONCILIATION_FORCED_FANOUT_JITTER_MIN_SECONDS = 67
WEBHOOK_RECONCILIATION_HOURLY_BURST_DEFERRAL_PERCENT = 99
WEBHOOK_RECONCILIATION_HOURLY_BURST_JITTER_SECONDS = 50 * 60
WEBHOOK_RECONCILIATION_HOURLY_BURST_WINDOW_SECONDS = 5 * 60
WEBHOOK_RECONCILIATION_SUCCESS_OUTCOMES = frozenset({"adopted", "created", "recreated", "updated"})

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


def _enqueue_project_webhook_cleanup(
    *,
    integration_id: int,
    organization_id: int,
    repository_id: int,
    project_id: int | str,
    reconciliation_id: str,
    hook_ids: set[int | str],
) -> None:
    for hook_id in hook_ids:
        delete_redundant_project_webhook.delay(
            integration_id,
            organization_id,
            repository_id,
            project_id,
            hook_id,
            reconciliation_id,
        )


@instrumented_task(
    name="sentry.tasks.integrations.gitlab.delete_redundant_project_webhook",
    namespace=integrations_tasks,
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=60,
    retry=Retry(times=3, delay=60, on=(Exception,), ignore=(Integration.DoesNotExist,)),
)
def delete_redundant_project_webhook(
    integration_id: int,
    organization_id: int,
    repository_id: int,
    project_id: int | str,
    hook_id: int | str,
    reconciliation_id: str,
) -> None:
    """Delete an unreferenced hook whose reconciliation identity proves we created it."""
    integration = integration_service.get_integration(
        integration_id=integration_id,
        status=ObjectStatus.ACTIVE,
        using_replica=options.get("integration_service.get_integration.using_replica"),
    )
    if not integration:
        return

    try:
        with _project_webhook_lock(repository_id).blocking_acquire(initial_delay=0.1, timeout=5):
            repo = repository_service.get_repository(
                organization_id=organization_id,
                id=repository_id,
            )
            if (
                repo
                and repo.config.get("project_id") == project_id
                and repo.config.get("webhook_id") == hook_id
            ):
                return

            installation = integration.get_installation(organization_id=organization_id)
            client = installation.get_client()
            try:
                hook = client.get_project_webhook(project_id, hook_id)
            except ApiError as e:
                if e.code == 404:
                    return
                raise

            if hook.get("url") != client.project_webhook_url(reconciliation_id):
                return

            repo = repository_service.get_repository(
                organization_id=organization_id,
                id=repository_id,
            )
            if (
                repo
                and repo.config.get("project_id") == project_id
                and repo.config.get("webhook_id") == hook_id
            ):
                return

            client.delete_project_webhook(project_id, hook_id)
    except IntegrationConfigurationError:
        logger.info(
            "delete-redundant-project-webhook.identity-unavailable",
            extra={"project_id": project_id, "webhook_id": hook_id},
        )
    except (ApiUnauthorized, ApiForbiddenError) as e:
        logger.warning(
            "delete-redundant-project-webhook.authorization-failed",
            extra={"project_id": project_id, "webhook_id": hook_id, "status_code": e.code},
        )
    except ApiError as e:
        if e.code in GITLAB_RETRY_CODES:
            raise
        if e.code != 404:
            logger.warning(
                "delete-redundant-project-webhook.failed",
                extra={"project_id": project_id, "webhook_id": hook_id, "status_code": e.code},
            )


class WebhookReconciliationRateLimitError(Exception):
    pass


class WebhookReconciliationRedisError(Exception):
    pass


def _webhook_reconciliation_rate_limits() -> tuple[int, int]:
    return (
        min(
            WEBHOOK_RECONCILIATION_MAX_BURST,
            max(
                WEBHOOK_RECONCILIATION_REPOSITORY_COST,
                options.get("gitlab.webhook-reconcile.rate-limit.burst"),
            ),
        ),
        min(
            WEBHOOK_RECONCILIATION_MAX_PER_SECOND,
            max(1, options.get("gitlab.webhook-reconcile.rate-limit.per-second")),
        ),
    )


def _webhook_reconciliation_retry_delay_seconds() -> int:
    return min(
        WEBHOOK_RECONCILIATION_MAX_RETRY_DELAY_SECONDS,
        max(1, options.get("gitlab.webhook-reconcile.rate-limit.retry-delay-seconds")),
    )


def _webhook_reconciliation_retry_after_jitter_seconds() -> int:
    return min(
        WEBHOOK_RECONCILIATION_MAX_RETRY_AFTER_JITTER_SECONDS,
        max(0, options.get("gitlab.webhook-reconcile.rate-limit.retry-after-jitter-seconds")),
    )


def _webhook_reconciliation_forced_fanout_jitter_max_seconds() -> int:
    return min(
        WEBHOOK_RECONCILIATION_MAX_FORCED_FANOUT_JITTER_SECONDS,
        max(
            WEBHOOK_RECONCILIATION_FORCED_FANOUT_JITTER_MIN_SECONDS,
            options.get("gitlab.webhook-reconcile.forced-fanout-jitter-max-seconds"),
        ),
    )


def _consume_webhook_reconciliation_capacity(
    base_url: str, identity_external_id: str
) -> LeakyBucketLimitInfo:
    hostname = urlsplit(base_url).hostname or base_url
    burst_limit, drip_rate = _webhook_reconciliation_rate_limits()
    limiter = LeakyBucketRateLimiter(
        burst_limit=burst_limit,
        drip_rate=drip_rate,
        key=f"gitlab:webhook-reconcile:{hostname}:{identity_external_id}",
        fail_open=False,
    )
    try:
        return limiter.use_and_get_info(incr_by=WEBHOOK_RECONCILIATION_REPOSITORY_COST)
    except LeakyBucketRateLimiter.Unavailable as e:
        raise WebhookReconciliationRedisError(
            "Redis is unavailable for GitLab webhook reconciliation rate limiting"
        ) from e


def _defer_update_project_webhook(
    *,
    integration_id: int,
    organization_id: int,
    repository_id: int,
    rate_limit_deferrals: int,
    countdown: int,
) -> None:
    if rate_limit_deferrals >= MAX_RATE_LIMIT_DEFERRALS:
        raise WebhookReconciliationRateLimitError(
            "GitLab webhook reconciliation exceeded its rate-limit deferral budget"
        )

    update_project_webhook.apply_async(
        kwargs={
            "integration_id": integration_id,
            "organization_id": organization_id,
            "repository_id": repository_id,
            "rate_limit_deferrals": rate_limit_deferrals + 1,
        },
        countdown=countdown,
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
def update_project_webhook(
    integration_id: int,
    organization_id: int,
    repository_id: int,
    rate_limit_deferrals: int = 0,
) -> None:
    """
    Update a single project webhook for a GitLab integration.
    This task is spawned by update_all_project_webhooks for each repository.
    """
    seconds_into_hour = int(time()) % 3600
    if (
        seconds_into_hour < WEBHOOK_RECONCILIATION_HOURLY_BURST_WINDOW_SECONDS
        and randint(1, 100) <= WEBHOOK_RECONCILIATION_HOURLY_BURST_DEFERRAL_PERCENT
    ):
        countdown = randint(
            WEBHOOK_RECONCILIATION_HOURLY_BURST_WINDOW_SECONDS - seconds_into_hour,
            WEBHOOK_RECONCILIATION_HOURLY_BURST_JITTER_SECONDS,
        )
        update_project_webhook.apply_async(
            kwargs={
                "integration_id": integration_id,
                "organization_id": organization_id,
                "repository_id": repository_id,
                "rate_limit_deferrals": rate_limit_deferrals,
            },
            countdown=countdown,
        )
        logger.info(
            "update-project-webhook.hourly-burst-deferred",
            extra={
                "integration_id": integration_id,
                "organization_id": organization_id,
                "rate_limit_countdown": countdown,
                "rate_limit_source": "hourly_burst",
                "repository_id": repository_id,
            },
        )
        return

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
                reconciliation_pending = repo.config.get("webhook_reconciliation_pending")

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

                limit_info = _consume_webhook_reconciliation_capacity(
                    client.base_url, client.identity.external_id
                )
                if limit_info.wait_time:
                    countdown = max(
                        ceil(limit_info.wait_time),
                        _webhook_reconciliation_retry_delay_seconds(),
                    ) + randint(0, WEBHOOK_RECONCILIATION_FANOUT_JITTER_SECONDS)
                    lifecycle.add_extras(
                        {
                            "rate_limit_countdown": countdown,
                            "rate_limit_deferrals": rate_limit_deferrals + 1,
                        }
                    )
                    _defer_update_project_webhook(
                        integration_id=integration_id,
                        organization_id=organization_id,
                        repository_id=repository_id,
                        rate_limit_deferrals=rate_limit_deferrals,
                        countdown=countdown,
                    )
                    lifecycle.record_halt(GitLabWebhookUpdateHaltReason.RATE_LIMITED)
                    return

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
                            if reconciliation_pending is True:
                                cleanup_ids: set[int | str] = set()
                                if isinstance(reconciliation_id, str):
                                    cleanup_ids = {
                                        candidate["id"]
                                        for candidate in _matching_project_webhooks(
                                            client, project_id, reconciliation_id
                                        )
                                        if candidate["id"] != webhook_id
                                    }
                                    _enqueue_project_webhook_cleanup(
                                        integration_id=integration_id,
                                        organization_id=organization_id,
                                        repository_id=repository_id,
                                        project_id=project_id,
                                        reconciliation_id=reconciliation_id,
                                        hook_ids=cleanup_ids,
                                    )
                                if not repository_service.update_repository_config(
                                    organization_id=organization_id,
                                    id=repository_id,
                                    config_updates={},
                                    config_deletions=["webhook_reconciliation_pending"],
                                    expected_integration_id=integration_id,
                                    expected_config={
                                        "project_id": project_id,
                                        "webhook_id": webhook_id,
                                        "webhook_reconciliation_id": reconciliation_id,
                                        "webhook_reconciliation_pending": True,
                                    },
                                ):
                                    outcome = "repository_changed"
                                    lifecycle.record_halt(
                                        GitLabWebhookUpdateHaltReason.REPOSITORY_CHANGED
                                    )
                                    return
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
                else:
                    new_reconciliation_id = reconciliation_id

                if reconciliation_pending is not True or (
                    reconciliation_id != new_reconciliation_id
                ):
                    if not repository_service.update_repository_config(
                        organization_id=organization_id,
                        id=repository_id,
                        config_updates={
                            "webhook_reconciliation_id": new_reconciliation_id,
                            "webhook_reconciliation_pending": True,
                        },
                        expected_integration_id=integration_id,
                        expected_config={
                            "project_id": project_id,
                            "webhook_id": webhook_id,
                            "webhook_reconciliation_id": reconciliation_id,
                            "webhook_reconciliation_pending": reconciliation_pending,
                        },
                    ):
                        outcome = "repository_changed"
                        lifecycle.record_halt(GitLabWebhookUpdateHaltReason.REPOSITORY_CHANGED)
                        return
                    reconciliation_id = new_reconciliation_id

                matching_hooks = _matching_project_webhooks(
                    client, project_id, new_reconciliation_id
                )
                adoptable_hooks = [
                    hook for hook in matching_hooks if hook.get("alert_status") != "disabled"
                ]
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
                        "webhook_reconciliation_pending": True,
                    },
                ):
                    outcome = "repository_changed"
                    cleanup_ids = {hook["id"] for hook in matching_hooks}
                    cleanup_ids.add(hook_id)
                    _enqueue_project_webhook_cleanup(
                        integration_id=integration_id,
                        organization_id=organization_id,
                        repository_id=repository_id,
                        project_id=project_id,
                        reconciliation_id=new_reconciliation_id,
                        hook_ids=cleanup_ids,
                    )
                    lifecycle.add_extra("created_webhook_id", hook_id)
                    lifecycle.record_halt(GitLabWebhookUpdateHaltReason.REPOSITORY_CHANGED)
                    return
                cleanup_ids = {hook["id"] for hook in matching_hooks if hook["id"] != hook_id}
                _enqueue_project_webhook_cleanup(
                    integration_id=integration_id,
                    organization_id=organization_id,
                    repository_id=repository_id,
                    project_id=project_id,
                    reconciliation_id=new_reconciliation_id,
                    hook_ids=cleanup_ids,
                )

                if not repository_service.update_repository_config(
                    organization_id=organization_id,
                    id=repository_id,
                    config_updates={},
                    config_deletions=["webhook_reconciliation_pending"],
                    expected_integration_id=integration_id,
                    expected_config={
                        "project_id": project_id,
                        "webhook_id": hook_id,
                        "webhook_reconciliation_id": new_reconciliation_id,
                        "webhook_reconciliation_pending": True,
                    },
                ):
                    _enqueue_project_webhook_cleanup(
                        integration_id=integration_id,
                        organization_id=organization_id,
                        repository_id=repository_id,
                        project_id=project_id,
                        reconciliation_id=new_reconciliation_id,
                        hook_ids={hook_id},
                    )
                    outcome = "repository_changed"
                    lifecycle.record_halt(GitLabWebhookUpdateHaltReason.REPOSITORY_CHANGED)
        except UnableToAcquireLock as e:
            lifecycle.record_halt(e)
            raise
        except ApiPaginationTruncated as e:
            outcome = "pagination_truncated"
            lifecycle.add_extra("listed_webhook_count", len(e.partial_data))
            lifecycle.record_halt(e)
        except (ApiUnauthorized, ApiForbiddenError) as e:
            outcome = "forbidden" if e.code == 403 else "unauthorized"
            lifecycle.record_halt(e)
            # Don't retry if we've lost access
            return

        except ApiRateLimitedError as e:
            if e.retry_after is None:
                raise

            countdown = max(1, e.retry_after) + randint(
                0, _webhook_reconciliation_retry_after_jitter_seconds()
            )
            lifecycle.add_extras(
                {
                    "rate_limit_countdown": countdown,
                    "rate_limit_deferrals": rate_limit_deferrals + 1,
                    "rate_limit_source": "gitlab",
                }
            )
            _defer_update_project_webhook(
                integration_id=integration_id,
                organization_id=organization_id,
                repository_id=repository_id,
                rate_limit_deferrals=rate_limit_deferrals,
                countdown=countdown,
            )
            outcome = "rate_limited"
            lifecycle.record_halt(GitLabWebhookUpdateHaltReason.RATE_LIMITED)
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
                if outcome in WEBHOOK_RECONCILIATION_SUCCESS_OUTCOMES:
                    logger.info(
                        "update-project-webhook.success",
                        extra={
                            "integration_id": integration_id,
                            "interaction_type": str(
                                GitLabTaskInteractionType.UPDATE_PROJECT_WEBHOOK
                            ),
                            "organization_id": organization_id,
                            "outcome": outcome,
                            "repository_id": repository_id,
                        },
                    )


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
            burst_limit, drip_rate = _webhook_reconciliation_rate_limits()
            fanout_jitter_min = (
                WEBHOOK_RECONCILIATION_FORCED_FANOUT_JITTER_MIN_SECONDS if force else 0
            )
            fanout_jitter_max = (
                _webhook_reconciliation_forced_fanout_jitter_max_seconds()
                if force
                else WEBHOOK_RECONCILIATION_FANOUT_JITTER_SECONDS
            )
            for index, repo in enumerate(repositories):
                required_capacity = (index + 1) * WEBHOOK_RECONCILIATION_REPOSITORY_COST
                if required_capacity <= burst_limit and not force:
                    update_project_webhook.delay(integration_id, organization_id, repo.id)
                    continue

                countdown = max(0, ceil((required_capacity - burst_limit) / drip_rate)) + randint(
                    fanout_jitter_min, fanout_jitter_max
                )
                update_project_webhook.apply_async(
                    args=(integration_id, organization_id, repo.id),
                    countdown=countdown,
                )
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
