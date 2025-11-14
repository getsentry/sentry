from __future__ import annotations
from typing import int

import logging

from sentry.constants import ObjectStatus
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.github.client import GitHubApiClient
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.services.integration.service import integration_service
from sentry.models.organization import Organization
from sentry.models.repository import Repository

logger = logging.getLogger(__name__)


def get_github_client(organization: Organization, repo_name: str) -> GitHubApiClient | None:
    """Get the GitHub client for this organization and repository."""
    repository = Repository.objects.filter(
        organization_id=organization.id,
        name=repo_name,
        provider="integrations:github",
    ).first()
    if not repository:
        logger.info(
            "preprod.integration_utils.no_repository",
            extra={
                "organization_id": organization.id,
                "repo_name": repo_name,
            },
        )
        return None

    if not repository.integration_id:
        logger.info(
            "preprod.integration_utils.no_integration_id",
            extra={
                "repository_id": repository.id,
            },
        )
        return None

    integration: RpcIntegration | None = integration_service.get_integration(
        integration_id=repository.integration_id, status=ObjectStatus.ACTIVE
    )
    if not integration:
        logger.info(
            "preprod.integration_utils.no_integration",
            extra={
                "repository_id": repository.id,
                "integration_id": repository.integration_id,
            },
        )
        return None

    installation: IntegrationInstallation = integration.get_installation(
        organization_id=organization.id
    )
    client = installation.get_client()

    if not isinstance(client, GitHubApiClient):
        logger.info(
            "preprod.integration_utils.not_github_client",
            extra={
                "repository_id": repository.id,
                "integration_id": repository.integration_id,
            },
        )
        return None

    return client
