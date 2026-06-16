import logging
from enum import StrEnum
from typing import Any

from django.db import router, transaction

from sentry.constants import ObjectStatus
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.source_code_management.status_check import StatusCheckClient
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.commitcomparison import CommitComparison
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.vcs.status_checks.status_check_provider import (
    GitHubStatusCheckProvider,
    StatusCheckProvider,
)
from sentry.shared_integrations.exceptions import ApiError, IntegrationConfigurationError

logger = logging.getLogger(__name__)


def get_status_check_client(
    project: Project, commit_comparison: CommitComparison
) -> tuple[StatusCheckClient, Repository] | tuple[None, None]:
    """Get status check client for the project's integration.

    Returns None for expected failure cases (missing repo, integration, etc).
    Raises exceptions for unexpected errors that should be handled upstream.
    """
    repository = Repository.objects.filter(
        organization_id=project.organization_id,
        name=commit_comparison.head_repo_name,
        provider=f"integrations:{commit_comparison.provider}",
    ).first()
    if not repository:
        logger.info(
            "preprod.status_checks.create.no_repository",
            extra={
                "commit_comparison": commit_comparison.id,
                "project_id": project.id,
                "provider": commit_comparison.provider,
            },
        )
        return None, None

    if not repository.integration_id:
        logger.info(
            "preprod.status_checks.create.no_integration_id",
            extra={
                "repository": repository.id,
                "project_id": project.id,
            },
        )
        return None, None

    integration: RpcIntegration | None = integration_service.get_integration(
        integration_id=repository.integration_id, status=ObjectStatus.ACTIVE
    )
    if not integration:
        logger.info(
            "preprod.status_checks.create.no_integration",
            extra={
                "repository": repository.id,
                "integration_id": repository.integration_id,
                "project_id": project.id,
            },
        )
        return None, None

    installation: IntegrationInstallation = integration.get_installation(
        organization_id=project.organization_id
    )
    client = installation.get_client()

    if not isinstance(client, StatusCheckClient):
        logger.info(
            "preprod.status_checks.create.not_status_check_client",
            extra={
                "repository": repository.id,
                "project_id": project.id,
            },
        )
        return None, None

    return client, repository


def get_status_check_provider(
    client: StatusCheckClient,
    provider: str | None,
    organization_id: int,
    organization_slug: str,
    integration_id: int,
) -> StatusCheckProvider | None:
    if provider in (IntegrationProviderSlug.GITHUB, IntegrationProviderSlug.GITHUB_ENTERPRISE):
        return GitHubStatusCheckProvider(
            client, provider, organization_id, organization_slug, integration_id
        )
    else:
        return None


def update_posted_status_check(
    preprod_artifact: PreprodArtifact,
    check_type: str,
    success: bool,
    check_id: str | None = None,
    error: Exception | None = None,
) -> None:
    """Update the posted_status_checks field in the artifact's extras."""
    with transaction.atomic(router.db_for_write(PreprodArtifact)):
        artifact = PreprodArtifact.objects.select_for_update().get(id=preprod_artifact.id)
        extras = artifact.extras or {}

        posted_status_checks = extras.get("posted_status_checks", {})

        check_result: dict[str, Any] = {"success": success}
        if success and check_id:
            check_result["check_id"] = check_id
        if not success:
            check_result["error_type"] = _get_error_type(error).value

        posted_status_checks[check_type] = check_result
        extras["posted_status_checks"] = posted_status_checks
        artifact.extras = extras
        artifact.save(update_fields=["extras"])


class StatusCheckErrorType(StrEnum):
    """Error types for status check creation failures."""

    UNKNOWN = "unknown"
    """An unknown error occurred (e.g., API returned null check_id)."""
    API_ERROR = "api_error"
    """A retryable API error (5xx, rate limit, transient issues)."""
    INTEGRATION_ERROR = "integration_error"
    """An integration configuration error (permissions, invalid request, etc.)."""


def _get_error_type(error: Exception | None) -> StatusCheckErrorType:
    """Determine the error type from an exception."""
    if error is None:
        return StatusCheckErrorType.UNKNOWN
    if isinstance(error, IntegrationConfigurationError):
        return StatusCheckErrorType.INTEGRATION_ERROR
    if isinstance(error, ApiError):
        return StatusCheckErrorType.API_ERROR
    return StatusCheckErrorType.UNKNOWN
