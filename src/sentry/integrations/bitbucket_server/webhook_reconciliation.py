from __future__ import annotations

import errno
import secrets
from dataclasses import dataclass
from enum import StrEnum
from uuid import uuid4

from sentry.constants import ObjectStatus
from sentry.integrations.bitbucket_server.client import BitbucketServerClient
from sentry.integrations.bitbucket_server.webhook_config import (
    build_webhook_data,
    build_webhook_update_data,
    get_webhook_name,
)
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.services.repository import RpcRepository
from sentry.integrations.services.repository.service import repository_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.locks import locks
from sentry.shared_integrations.exceptions import ApiError, IntegrationError

RECONCILIATION_LOCK_DURATION = 120
RECONCILIATION_LOCK_TIMEOUT = 10


class WebhookReconciliationMode(StrEnum):
    ENSURE = "ensure"
    REPAIR_EXISTING = "repair_existing"


class WebhookReconciliationOutcome(StrEnum):
    UPDATED = "updated"
    CREATED = "created"
    ADOPTED = "adopted"
    ALREADY_REPAIRED = "already_repaired"
    DISABLED = "disabled"
    INACTIVE = "inactive"
    IDENTITY_MISMATCH = "identity_mismatch"
    MISSING_WEBHOOK = "missing_webhook"
    UNAUTHORIZED = "unauthorized"
    CONFIGURATION_ERROR = "configuration_error"
    TRANSIENT_ERROR = "transient_error"
    CONFLICT = "conflict"
    CLEANED_UP = "cleaned_up"
    CLEANUP_SKIPPED = "cleanup_skipped"


@dataclass(frozen=True)
class WebhookReconciliationResult:
    outcome: WebhookReconciliationOutcome
    webhook_id: int | None = None
    status_code: int | None = None
    reconciliation_id: str | None = None
    cleanup_webhook_ids: tuple[int, ...] = ()


def _api_error_result(error: ApiError, *, webhook_id: int | None) -> WebhookReconciliationResult:
    if error.code in (401, 403):
        return WebhookReconciliationResult(
            WebhookReconciliationOutcome.UNAUTHORIZED,
            webhook_id=webhook_id,
            status_code=error.code,
        )
    if error.code in (429, errno.ECONNRESET) or (
        error.code is not None and 500 <= error.code < 600
    ):
        raise error
    return WebhookReconciliationResult(
        WebhookReconciliationOutcome.CONFIGURATION_ERROR,
        webhook_id=webhook_id,
        status_code=error.code,
    )


def _get_client(integration: RpcIntegration, organization_id: int) -> BitbucketServerClient | None:
    try:
        return integration.get_installation(organization_id=organization_id).get_client()
    except IntegrationError:
        return None


def _repository_matches(
    repository: RpcRepository | None,
    *,
    integration_id: int,
    external_id: str,
    project: str,
    repository_slug: str,
) -> bool:
    return bool(
        repository is not None
        and repository.status == ObjectStatus.ACTIVE
        and repository.integration_id == integration_id
        and str(repository.external_id) == external_id
        and repository.config.get("project") == project
        and repository.config.get("repo") == repository_slug
    )


def _expected_config(
    *,
    project: str,
    repository_slug: str,
    webhook_id: int | None,
    webhook_secret: str | None,
    repair_pending: bool | None,
    reconciliation_id: str | None,
) -> dict[str, object]:
    return {
        "project": project,
        "repo": repository_slug,
        "webhook_id": webhook_id,
        "webhook_secret": webhook_secret,
        "webhook_repair_pending": repair_pending,
        "webhook_reconciliation_id": reconciliation_id,
    }


def _finish_reconciliation(
    *,
    repository: RpcRepository,
    integration_id: int,
    external_id: str,
    project: str,
    repository_slug: str,
    previous_webhook_id: int | None,
    resulting_webhook_id: int,
    webhook_secret: str,
    repair_pending: bool | None,
    reconciliation_id: str | None,
    outcome: WebhookReconciliationOutcome,
    cleanup_webhook_ids: tuple[int, ...] = (),
) -> WebhookReconciliationResult:
    config_updates = (
        {} if previous_webhook_id == resulting_webhook_id else {"webhook_id": resulting_webhook_id}
    )
    if repository_service.update_repository_config(
        organization_id=repository.organization_id,
        id=repository.id,
        config_updates=config_updates,
        config_deletions=["webhook_repair_pending"],
        expected_integration_id=integration_id,
        expected_external_id=external_id,
        expected_config=_expected_config(
            project=project,
            repository_slug=repository_slug,
            webhook_id=previous_webhook_id,
            webhook_secret=webhook_secret,
            repair_pending=repair_pending,
            reconciliation_id=reconciliation_id,
        ),
    ):
        return WebhookReconciliationResult(
            outcome,
            webhook_id=resulting_webhook_id,
            reconciliation_id=reconciliation_id,
            cleanup_webhook_ids=cleanup_webhook_ids,
        )
    conflict_cleanup_ids = cleanup_webhook_ids
    if outcome in (
        WebhookReconciliationOutcome.CREATED,
        WebhookReconciliationOutcome.ADOPTED,
    ):
        conflict_cleanup_ids = (resulting_webhook_id, *conflict_cleanup_ids)
    return WebhookReconciliationResult(
        WebhookReconciliationOutcome.CONFLICT,
        webhook_id=resulting_webhook_id,
        reconciliation_id=reconciliation_id,
        cleanup_webhook_ids=conflict_cleanup_ids,
    )


