from __future__ import annotations

import logging

from taskbroker_client.retry import Retry

from sentry import options
from sentry.constants import ObjectStatus
from sentry.integrations.bitbucket_server.webhook_reconciliation import (
    WebhookReconciliationMode,
    WebhookReconciliationOutcome,
    WebhookReconciliationResult,
    reconcile_repository_webhook,
)
from sentry.integrations.bitbucket_server.webhook_reconciliation import (
    cleanup_repository_webhook as cleanup_repository_webhook_provider,
)
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.repository import repository_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_tasks
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger(__name__)

REPAIR_METRIC = "bitbucket_server.webhook.secret_repair"


def _record_outcome(
    outcome: WebhookReconciliationOutcome,
    *,
    integration_id: int,
    organization_id: int,
    repository_id: int,
    webhook_id: int | None = None,
    status_code: int | None = None,
) -> None:
    metrics.incr(REPAIR_METRIC, tags={"outcome": outcome.value})
    logger.info(
        "bitbucket_server.webhook.secret_repair",
        extra={
            "outcome": outcome.value,
            "integration_id": integration_id,
            "organization_id": organization_id,
            "repository_id": repository_id,
            "webhook_id": webhook_id,
            "status_code": status_code,
        },
    )


def _record_result(
    result: WebhookReconciliationResult,
    *,
    integration_id: int,
    organization_id: int,
    repository_id: int,
) -> None:
    _record_outcome(
        result.outcome,
        integration_id=integration_id,
        organization_id=organization_id,
        repository_id=repository_id,
        webhook_id=result.webhook_id,
        status_code=result.status_code,
    )


@instrumented_task(
    name="sentry.tasks.integrations.bitbucket_server.repair_repository_webhook",
    namespace=integrations_tasks,
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=60,
    retry=Retry(times=3, delay=60, on=(ApiError, UnableToAcquireLock)),
)
def repair_repository_webhook(
    integration_id: int, organization_id: int, repository_id: int
) -> None:
    context = {
        "integration_id": integration_id,
        "organization_id": organization_id,
        "repository_id": repository_id,
    }
    if not options.get("bitbucket_server.webhook.secret-repair.enabled"):
        _record_outcome(WebhookReconciliationOutcome.DISABLED, **context)
        return

    repository = repository_service.get_repository(
        organization_id=organization_id,
        id=repository_id,
    )
    integration = integration_service.get_integration(
        integration_id=integration_id,
        status=ObjectStatus.ACTIVE,
        using_replica=options.get("integration_service.get_integration.using_replica"),
    )
    if (
        repository is None
        or repository.status != ObjectStatus.ACTIVE
        or integration is None
        or repository.integration_id != integration_id
    ):
        _record_outcome(WebhookReconciliationOutcome.INACTIVE, **context)
        return
    if integration.provider != IntegrationProviderSlug.BITBUCKET_SERVER.value:
        _record_outcome(WebhookReconciliationOutcome.CONFIGURATION_ERROR, **context)
        return

    try:
        result = reconcile_repository_webhook(
            integration=integration,
            repository=repository,
            mode=WebhookReconciliationMode.REPAIR_EXISTING,
        )
    except ApiError as error:
        _record_outcome(
            WebhookReconciliationOutcome.TRANSIENT_ERROR,
            status_code=error.code,
            **context,
        )
        raise
    except UnableToAcquireLock:
        _record_outcome(WebhookReconciliationOutcome.TRANSIENT_ERROR, **context)
        raise

    _record_result(result, **context)
    reconciliation_id = result.reconciliation_id
    if result.cleanup_webhook_ids and reconciliation_id is None:
        logger.error(
            "bitbucket_server.webhook.secret_repair.cleanup_missing_reconciliation_id",
            extra=context,
        )
        return
    if reconciliation_id is None:
        return
    for webhook_id in result.cleanup_webhook_ids:
        cleanup_repository_webhook.delay(
            integration_id=integration_id,
            organization_id=organization_id,
            repository_id=repository_id,
            project=repository.config["project"],
            repository_slug=repository.config["repo"],
            webhook_id=webhook_id,
            reconciliation_id=reconciliation_id,
        )


@instrumented_task(
    name="sentry.tasks.integrations.bitbucket_server.cleanup_repository_webhook",
    namespace=integrations_tasks,
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=60,
    retry=Retry(times=3, delay=60, on=(ApiError, UnableToAcquireLock)),
)
def cleanup_repository_webhook(
    integration_id: int,
    organization_id: int,
    repository_id: int,
    project: str,
    repository_slug: str,
    webhook_id: int,
    reconciliation_id: str,
) -> None:
    context = {
        "integration_id": integration_id,
        "organization_id": organization_id,
        "repository_id": repository_id,
    }
    integration = integration_service.get_integration(
        integration_id=integration_id,
        status=ObjectStatus.ACTIVE,
        using_replica=options.get("integration_service.get_integration.using_replica"),
    )
    if (
        integration is None
        or integration.provider != IntegrationProviderSlug.BITBUCKET_SERVER.value
    ):
        _record_outcome(WebhookReconciliationOutcome.INACTIVE, webhook_id=webhook_id, **context)
        return

    try:
        result = cleanup_repository_webhook_provider(
            integration=integration,
            organization_id=organization_id,
            repository_id=repository_id,
            project=project,
            repository_slug=repository_slug,
            webhook_id=webhook_id,
            reconciliation_id=reconciliation_id,
        )
    except ApiError as error:
        _record_outcome(
            WebhookReconciliationOutcome.TRANSIENT_ERROR,
            webhook_id=webhook_id,
            status_code=error.code,
            **context,
        )
        raise
    except UnableToAcquireLock:
        _record_outcome(
            WebhookReconciliationOutcome.TRANSIENT_ERROR,
            webhook_id=webhook_id,
            **context,
        )
        raise

    _record_result(result, **context)
