from __future__ import annotations

import errno
import logging
import secrets
from enum import StrEnum

from taskbroker_client.retry import Retry

from sentry import options
from sentry.constants import ObjectStatus
from sentry.integrations.bitbucket_server.webhook_config import build_webhook_update_data
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.repository import repository_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_tasks
from sentry.utils import metrics

logger = logging.getLogger(__name__)

REPAIR_METRIC = "bitbucket_server.webhook.secret_repair"


class WebhookRepairOutcome(StrEnum):
    UPDATED = "updated"
    ALREADY_REPAIRED = "already_repaired"
    DISABLED = "disabled"
    INACTIVE = "inactive"
    IDENTITY_MISMATCH = "identity_mismatch"
    MISSING_WEBHOOK = "missing_webhook"
    UNAUTHORIZED = "unauthorized"
    CONFIGURATION_ERROR = "configuration_error"
    TRANSIENT_ERROR = "transient_error"
    CONFLICT = "conflict"


def _record_outcome(
    outcome: WebhookRepairOutcome,
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


def _record_api_error(
    error: ApiError,
    *,
    integration_id: int,
    organization_id: int,
    repository_id: int,
    webhook_id: int | None,
) -> None:
    if error.code in (401, 403):
        outcome = WebhookRepairOutcome.UNAUTHORIZED
    elif error.code in (429, errno.ECONNRESET) or (
        error.code is not None and 500 <= error.code < 600
    ):
        _record_outcome(
            WebhookRepairOutcome.TRANSIENT_ERROR,
            integration_id=integration_id,
            organization_id=organization_id,
            repository_id=repository_id,
            webhook_id=webhook_id,
            status_code=error.code,
        )
        raise error
    else:
        outcome = WebhookRepairOutcome.CONFIGURATION_ERROR

    _record_outcome(
        outcome,
        integration_id=integration_id,
        organization_id=organization_id,
        repository_id=repository_id,
        webhook_id=webhook_id,
        status_code=error.code,
    )


def _stop_for_missing_webhook(
    *,
    integration_id: int,
    organization_id: int,
    repository_id: int,
    project: str,
    repository_slug: str,
    webhook_id: int,
    webhook_secret: str,
    status_code: int,
) -> None:
    outcome = WebhookRepairOutcome.MISSING_WEBHOOK
    if not repository_service.update_repository_config(
        organization_id=organization_id,
        id=repository_id,
        config_updates={"webhook_repair_pending": False},
        expected_integration_id=integration_id,
        expected_config={
            "project": project,
            "repo": repository_slug,
            "webhook_id": webhook_id,
            "webhook_secret": webhook_secret,
            "webhook_repair_pending": True,
        },
    ):
        outcome = WebhookRepairOutcome.CONFLICT
    _record_outcome(
        outcome,
        integration_id=integration_id,
        organization_id=organization_id,
        repository_id=repository_id,
        webhook_id=webhook_id,
        status_code=status_code,
    )


@instrumented_task(
    name="sentry.tasks.integrations.bitbucket_server.repair_repository_webhook",
    namespace=integrations_tasks,
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=60,
    retry=Retry(times=3, delay=60, on=(ApiError,)),
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
        _record_outcome(WebhookRepairOutcome.DISABLED, **context)
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
        _record_outcome(WebhookRepairOutcome.INACTIVE, **context)
        return
    if integration.provider != IntegrationProviderSlug.BITBUCKET_SERVER.value:
        _record_outcome(WebhookRepairOutcome.CONFIGURATION_ERROR, **context)
        return

    webhook_id = repository.config.get("webhook_id")
    webhook_secret = repository.config.get("webhook_secret")
    repair_pending = repository.config.get("webhook_repair_pending")
    if webhook_secret and repair_pending is not True:
        _record_outcome(
            WebhookRepairOutcome.ALREADY_REPAIRED,
            webhook_id=webhook_id,
            **context,
        )
        return
    if webhook_id is None:
        _record_outcome(WebhookRepairOutcome.MISSING_WEBHOOK, **context)
        return

    project = repository.config.get("project")
    repository_slug = repository.config.get("repo")
    if not project or not repository_slug or repository.external_id is None:
        _record_outcome(
            WebhookRepairOutcome.CONFIGURATION_ERROR,
            webhook_id=webhook_id,
            **context,
        )
        return

    try:
        client = integration.get_installation(organization_id=organization_id).get_client()
    except IntegrationError:
        _record_outcome(
            WebhookRepairOutcome.CONFIGURATION_ERROR,
            webhook_id=webhook_id,
            **context,
        )
        return

    try:
        remote_repository = client.get_repo(project, repository_slug)
    except ApiError as error:
        _record_api_error(error, webhook_id=webhook_id, **context)
        return
    if str(remote_repository.get("id")) != str(repository.external_id):
        _record_outcome(
            WebhookRepairOutcome.IDENTITY_MISMATCH,
            webhook_id=webhook_id,
            **context,
        )
        return

    if not webhook_secret:
        webhook_secret = secrets.token_hex(32)
        if not repository_service.update_repository_config(
            organization_id=organization_id,
            id=repository_id,
            config_updates={
                "webhook_secret": webhook_secret,
                "webhook_repair_pending": True,
            },
            expected_integration_id=integration_id,
            expected_config={
                "project": project,
                "repo": repository_slug,
                "webhook_id": webhook_id,
                "webhook_secret": None,
                "webhook_repair_pending": None,
            },
        ):
            repository = repository_service.get_repository(
                organization_id=organization_id,
                id=repository_id,
            )
            if (
                repository is None
                or repository.status != ObjectStatus.ACTIVE
                or repository.integration_id != integration_id
                or str(repository.external_id) != str(remote_repository["id"])
                or repository.config.get("project") != project
                or repository.config.get("repo") != repository_slug
            ):
                _record_outcome(
                    WebhookRepairOutcome.CONFLICT,
                    webhook_id=webhook_id,
                    **context,
                )
                return
            webhook_secret = repository.config.get("webhook_secret")
            repair_pending = repository.config.get("webhook_repair_pending")
            if webhook_secret and repair_pending is not True:
                _record_outcome(
                    WebhookRepairOutcome.ALREADY_REPAIRED,
                    webhook_id=repository.config.get("webhook_id"),
                    **context,
                )
                return
            if not webhook_secret or repair_pending is not True:
                _record_outcome(
                    WebhookRepairOutcome.CONFLICT,
                    webhook_id=repository.config.get("webhook_id"),
                    **context,
                )
                return
            webhook_id = repository.config.get("webhook_id")

    if webhook_id is None:
        _record_outcome(WebhookRepairOutcome.MISSING_WEBHOOK, **context)
        return

    try:
        try:
            webhook = client.get_hook(project, repository_slug, webhook_id)
        except ApiError as error:
            if error.code == 404:
                _stop_for_missing_webhook(
                    integration_id=integration_id,
                    organization_id=organization_id,
                    repository_id=repository_id,
                    project=project,
                    repository_slug=repository_slug,
                    webhook_id=webhook_id,
                    webhook_secret=webhook_secret,
                    status_code=error.code,
                )
                return
            raise

        try:
            client.update_hook(
                project,
                repository_slug,
                webhook_id,
                build_webhook_update_data(webhook, secret=webhook_secret),
            )
        except ApiError as error:
            if error.code == 404:
                _stop_for_missing_webhook(
                    integration_id=integration_id,
                    organization_id=organization_id,
                    repository_id=repository_id,
                    project=project,
                    repository_slug=repository_slug,
                    webhook_id=webhook_id,
                    webhook_secret=webhook_secret,
                    status_code=error.code,
                )
                return
            raise
    except ApiError as error:
        _record_api_error(error, webhook_id=webhook_id, **context)
        return

    if not repository_service.update_repository_config(
        organization_id=organization_id,
        id=repository_id,
        config_updates={},
        config_deletions=["webhook_repair_pending"],
        expected_integration_id=integration_id,
        expected_config={
            "project": project,
            "repo": repository_slug,
            "webhook_id": webhook_id,
            "webhook_secret": webhook_secret,
            "webhook_repair_pending": True,
        },
    ):
        _record_outcome(
            WebhookRepairOutcome.CONFLICT,
            webhook_id=webhook_id,
            **context,
        )
        return

    _record_outcome(
        WebhookRepairOutcome.UPDATED,
        webhook_id=webhook_id,
        **context,
    )