def _stop_repair_for_missing_webhook(
    *,
    repository: RpcRepository,
    integration_id: int,
    external_id: str,
    project: str,
    repository_slug: str,
    webhook_id: int | None,
    webhook_secret: str,
    repair_pending: bool | None,
    reconciliation_id: str | None,
    status_code: int | None,
) -> WebhookReconciliationResult:
    outcome = WebhookReconciliationOutcome.MISSING_WEBHOOK
    if repair_pending is True and not repository_service.update_repository_config(
        organization_id=repository.organization_id,
        id=repository.id,
        config_updates={"webhook_repair_pending": False},
        expected_integration_id=integration_id,
        expected_external_id=external_id,
        expected_config=_expected_config(
            project=project,
            repository_slug=repository_slug,
            webhook_id=webhook_id,
            webhook_secret=webhook_secret,
            repair_pending=repair_pending,
            reconciliation_id=reconciliation_id,
        ),
    ):
        outcome = WebhookReconciliationOutcome.CONFLICT
    return WebhookReconciliationResult(
        outcome,
        webhook_id=webhook_id,
        status_code=status_code,
    )


def _initialize_secret(
    *,
    repository: RpcRepository,
    integration_id: int,
    external_id: str,
    project: str,
    repository_slug: str,
    webhook_id: int | None,
    reconciliation_id: str | None,
) -> tuple[RpcRepository, int | None, str, bool | None, str | None] | WebhookReconciliationResult:
    webhook_secret = secrets.token_hex(32)
    if repository_service.update_repository_config(
        organization_id=repository.organization_id,
        id=repository.id,
        config_updates={
            "webhook_secret": webhook_secret,
            "webhook_repair_pending": True,
        },
        expected_integration_id=integration_id,
        expected_external_id=external_id,
        expected_config=_expected_config(
            project=project,
            repository_slug=repository_slug,
            webhook_id=webhook_id,
            webhook_secret=None,
            repair_pending=None,
            reconciliation_id=reconciliation_id,
        ),
    ):
        return repository, webhook_id, webhook_secret, True, reconciliation_id

    refreshed = repository_service.get_repository(
        organization_id=repository.organization_id,
        id=repository.id,
    )
    if not _repository_matches(
        refreshed,
        integration_id=integration_id,
        external_id=external_id,
        project=project,
        repository_slug=repository_slug,
    ):
        return WebhookReconciliationResult(
            WebhookReconciliationOutcome.CONFLICT,
            webhook_id=webhook_id,
        )

    assert refreshed is not None
    winning_secret = refreshed.config.get("webhook_secret")
    if not winning_secret:
        return WebhookReconciliationResult(
            WebhookReconciliationOutcome.CONFLICT,
            webhook_id=refreshed.config.get("webhook_id"),
        )
    return (
        refreshed,
        refreshed.config.get("webhook_id"),
        winning_secret,
        refreshed.config.get("webhook_repair_pending"),
        refreshed.config.get("webhook_reconciliation_id"),
    )


def _initialize_reconciliation_id(
    *,
    repository: RpcRepository,
    integration_id: int,
    external_id: str,
    project: str,
    repository_slug: str,
    webhook_id: int | None,
    webhook_secret: str,
    repair_pending: bool | None,
) -> tuple[RpcRepository, str, int | None, str, bool | None] | WebhookReconciliationResult:
    reconciliation_id = uuid4().hex
    if repository_service.update_repository_config(
        organization_id=repository.organization_id,
        id=repository.id,
        config_updates={"webhook_reconciliation_id": reconciliation_id},
        expected_integration_id=integration_id,
        expected_external_id=external_id,
        expected_config=_expected_config(
            project=project,
            repository_slug=repository_slug,
            webhook_id=webhook_id,
            webhook_secret=webhook_secret,
            repair_pending=repair_pending,
            reconciliation_id=None,
        ),
    ):
        return repository, reconciliation_id, webhook_id, webhook_secret, repair_pending

    refreshed = repository_service.get_repository(
        organization_id=repository.organization_id,
        id=repository.id,
    )
    if not _repository_matches(
        refreshed,
        integration_id=integration_id,
        external_id=external_id,
        project=project,
        repository_slug=repository_slug,
    ):
        return WebhookReconciliationResult(
            WebhookReconciliationOutcome.CONFLICT,
            webhook_id=webhook_id,
        )

    assert refreshed is not None
    winning_id = refreshed.config.get("webhook_reconciliation_id")
    if not winning_id:
        return WebhookReconciliationResult(
            WebhookReconciliationOutcome.CONFLICT,
            webhook_id=refreshed.config.get("webhook_id"),
        )
    winning_secret = refreshed.config.get("webhook_secret")
    if not winning_secret:
        return WebhookReconciliationResult(
            WebhookReconciliationOutcome.CONFLICT,
            webhook_id=refreshed.config.get("webhook_id"),
        )
    return (
        refreshed,
        winning_id,
        refreshed.config.get("webhook_id"),
        winning_secret,
        refreshed.config.get("webhook_repair_pending"),
    )


def _reconcile_missing_webhook(
    *,
    client: BitbucketServerClient,
    integration: RpcIntegration,
    repository: RpcRepository,
    external_id: str,
    project: str,
    repository_slug: str,
    webhook_id: int | None,
    webhook_secret: str,
    repair_pending: bool | None,
    reconciliation_id: str | None,
) -> WebhookReconciliationResult:
    previous_webhook_id = webhook_id
    if reconciliation_id is None:
        initialized = _initialize_reconciliation_id(
            repository=repository,
            integration_id=integration.id,
            external_id=external_id,
            project=project,
            repository_slug=repository_slug,
            webhook_id=webhook_id,
            webhook_secret=webhook_secret,
            repair_pending=repair_pending,
        )
        if isinstance(initialized, WebhookReconciliationResult):
            return initialized
        (
            repository,
            reconciliation_id,
            webhook_id,
            webhook_secret,
            repair_pending,
        ) = initialized

    if webhook_id is not None and webhook_id != previous_webhook_id:
        try:
            webhook = client.get_hook(project, repository_slug, webhook_id)
            client.update_hook(
                project,
                repository_slug,
                webhook_id,
                build_webhook_update_data(webhook, secret=webhook_secret),
            )
        except ApiError as error:
            if error.code != 404:
                return _api_error_result(error, webhook_id=webhook_id)
        else:
            return _finish_reconciliation(
                repository=repository,
                integration_id=integration.id,
                external_id=external_id,
                project=project,
                repository_slug=repository_slug,
                previous_webhook_id=webhook_id,
                resulting_webhook_id=webhook_id,
                webhook_secret=webhook_secret,
                repair_pending=repair_pending,
                reconciliation_id=reconciliation_id,
                outcome=WebhookReconciliationOutcome.UPDATED,
            )

    marker = get_webhook_name(reconciliation_id)
    try:
        matching_hooks = sorted(
            (
                hook
                for hook in client.list_hooks(project, repository_slug)
                if hook["name"] == marker
            ),
            key=lambda hook: hook["id"],
        )
    except ApiError as error:
        return _api_error_result(error, webhook_id=webhook_id)

    cleanup_webhook_ids: tuple[int, ...] = tuple(hook["id"] for hook in matching_hooks[1:])
    desired_data = build_webhook_data(
        organization_id=repository.organization_id,
        integration_id=integration.id,
        secret=webhook_secret,
        active=True,
        reconciliation_id=reconciliation_id,
    )
    if matching_hooks:
        selected_hook = matching_hooks[0]
        outcome = WebhookReconciliationOutcome.ADOPTED
    else:
        try:
            selected_hook = client.create_hook(project, repository_slug, desired_data)
        except ApiError as error:
            return _api_error_result(error, webhook_id=webhook_id)
        outcome = WebhookReconciliationOutcome.CREATED

    selected_webhook_id = selected_hook["id"]
    try:
        client.update_hook(
            project,
            repository_slug,
            selected_webhook_id,
            desired_data,
        )
    except ApiError as error:
        return _api_error_result(error, webhook_id=selected_webhook_id)

    return _finish_reconciliation(
        repository=repository,
        integration_id=integration.id,
        external_id=external_id,
        project=project,
        repository_slug=repository_slug,
        previous_webhook_id=webhook_id,
        resulting_webhook_id=selected_webhook_id,
        webhook_secret=webhook_secret,
        repair_pending=repair_pending,
        reconciliation_id=reconciliation_id,
        outcome=outcome,
        cleanup_webhook_ids=cleanup_webhook_ids,
    )


def _reconcile_repository_webhook(
    *,
    integration: RpcIntegration,
    repository: RpcRepository,
    mode: WebhookReconciliationMode,
) -> WebhookReconciliationResult:
    webhook_id = repository.config.get("webhook_id")
    webhook_secret = repository.config.get("webhook_secret")
    repair_pending = repository.config.get("webhook_repair_pending")
    reconciliation_id = repository.config.get("webhook_reconciliation_id")

    if mode == WebhookReconciliationMode.REPAIR_EXISTING:
        if webhook_secret and repair_pending is not True:
            return WebhookReconciliationResult(
                WebhookReconciliationOutcome.ALREADY_REPAIRED,
                webhook_id=webhook_id,
            )
        if webhook_id is None:
            return WebhookReconciliationResult(WebhookReconciliationOutcome.MISSING_WEBHOOK)

    project = repository.config.get("project")
    repository_slug = repository.config.get("repo")
    if not project or not repository_slug or repository.external_id is None:
        return WebhookReconciliationResult(
            WebhookReconciliationOutcome.CONFIGURATION_ERROR,
            webhook_id=webhook_id,
        )
    external_id = str(repository.external_id)

    client = _get_client(integration, repository.organization_id)
    if client is None:
        return WebhookReconciliationResult(
            WebhookReconciliationOutcome.CONFIGURATION_ERROR,
            webhook_id=webhook_id,
        )

    try:
        remote_repository = client.get_repo(project, repository_slug)
    except ApiError as error:
        return _api_error_result(error, webhook_id=webhook_id)
    if str(remote_repository.get("id")) != external_id:
        return WebhookReconciliationResult(
            WebhookReconciliationOutcome.IDENTITY_MISMATCH,
            webhook_id=webhook_id,
        )

    if not webhook_secret:
        initialized = _initialize_secret(
            repository=repository,
            integration_id=integration.id,
            external_id=external_id,
            project=project,
            repository_slug=repository_slug,
            webhook_id=webhook_id,
            reconciliation_id=reconciliation_id,
        )
        if isinstance(initialized, WebhookReconciliationResult):
            return initialized
        (
            repository,
            webhook_id,
            webhook_secret,
            repair_pending,
            reconciliation_id,
        ) = initialized
        if mode == WebhookReconciliationMode.REPAIR_EXISTING and repair_pending is not True:
            return WebhookReconciliationResult(
                WebhookReconciliationOutcome.ALREADY_REPAIRED,
                webhook_id=webhook_id,
            )

    if webhook_id is not None:
        try:
            webhook = client.get_hook(project, repository_slug, webhook_id)
            client.update_hook(
                project,
                repository_slug,
                webhook_id,
                build_webhook_update_data(webhook, secret=webhook_secret),
            )
        except ApiError as error:
            if error.code != 404:
                return _api_error_result(error, webhook_id=webhook_id)
            if mode == WebhookReconciliationMode.REPAIR_EXISTING:
                return _stop_repair_for_missing_webhook(
                    repository=repository,
                    integration_id=integration.id,
                    external_id=external_id,
                    project=project,
                    repository_slug=repository_slug,
                    webhook_id=webhook_id,
                    webhook_secret=webhook_secret,
                    repair_pending=repair_pending,
                    reconciliation_id=reconciliation_id,
                    status_code=error.code,
                )
        else:
            return _finish_reconciliation(
                repository=repository,
                integration_id=integration.id,
                external_id=external_id,
                project=project,
                repository_slug=repository_slug,
                previous_webhook_id=webhook_id,
                resulting_webhook_id=webhook_id,
                webhook_secret=webhook_secret,
                repair_pending=repair_pending,
                reconciliation_id=reconciliation_id,
                outcome=WebhookReconciliationOutcome.UPDATED,
            )

    if mode == WebhookReconciliationMode.REPAIR_EXISTING:
        return _stop_repair_for_missing_webhook(
            repository=repository,
            integration_id=integration.id,
            external_id=external_id,
            project=project,
            repository_slug=repository_slug,
            webhook_id=None,
            webhook_secret=webhook_secret,
            repair_pending=repair_pending,
            reconciliation_id=reconciliation_id,
            status_code=None,
        )

    return _reconcile_missing_webhook(
        client=client,
        integration=integration,
        repository=repository,
        external_id=external_id,
        project=project,
        repository_slug=repository_slug,
        webhook_id=webhook_id,
        webhook_secret=webhook_secret,
        repair_pending=repair_pending,
        reconciliation_id=reconciliation_id,
    )


def reconcile_repository_webhook(
    *,
    integration: RpcIntegration,
    repository: RpcRepository,
    mode: WebhookReconciliationMode,
) -> WebhookReconciliationResult:
    lock = locks.get(
        f"bitbucket-server:webhook-reconciliation:{repository.id}",
        duration=RECONCILIATION_LOCK_DURATION,
        name="bitbucket_server_webhook_reconciliation",
    )
    with lock.blocking_acquire(initial_delay=0.1, timeout=RECONCILIATION_LOCK_TIMEOUT):
        refreshed_repository = repository_service.get_repository(
            organization_id=repository.organization_id,
            id=repository.id,
        )
        refreshed_integration = integration_service.get_integration(
            integration_id=integration.id,
            status=ObjectStatus.ACTIVE,
        )
        if (
            refreshed_repository is None
            or refreshed_repository.status != ObjectStatus.ACTIVE
            or refreshed_integration is None
            or refreshed_repository.integration_id != refreshed_integration.id
        ):
            return WebhookReconciliationResult(WebhookReconciliationOutcome.INACTIVE)
        if refreshed_integration.provider != IntegrationProviderSlug.BITBUCKET_SERVER.value:
            return WebhookReconciliationResult(
                WebhookReconciliationOutcome.CONFIGURATION_ERROR,
                webhook_id=refreshed_repository.config.get("webhook_id"),
            )
        return _reconcile_repository_webhook(
            integration=refreshed_integration,
            repository=refreshed_repository,
            mode=mode,
        )


def _cleanup_repository_webhook(
    *,
    integration: RpcIntegration,
    organization_id: int,
    repository_id: int,
    project: str,
    repository_slug: str,
    webhook_id: int,
    reconciliation_id: str,
) -> WebhookReconciliationResult:
    repository = repository_service.get_repository(
        organization_id=organization_id,
        id=repository_id,
    )
    if repository is not None and repository.config.get("webhook_id") == webhook_id:
        return WebhookReconciliationResult(
            WebhookReconciliationOutcome.CLEANUP_SKIPPED,
            webhook_id=webhook_id,
        )

    client = _get_client(integration, organization_id)
    if client is None:
        return WebhookReconciliationResult(
            WebhookReconciliationOutcome.CONFIGURATION_ERROR,
            webhook_id=webhook_id,
        )

    try:
        webhook = client.get_hook(project, repository_slug, webhook_id)
    except ApiError as error:
        if error.code == 404:
            return WebhookReconciliationResult(
                WebhookReconciliationOutcome.CLEANED_UP,
                webhook_id=webhook_id,
                status_code=error.code,
            )
        return _api_error_result(error, webhook_id=webhook_id)

    if webhook["name"] != get_webhook_name(reconciliation_id):
        return WebhookReconciliationResult(
            WebhookReconciliationOutcome.CONFLICT,
            webhook_id=webhook_id,
        )

    repository = repository_service.get_repository(
        organization_id=organization_id,
        id=repository_id,
    )
    if repository is not None and repository.config.get("webhook_id") == webhook_id:
        return WebhookReconciliationResult(
            WebhookReconciliationOutcome.CLEANUP_SKIPPED,
            webhook_id=webhook_id,
        )

    try:
        client.delete_hook(project, repository_slug, webhook_id)
    except ApiError as error:
        if error.code != 404:
            return _api_error_result(error, webhook_id=webhook_id)
    return WebhookReconciliationResult(
        WebhookReconciliationOutcome.CLEANED_UP,
        webhook_id=webhook_id,
    )


def cleanup_repository_webhook(
    *,
    integration: RpcIntegration,
    organization_id: int,
    repository_id: int,
    project: str,
    repository_slug: str,
    webhook_id: int,
    reconciliation_id: str,
) -> WebhookReconciliationResult:
    lock = locks.get(
        f"bitbucket-server:webhook-reconciliation:{repository_id}",
        duration=RECONCILIATION_LOCK_DURATION,
        name="bitbucket_server_webhook_reconciliation",
    )
    with lock.blocking_acquire(initial_delay=0.1, timeout=RECONCILIATION_LOCK_TIMEOUT):
        return _cleanup_repository_webhook(
            integration=integration,
            organization_id=organization_id,
            repository_id=repository_id,
            project=project,
            repository_slug=repository_slug,
            webhook_id=webhook_id,
            reconciliation_id=reconciliation_id,
        )
